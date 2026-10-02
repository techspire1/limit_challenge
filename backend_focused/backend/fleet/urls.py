from rest_framework.routers import DefaultRouter

from .views import (
    MaintenanceRecordViewSet,
    MechanicViewSet,
    OfficeViewSet,
    VehicleViewSet,
)

router = DefaultRouter()
router.register("offices", OfficeViewSet, basename="office")
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("mechanics", MechanicViewSet, basename="mechanic")
router.register(
    "maintenance-records", MaintenanceRecordViewSet, basename="maintenancerecord"
)

urlpatterns = router.urls
