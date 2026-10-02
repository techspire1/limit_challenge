from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import MaintenanceRecord, Mechanic, Office, Vehicle, VehicleAssignment


class NormalizedFieldsMixin:
    """Upper-cases identifier fields before DRF runs field-level validators.

    Normalizing inside ``validate_<field>`` would be too late: ``UniqueValidator``
    has already queried the database with the raw value by then.
    """

    normalized_fields: tuple[str, ...] = ()

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        for field in self.normalized_fields:
            value = data.get(field)
            if isinstance(value, str):
                data[field] = value.strip().upper()
        return super().to_internal_value(data)


class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ["id", "name", "city"]


class OfficeSummarySerializer(serializers.ModelSerializer):
    active_vehicle_count = serializers.IntegerField(read_only=True)
    maintenance_cost_last_year = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    last_maintenance = serializers.DateField(read_only=True)

    class Meta:
        model = Office
        fields = [
            "id",
            "name",
            "city",
            "active_vehicle_count",
            "maintenance_cost_last_year",
            "last_maintenance",
        ]


class MechanicSerializer(NormalizedFieldsMixin, serializers.ModelSerializer):
    normalized_fields = ("certification_number",)

    class Meta:
        model = Mechanic
        fields = ["id", "name", "certification_number", "is_active"]


class MechanicWorkloadSerializer(serializers.ModelSerializer):
    maintenance_count_current_year = serializers.IntegerField(read_only=True)
    maintenance_cost_current_year = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = Mechanic
        fields = [
            "id",
            "name",
            "certification_number",
            "is_active",
            "maintenance_count_current_year",
            "maintenance_cost_current_year",
        ]


class VehicleSerializer(NormalizedFieldsMixin, serializers.ModelSerializer):
    normalized_fields = ("vin", "license_plate")

    office_name = serializers.CharField(source="office.name", read_only=True)
    office_city = serializers.CharField(source="office.city", read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vin",
            "license_plate",
            "make",
            "model",
            "year",
            "office",
            "office_name",
            "office_city",
            "is_active",
        ]

    def validate_year(self, year: int) -> int:
        max_year = timezone.localdate().year + 1
        if year > max_year:
            raise serializers.ValidationError(
                f"Year cannot be later than {max_year}."
            )
        return year

    def validate(self, attrs):
        """Enforce the partial unique constraint on active license plates.

        DRF derives a validator from the conditional ``UniqueConstraint``, but it
        only fires when ``license_plate`` is part of the payload. Reactivating a
        retired vehicle onto a plate someone else now holds sends only
        ``is_active``, which would otherwise reach the database and raise a 500.
        """
        license_plate = attrs.get(
            "license_plate", getattr(self.instance, "license_plate", None)
        )
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))

        if is_active and license_plate:
            clashes = Vehicle.objects.filter(
                is_active=True, license_plate=license_plate
            )
            if self.instance is not None:
                clashes = clashes.exclude(pk=self.instance.pk)
            if clashes.exists():
                raise serializers.ValidationError(
                    {
                        "license_plate": [
                            "Another active vehicle already uses this license plate."
                        ]
                    }
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        vehicle = super().create(validated_data)
        VehicleAssignment.objects.create(vehicle=vehicle, to_office=vehicle.office)
        return vehicle

    @transaction.atomic
    def update(self, instance, validated_data):
        # Editing `office` through plain CRUD is still a move, so it is logged the
        # same way the dedicated assign-office endpoint logs one.
        previous_office = instance.office
        vehicle = super().update(instance, validated_data)
        if vehicle.office != previous_office:
            VehicleAssignment.objects.create(
                vehicle=vehicle,
                from_office=previous_office,
                to_office=vehicle.office,
            )
        return vehicle


class MaintenanceRecordHistorySerializer(serializers.ModelSerializer):
    mechanic = MechanicSerializer(read_only=True)
    maintenance_type_display = serializers.CharField(
        source="get_maintenance_type_display", read_only=True
    )

    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "maintenance_date",
            "maintenance_type",
            "maintenance_type_display",
            "cost",
            "notes",
            "mechanic",
        ]


class VehicleDetailSerializer(VehicleSerializer):
    office = OfficeSerializer(read_only=True)
    maintenance_history = MaintenanceRecordHistorySerializer(
        source="maintenance_records", many=True, read_only=True
    )

    class Meta(VehicleSerializer.Meta):
        fields = VehicleSerializer.Meta.fields + ["maintenance_history"]


class VehicleNeedingMaintenanceSerializer(VehicleSerializer):
    last_maintenance = serializers.DateField(read_only=True, allow_null=True)
    days_since_last_maintenance = serializers.SerializerMethodField()

    class Meta(VehicleSerializer.Meta):
        fields = VehicleSerializer.Meta.fields + [
            "last_maintenance",
            "days_since_last_maintenance",
        ]

    def get_days_since_last_maintenance(self, vehicle: Vehicle) -> int | None:
        last_maintenance = getattr(vehicle, "last_maintenance", None)
        if last_maintenance is None:
            return None
        return (timezone.localdate() - last_maintenance).days


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    maintenance_type_display = serializers.CharField(
        source="get_maintenance_type_display", read_only=True
    )
    vehicle_vin = serializers.CharField(source="vehicle.vin", read_only=True)
    mechanic_name = serializers.CharField(source="mechanic.name", read_only=True)

    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "vehicle",
            "vehicle_vin",
            "mechanic",
            "mechanic_name",
            "maintenance_date",
            "maintenance_type",
            "maintenance_type_display",
            "cost",
            "notes",
        ]

    def validate_maintenance_date(self, maintenance_date):
        if maintenance_date > timezone.localdate():
            raise serializers.ValidationError(
                "Maintenance date cannot be in the future."
            )
        return maintenance_date

    def validate_mechanic(self, mechanic: Mechanic) -> Mechanic:
        if not mechanic.is_active:
            raise serializers.ValidationError(
                "This mechanic is inactive and cannot be assigned new work."
            )
        return mechanic


class VehicleAssignmentSerializer(serializers.ModelSerializer):
    from_office = OfficeSerializer(read_only=True)
    to_office = OfficeSerializer(read_only=True)

    class Meta:
        model = VehicleAssignment
        fields = ["id", "from_office", "to_office", "assigned_at", "note"]


class VehicleOfficeAssignmentSerializer(serializers.Serializer):
    office = serializers.PrimaryKeyRelatedField(queryset=Office.objects.all())
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_office(self, office: Office) -> Office:
        if self.instance is not None and self.instance.office_id == office.pk:
            raise serializers.ValidationError(
                "Vehicle is already assigned to this office."
            )
        return office

    @transaction.atomic
    def update(self, instance: Vehicle, validated_data) -> Vehicle:
        previous_office = instance.office
        instance.office = validated_data["office"]
        instance.save(update_fields=["office"])
        VehicleAssignment.objects.create(
            vehicle=instance,
            from_office=previous_office,
            to_office=instance.office,
            note=validated_data.get("note", ""),
        )
        return instance


class DuplicateVehicleCheckSerializer(serializers.Serializer):
    """Validates the query string of the duplicate-check endpoint."""

    vin = serializers.CharField(required=False, allow_blank=True)
    license_plate = serializers.CharField(required=False, allow_blank=True)
    exclude_id = serializers.IntegerField(required=False)

    def validate_vin(self, vin: str) -> str:
        return vin.strip().upper()

    def validate_license_plate(self, license_plate: str) -> str:
        return license_plate.strip().upper()

    def validate(self, attrs):
        if not attrs.get("vin") and not attrs.get("license_plate"):
            raise serializers.ValidationError(
                "Provide at least one of 'vin' or 'license_plate'."
            )
        return attrs
