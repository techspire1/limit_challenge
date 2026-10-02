from django.contrib import admin

from .models import MaintenanceRecord, Mechanic, Office, Vehicle, VehicleAssignment


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ["name", "city"]
    search_fields = ["name", "city"]


@admin.register(Mechanic)
class MechanicAdmin(admin.ModelAdmin):
    list_display = ["name", "certification_number", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "certification_number"]


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["vin", "license_plate", "make", "model", "year", "office", "is_active"]
    list_filter = ["is_active", "office", "make"]
    search_fields = ["vin", "license_plate", "make", "model"]
    list_select_related = ["office"]


@admin.register(VehicleAssignment)
class VehicleAssignmentAdmin(admin.ModelAdmin):
    list_display = ["vehicle", "from_office", "to_office", "assigned_at"]
    list_filter = ["to_office"]
    search_fields = ["vehicle__vin", "vehicle__license_plate"]
    list_select_related = ["vehicle", "from_office", "to_office"]
    date_hierarchy = "assigned_at"


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
    list_display = ["vehicle", "mechanic", "maintenance_date", "maintenance_type", "cost"]
    list_filter = ["maintenance_type", "maintenance_date"]
    search_fields = ["vehicle__vin", "vehicle__license_plate", "mechanic__name"]
    list_select_related = ["vehicle", "mechanic"]
    date_hierarchy = "maintenance_date"
