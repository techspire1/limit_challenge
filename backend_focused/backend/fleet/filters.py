import django_filters
from django.db.models import Exists, OuterRef

from .models import MaintenanceRecord, Mechanic, Office, Vehicle


class VehicleFilter(django_filters.FilterSet):
    """Vehicle search. Every parameter is optional and combines with the others.

    The three maintenance-related parameters deliberately describe a *single*
    maintenance record rather than three independent ones, so asking for work done
    last quarter by mechanic ``CERT-1`` matches vehicles where that mechanic did the
    work in that window.
    """

    office = django_filters.ModelChoiceFilter(queryset=Office.objects.all())
    is_active = django_filters.BooleanFilter()
    make = django_filters.CharFilter(lookup_expr="icontains")
    model = django_filters.CharFilter(lookup_expr="icontains")
    year = django_filters.NumberFilter()

    maintenance_from = django_filters.DateFilter(method="defer_to_filter_queryset")
    maintenance_to = django_filters.DateFilter(method="defer_to_filter_queryset")
    mechanic_certification_number = django_filters.CharFilter(
        method="defer_to_filter_queryset"
    )

    class Meta:
        model = Vehicle
        fields = ["office", "is_active", "make", "model", "year"]

    def defer_to_filter_queryset(self, queryset, name, value):
        return queryset

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)

        data = self.form.cleaned_data
        maintenance_from = data.get("maintenance_from")
        maintenance_to = data.get("maintenance_to")
        certification_number = data.get("mechanic_certification_number")

        if not (maintenance_from or maintenance_to or certification_number):
            return queryset

        # One EXISTS subquery keeps the result set free of duplicates, which a
        # join plus .distinct() would not.
        records = MaintenanceRecord.objects.filter(vehicle=OuterRef("pk"))
        if maintenance_from:
            records = records.filter(maintenance_date__gte=maintenance_from)
        if maintenance_to:
            records = records.filter(maintenance_date__lte=maintenance_to)
        if certification_number:
            records = records.filter(
                mechanic__certification_number__iexact=certification_number.strip()
            )

        return queryset.filter(Exists(records))


class MechanicFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr="icontains")
    certification_number = django_filters.CharFilter(lookup_expr="iexact")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Mechanic
        fields = ["name", "certification_number", "is_active"]


class MaintenanceRecordFilter(django_filters.FilterSet):
    vehicle = django_filters.NumberFilter()
    mechanic = django_filters.NumberFilter()
    maintenance_type = django_filters.ChoiceFilter(
        choices=MaintenanceRecord.MaintenanceType.choices
    )
    maintenance_from = django_filters.DateFilter(
        field_name="maintenance_date", lookup_expr="gte"
    )
    maintenance_to = django_filters.DateFilter(
        field_name="maintenance_date", lookup_expr="lte"
    )

    class Meta:
        model = MaintenanceRecord
        fields = ["vehicle", "mechanic", "maintenance_type"]


class OfficeFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr="icontains")
    city = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Office
        fields = ["name", "city"]
