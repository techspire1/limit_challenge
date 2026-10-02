"""Read-side query construction for the reporting endpoints.

Each helper returns a queryset whose aggregates are computed by the database in a
single round trip, so the views stay free of N+1 loops.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import (
    Count,
    DateField,
    DecimalField,
    F,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    QuerySet,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import MaintenanceRecord, Mechanic, Office, Vehicle

MAINTENANCE_INTERVAL_DAYS = 365

MONEY = DecimalField(max_digits=14, decimal_places=2)
ZERO = Value(Decimal("0.00"), output_field=MONEY)


def office_summary_queryset(today: date | None = None) -> QuerySet[Office]:
    """Offices with active vehicle counts and rolling 12-month maintenance figures.

    Correlated subqueries are used instead of joined aggregates: joining offices to
    vehicles *and* to maintenance records in one query fans the rows out, which
    silently inflates the sum.
    """
    today = today or timezone.localdate()
    cutoff = today - timedelta(days=MAINTENANCE_INTERVAL_DAYS)

    active_vehicles = (
        Vehicle.objects.filter(office=OuterRef("pk"), is_active=True)
        .order_by()
        .values("office")
        .annotate(total=Count("pk"))
        .values("total")
    )
    recent_cost = (
        MaintenanceRecord.objects.filter(
            vehicle__office=OuterRef("pk"), maintenance_date__gte=cutoff
        )
        .order_by()
        .values("vehicle__office")
        .annotate(total=Sum("cost"))
        .values("total")
    )
    last_maintenance = (
        MaintenanceRecord.objects.filter(vehicle__office=OuterRef("pk"))
        .order_by("-maintenance_date")
        .values("maintenance_date")[:1]
    )

    return Office.objects.annotate(
        active_vehicle_count=Coalesce(
            Subquery(active_vehicles, output_field=IntegerField()), 0
        ),
        maintenance_cost_last_year=Coalesce(
            Subquery(recent_cost, output_field=MONEY), ZERO
        ),
        last_maintenance=Subquery(last_maintenance, output_field=DateField()),
    ).order_by("name")


def mechanic_workload_queryset(today: date | None = None) -> QuerySet[Mechanic]:
    """Mechanics ranked by jobs completed this calendar year, busiest first."""
    today = today or timezone.localdate()
    this_year = Q(
        maintenance_records__maintenance_date__gte=date(today.year, 1, 1),
        maintenance_records__maintenance_date__lte=date(today.year, 12, 31),
    )

    return Mechanic.objects.annotate(
        maintenance_count_current_year=Count("maintenance_records", filter=this_year),
        maintenance_cost_current_year=Coalesce(
            Sum("maintenance_records__cost", filter=this_year, output_field=MONEY),
            ZERO,
        ),
    ).order_by(
        "-maintenance_count_current_year", "-maintenance_cost_current_year", "name"
    )


def vehicles_needing_maintenance_queryset(
    today: date | None = None,
) -> QuerySet[Vehicle]:
    """Active vehicles never serviced, or last serviced over a year ago.

    Never-serviced vehicles sort first: they are the most overdue, not the least.
    """
    today = today or timezone.localdate()
    cutoff = today - timedelta(days=MAINTENANCE_INTERVAL_DAYS)
    last_maintenance = Subquery(
        MaintenanceRecord.objects.filter(vehicle=OuterRef("pk"))
        .order_by("-maintenance_date")
        .values("maintenance_date")[:1],
        output_field=DateField(),
    )

    return (
        Vehicle.objects.filter(is_active=True)
        .select_related("office")
        .annotate(last_maintenance=last_maintenance)
        .filter(Q(last_maintenance__isnull=True) | Q(last_maintenance__lt=cutoff))
        .order_by(F("last_maintenance").asc(nulls_first=True), "vin")
    )


def vehicle_detail_queryset() -> QuerySet[Vehicle]:
    """Vehicle plus its full history, fetched in a fixed number of queries.

    The history is prefetched with its mechanic joined in, so a vehicle with
    hundreds of records still costs three queries rather than hundreds.
    """
    return Vehicle.objects.select_related("office").prefetch_related(
        Prefetch(
            "maintenance_records",
            queryset=MaintenanceRecord.objects.select_related("mechanic").order_by(
                "-maintenance_date", "-id"
            ),
        )
    )


def duplicate_vehicle_conflicts(
    vin: str = "", license_plate: str = "", exclude_id: int | None = None
) -> list[str]:
    """Field names that would clash with an existing vehicle.

    VIN is globally unique, but a plate only clashes with *active* vehicles, which
    mirrors the database constraints.
    """
    conflicts: list[str] = []

    if vin:
        query = Vehicle.objects.filter(vin=vin)
        if exclude_id is not None:
            query = query.exclude(pk=exclude_id)
        if query.exists():
            conflicts.append("vin")

    if license_plate:
        query = Vehicle.objects.filter(license_plate=license_plate, is_active=True)
        if exclude_id is not None:
            query = query.exclude(pk=exclude_id)
        if query.exists():
            conflicts.append("license_plate")

    return conflicts
