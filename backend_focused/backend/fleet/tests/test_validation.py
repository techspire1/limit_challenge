from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from fleet.models import MaintenanceRecord, Vehicle

from .factories import make_mechanic, make_office, make_record, make_vehicle


class VehicleValidationTests(APITestCase):
    def setUp(self):
        self.office = make_office()

    def payload(self, **overrides):
        payload = {
            "vin": "1HGBH41JXMN109186",
            "license_plate": "ABC-1234",
            "make": "Ford",
            "model": "Transit",
            "year": 2022,
            "office": self.office.pk,
        }
        payload.update(overrides)
        return payload

    def test_vin_and_plate_are_normalised_to_upper_case(self):
        response = self.client.post(
            reverse("vehicle-list"),
            self.payload(vin="1hgbh41jxmn109186", license_plate=" abc-1234 "),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["vin"], "1HGBH41JXMN109186")
        self.assertEqual(response.data["license_plate"], "ABC-1234")

    def test_duplicate_vin_is_rejected_regardless_of_case(self):
        make_vehicle(vin="1HGBH41JXMN109186", office=self.office)

        response = self.client.post(
            reverse("vehicle-list"),
            self.payload(vin="1hgbh41jxmn109186", license_plate="ZZZ-9999"),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vin", response.data)

    def test_plate_cannot_be_shared_by_two_active_vehicles(self):
        make_vehicle(license_plate="ABC-1234", office=self.office, is_active=True)

        response = self.client.post(reverse("vehicle-list"), self.payload())

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("license_plate", response.data)

    def test_plate_may_be_reused_once_the_holder_is_retired(self):
        make_vehicle(license_plate="ABC-1234", office=self.office, is_active=False)

        response = self.client.post(reverse("vehicle-list"), self.payload())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_reactivating_a_vehicle_onto_a_taken_plate_is_rejected(self):
        make_vehicle(license_plate="ABC-1234", office=self.office, is_active=True)
        retired = make_vehicle(
            license_plate="ABC-1234", office=self.office, is_active=False
        )

        response = self.client.patch(
            reverse("vehicle-detail", args=[retired.pk]), {"is_active": True}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("license_plate", response.data)

    def test_updating_a_vehicle_does_not_clash_with_itself(self):
        vehicle = make_vehicle(license_plate="ABC-1234", office=self.office)

        response = self.client.patch(
            reverse("vehicle-detail", args=[vehicle.pk]), {"make": "Chevrolet"}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_future_model_year_is_rejected(self):
        response = self.client.post(
            reverse("vehicle-list"),
            self.payload(year=timezone.localdate().year + 5),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("year", response.data)

    def test_unknown_office_is_rejected(self):
        response = self.client.post(reverse("vehicle-list"), self.payload(office=9999))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("office", response.data)


class MaintenanceRecordValidationTests(APITestCase):
    def setUp(self):
        self.vehicle = make_vehicle()
        self.mechanic = make_mechanic()

    def payload(self, **overrides):
        payload = {
            "vehicle": self.vehicle.pk,
            "mechanic": self.mechanic.pk,
            "maintenance_date": str(timezone.localdate()),
            "maintenance_type": MaintenanceRecord.MaintenanceType.OIL_CHANGE,
            "cost": "120.50",
        }
        payload.update(overrides)
        return payload

    def test_record_can_be_created(self):
        response = self.client.post(reverse("maintenancerecord-list"), self.payload())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(response.data["cost"])), Decimal("120.50"))

    def test_future_maintenance_date_is_rejected(self):
        tomorrow = timezone.localdate() + timedelta(days=1)

        response = self.client.post(
            reverse("maintenancerecord-list"),
            self.payload(maintenance_date=str(tomorrow)),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("maintenance_date", response.data)

    def test_negative_cost_is_rejected(self):
        response = self.client.post(
            reverse("maintenancerecord-list"), self.payload(cost="-5.00")
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cost", response.data)

    def test_unknown_maintenance_type_is_rejected(self):
        response = self.client.post(
            reverse("maintenancerecord-list"), self.payload(maintenance_type="teleport")
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("maintenance_type", response.data)

    def test_inactive_mechanic_cannot_take_new_work(self):
        retired = make_mechanic(is_active=False)

        response = self.client.post(
            reverse("maintenancerecord-list"), self.payload(mechanic=retired.pk)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mechanic", response.data)


class ReferentialIntegrityTests(APITestCase):
    def test_deleting_an_office_that_still_holds_vehicles_returns_409(self):
        office = make_office()
        make_vehicle(office=office)

        response = self.client.delete(reverse("office-detail", args=[office.pk]))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("detail", response.data)

    def test_deleting_a_mechanic_with_history_returns_409(self):
        mechanic = make_mechanic()
        make_record(mechanic=mechanic)

        response = self.client.delete(reverse("mechanic-detail", args=[mechanic.pk]))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_deleting_an_empty_office_succeeds(self):
        office = make_office(name="Empty Depot", city="Austin")

        response = self.client.delete(reverse("office-detail", args=[office.pk]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_deleting_a_vehicle_removes_its_history(self):
        record = make_record()
        vehicle = record.vehicle

        response = self.client.delete(reverse("vehicle-detail", args=[vehicle.pk]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Vehicle.objects.filter(pk=vehicle.pk).exists())
        self.assertFalse(MaintenanceRecord.objects.filter(pk=record.pk).exists())
