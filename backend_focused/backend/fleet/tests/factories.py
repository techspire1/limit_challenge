"""Small builders so tests can state only the field under test."""

import itertools
from decimal import Decimal

from django.utils import timezone

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle

_vin_counter = itertools.count(1)
_plate_counter = itertools.count(1)
_cert_counter = itertools.count(1)
_office_counter = itertools.count(1)


def make_office(**overrides) -> Office:
    index = next(_office_counter)
    defaults = {"name": f"Depot {index}", "city": f"City {index}"}
    defaults.update(overrides)
    return Office.objects.create(**defaults)


def make_mechanic(**overrides) -> Mechanic:
    defaults = {
        "name": "Dana Keys",
        "certification_number": f"CERT-{next(_cert_counter):05d}",
    }
    defaults.update(overrides)
    return Mechanic.objects.create(**defaults)


def make_vehicle(**overrides) -> Vehicle:
    defaults = {
        "vin": f"VIN{next(_vin_counter):014d}",
        "license_plate": f"PLATE{next(_plate_counter):03d}",
        "make": "Ford",
        "model": "Transit",
        "year": 2021,
        "is_active": True,
    }
    defaults.update(overrides)
    if "office" not in defaults:
        defaults["office"] = make_office()
    return Vehicle.objects.create(**defaults)


def make_record(**overrides) -> MaintenanceRecord:
    defaults = {
        "maintenance_date": timezone.localdate(),
        "maintenance_type": MaintenanceRecord.MaintenanceType.OIL_CHANGE,
        "cost": Decimal("100.00"),
        "notes": "",
    }
    defaults.update(overrides)
    if "vehicle" not in defaults:
        defaults["vehicle"] = make_vehicle()
    if "mechanic" not in defaults:
        defaults["mechanic"] = make_mechanic()
    return MaintenanceRecord.objects.create(**defaults)
