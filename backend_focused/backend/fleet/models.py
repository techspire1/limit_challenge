from datetime import date

from django.core.validators import MinValueValidator, RegexValidator
from django.db import models


def max_vehicle_year() -> int:
    """Model years are published ahead of the calendar year, so allow one extra."""
    return date.today().year + 1


class Office(models.Model):
    name = models.CharField(max_length=120)
    city = models.CharField(max_length=120)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "city"], name="unique_office_name_per_city"
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.city})"


class Mechanic(models.Model):
    name = models.CharField(max_length=120)
    certification_number = models.CharField(max_length=32, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} [{self.certification_number}]"

    def save(self, *args, **kwargs):
        self.certification_number = self.certification_number.strip().upper()
        return super().save(*args, **kwargs)


class Vehicle(models.Model):
    vin = models.CharField(
        max_length=17,
        unique=True,
        validators=[
            RegexValidator(
                regex=r"^[A-HJ-NPR-Z0-9]{11,17}$",
                message=(
                    "VIN must be 11-17 characters and may not contain the letters I, O or Q."
                ),
            )
        ],
    )
    license_plate = models.CharField(max_length=16)
    make = models.CharField(max_length=60)
    model = models.CharField(max_length=60)
    year = models.PositiveSmallIntegerField(validators=[MinValueValidator(1900)])
    office = models.ForeignKey(
        Office, related_name="vehicles", on_delete=models.PROTECT
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["vin"]
        constraints = [
            # A plate may be reused once the vehicle holding it is retired.
            models.UniqueConstraint(
                fields=["license_plate"],
                condition=models.Q(is_active=True),
                name="unique_license_plate_among_active_vehicles",
            )
        ]
        indexes = [
            models.Index(fields=["office", "is_active"]),
            models.Index(fields=["make", "model"]),
            models.Index(fields=["license_plate"]),
        ]

    def __str__(self) -> str:
        return f"{self.year} {self.make} {self.model} ({self.license_plate})"

    def save(self, *args, **kwargs):
        self.vin = self.vin.strip().upper()
        self.license_plate = self.license_plate.strip().upper()
        return super().save(*args, **kwargs)


class VehicleAssignment(models.Model):
    """Audit trail of which office has held a vehicle over time.

    The first row for a vehicle has no ``from_office``: it records the office the
    vehicle entered the fleet at.
    """

    vehicle = models.ForeignKey(
        Vehicle, related_name="assignments", on_delete=models.CASCADE
    )
    from_office = models.ForeignKey(
        Office,
        related_name="assignments_out",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    to_office = models.ForeignKey(
        Office, related_name="assignments_in", on_delete=models.PROTECT
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["-assigned_at", "-id"]
        indexes = [models.Index(fields=["vehicle", "-assigned_at"])]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(from_office=models.F("to_office")),
                name="assignment_moves_between_different_offices",
            )
        ]

    def __str__(self) -> str:
        origin = self.from_office or "fleet entry"
        return f"{self.vehicle_id}: {origin} -> {self.to_office}"


class MaintenanceRecord(models.Model):
    class MaintenanceType(models.TextChoices):
        OIL_CHANGE = "oil_change", "Oil change"
        TIRE_ROTATION = "tire_rotation", "Tire rotation"
        BRAKE_SERVICE = "brake_service", "Brake service"
        INSPECTION = "inspection", "Inspection"
        ENGINE_REPAIR = "engine_repair", "Engine repair"
        TRANSMISSION = "transmission", "Transmission"
        BODY_WORK = "body_work", "Body work"
        OTHER = "other", "Other"

    vehicle = models.ForeignKey(
        Vehicle, related_name="maintenance_records", on_delete=models.CASCADE
    )
    mechanic = models.ForeignKey(
        Mechanic, related_name="maintenance_records", on_delete=models.PROTECT
    )
    maintenance_date = models.DateField()
    maintenance_type = models.CharField(
        max_length=32, choices=MaintenanceType.choices
    )
    cost = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-maintenance_date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cost__gte=0), name="maintenance_cost_non_negative"
            )
        ]
        indexes = [
            models.Index(fields=["vehicle", "-maintenance_date"]),
            models.Index(fields=["mechanic", "maintenance_date"]),
            models.Index(fields=["maintenance_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_maintenance_type_display()} on {self.maintenance_date}"
