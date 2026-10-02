from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import selectors
from .filters import (
    MaintenanceRecordFilter,
    MechanicFilter,
    OfficeFilter,
    VehicleFilter,
)
from .models import (
    MaintenanceRecord,
    Mechanic,
    Office,
    Vehicle,
    VehicleAssignment,
)
from .serializers import (
    DuplicateVehicleCheckSerializer,
    MaintenanceRecordHistorySerializer,
    MaintenanceRecordSerializer,
    MechanicSerializer,
    MechanicWorkloadSerializer,
    OfficeSerializer,
    OfficeSummarySerializer,
    VehicleAssignmentSerializer,
    VehicleDetailSerializer,
    VehicleNeedingMaintenanceSerializer,
    VehicleOfficeAssignmentSerializer,
    VehicleSerializer,
)


class OfficeViewSet(viewsets.ModelViewSet):
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer
    filterset_class = OfficeFilter
    ordering_fields = ["name", "city", "id"]

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Every office with active vehicle count, 12-month spend, and last service.

        Returned unpaginated: the office list is small and callers treat it as a
        single dashboard payload.
        """
        offices = selectors.office_summary_queryset()
        return Response(OfficeSummarySerializer(offices, many=True).data)


class MechanicViewSet(viewsets.ModelViewSet):
    queryset = Mechanic.objects.all()
    serializer_class = MechanicSerializer
    filterset_class = MechanicFilter
    ordering_fields = ["name", "certification_number", "id"]

    @action(detail=False, methods=["get"])
    def workload(self, request):
        """Mechanics ordered from busiest to least busy for the current year."""
        mechanics = selectors.mechanic_workload_queryset()
        return Response(MechanicWorkloadSerializer(mechanics, many=True).data)


class VehicleViewSet(viewsets.ModelViewSet):
    """CRUD plus search. The list endpoint *is* the search endpoint: every filter
    documented in ``VehicleFilter`` is optional and composable."""

    queryset = Vehicle.objects.select_related("office")
    serializer_class = VehicleSerializer
    filterset_class = VehicleFilter
    ordering_fields = ["vin", "license_plate", "make", "model", "year", "id"]

    def get_queryset(self):
        if self.action == "retrieve":
            return selectors.vehicle_detail_queryset()
        return super().get_queryset()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return VehicleDetailSerializer
        if self.action == "assign_office":
            return VehicleOfficeAssignmentSerializer
        if self.action == "assignments":
            return VehicleAssignmentSerializer
        if self.action == "needs_maintenance":
            return VehicleNeedingMaintenanceSerializer
        return super().get_serializer_class()

    @action(detail=True, methods=["get"], url_path="maintenance-history")
    def maintenance_history(self, request, pk=None):
        """Paginated history for one vehicle, newest first."""
        vehicle = self.get_object()
        records = (
            MaintenanceRecord.objects.filter(vehicle=vehicle)
            .select_related("mechanic")
            .order_by("-maintenance_date", "-id")
        )

        page = self.paginate_queryset(records)
        if page is not None:
            serializer = MaintenanceRecordHistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(MaintenanceRecordHistorySerializer(records, many=True).data)

    @action(detail=True, methods=["post"], url_path="assign-office")
    def assign_office(self, request, pk=None):
        """Move a vehicle to another office, touching only the office assignment.

        The move is appended to the vehicle's assignment history.
        """
        vehicle = self.get_object()
        serializer = VehicleOfficeAssignmentSerializer(vehicle, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        vehicle.refresh_from_db()
        return Response(VehicleSerializer(vehicle).data)

    @action(detail=True, methods=["get"])
    def assignments(self, request, pk=None):
        """Office assignment history for one vehicle, newest first."""
        vehicle = self.get_object()
        history = (
            VehicleAssignment.objects.filter(vehicle=vehicle)
            .select_related("from_office", "to_office")
            .order_by("-assigned_at", "-id")
        )

        page = self.paginate_queryset(history)
        if page is not None:
            serializer = VehicleAssignmentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(VehicleAssignmentSerializer(history, many=True).data)

    @action(detail=False, methods=["get"], url_path="needs-maintenance")
    def needs_maintenance(self, request):
        """Active vehicles never serviced or last serviced over 365 days ago."""
        vehicles = selectors.vehicles_needing_maintenance_queryset()

        page = self.paginate_queryset(vehicles)
        if page is not None:
            serializer = VehicleNeedingMaintenanceSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(VehicleNeedingMaintenanceSerializer(vehicles, many=True).data)

    @action(detail=False, methods=["get"], url_path="duplicate-check")
    def duplicate_check(self, request):
        """Report which of VIN / license plate already belong to another vehicle.

        ``exclude_id`` lets an edit form check itself without matching its own row.
        """
        params = DuplicateVehicleCheckSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        conflicts = selectors.duplicate_vehicle_conflicts(
            vin=params.validated_data.get("vin", ""),
            license_plate=params.validated_data.get("license_plate", ""),
            exclude_id=params.validated_data.get("exclude_id"),
        )
        return Response({"conflicts": conflicts})

    def filter_queryset(self, queryset):
        # Search filters belong to the list endpoint only. Leaving them enabled
        # would let a stray query param turn a detail lookup into a 404.
        if self.action != "list":
            return queryset
        return super().filter_queryset(queryset)


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related("vehicle", "mechanic")
    serializer_class = MaintenanceRecordSerializer
    filterset_class = MaintenanceRecordFilter
    ordering_fields = ["maintenance_date", "cost", "id"]
