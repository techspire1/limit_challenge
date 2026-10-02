from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from fleet.models import MaintenanceRecord

from .factories import make_mechanic, make_office, make_record, make_vehicle


class VehicleDetailTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.today = timezone.localdate()
        cls.office = make_office(name="North Depot", city="Boston")
        cls.mechanic = make_mechanic(name="Ace", certification_number="CERT-AAA")
        cls.vehicle = make_vehicle(office=cls.office)

        cls.records = [
            make_record(
                vehicle=cls.vehicle,
                mechanic=cls.mechanic,
                maintenance_date=cls.today - timedelta(days=days_ago),
                cost=Decimal("150.00"),
            )
            for days_ago in (5, 100, 400)
        ]

    def detail(self):
        response = self.client.get(reverse("vehicle-detail", args=[self.vehicle.pk]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_includes_office_information(self):
        self.assertEqual(
            self.detail()["office"],
            {"id": self.office.pk, "name": "North Depot", "city": "Boston"},
        )

    def test_includes_the_complete_history_newest_first(self):
        history = self.detail()["maintenance_history"]

        self.assertEqual(len(history), 3)
        self.assertEqual(
            [row["maintenance_date"] for row in history],
            [str(self.today - timedelta(days=d)) for d in (5, 100, 400)],
        )

    def test_includes_mechanic_information_per_record(self):
        first = self.detail()["maintenance_history"][0]

        self.assertEqual(first["mechanic"]["name"], "Ace")
        self.assertEqual(first["mechanic"]["certification_number"], "CERT-AAA")

    def test_query_count_does_not_grow_with_history_size(self):
        """Guards the prefetch: without it this is one query per record."""
        MaintenanceRecord.objects.bulk_create(
            [
                MaintenanceRecord(
                    vehicle=self.vehicle,
                    mechanic=self.mechanic,
                    maintenance_date=self.today - timedelta(days=index + 1),
                    maintenance_type=MaintenanceRecord.MaintenanceType.INSPECTION,
                    cost=Decimal("75.00"),
                )
                for index in range(300)
            ]
        )

        with self.assertNumQueries(2):
            self.client.get(reverse("vehicle-detail", args=[self.vehicle.pk]))

    def test_missing_vehicle_returns_404(self):
        response = self.client.get(reverse("vehicle-detail", args=[999999]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class VehicleMaintenanceHistoryTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.today = timezone.localdate()
        cls.vehicle = make_vehicle()
        cls.other_vehicle = make_vehicle()

        for days_ago in (1, 50, 200):
            make_record(
                vehicle=cls.vehicle, maintenance_date=cls.today - timedelta(days=days_ago)
            )
        make_record(vehicle=cls.other_vehicle, maintenance_date=cls.today)

    def test_returns_only_this_vehicles_history_newest_first(self):
        response = self.client.get(
            reverse("vehicle-maintenance-history", args=[self.vehicle.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(
            [row["maintenance_date"] for row in response.data["results"]],
            [str(self.today - timedelta(days=d)) for d in (1, 50, 200)],
        )

    def test_history_is_paginated(self):
        response = self.client.get(
            reverse("vehicle-maintenance-history", args=[self.vehicle.pk]),
            {"page_size": 2},
        )

        self.assertIn("next", response.data)

    def test_unknown_vehicle_returns_404(self):
        response = self.client.get(
            reverse("vehicle-maintenance-history", args=[999999])
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class AssignVehicleOfficeTests(APITestCase):
    def setUp(self):
        self.origin = make_office(name="North Depot", city="Boston")
        self.destination = make_office(name="South Depot", city="Austin")
        self.vehicle = make_vehicle(office=self.origin, make="Ford")

    def test_moves_the_vehicle_to_the_new_office(self):
        response = self.client.post(
            reverse("vehicle-assign-office", args=[self.vehicle.pk]),
            {"office": self.destination.pk},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.office, self.destination)

    def test_records_only_the_office_change(self):
        response = self.client.post(
            reverse("vehicle-assign-office", args=[self.vehicle.pk]),
            {"office": self.destination.pk, "make": "Tesla", "is_active": False},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.make, "Ford")
        self.assertTrue(self.vehicle.is_active)

    def test_reassigning_to_the_same_office_is_rejected(self):
        response = self.client.post(
            reverse("vehicle-assign-office", args=[self.vehicle.pk]),
            {"office": self.origin.pk},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("office", response.data)

    def test_unknown_office_is_rejected(self):
        response = self.client.post(
            reverse("vehicle-assign-office", args=[self.vehicle.pk]), {"office": 999999}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_office_is_required(self):
        response = self.client.post(
            reverse("vehicle-assign-office", args=[self.vehicle.pk]), {}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("office", response.data)


class VehicleAssignmentHistoryTests(APITestCase):
    def setUp(self):
        self.origin = make_office(name="North Depot", city="Boston")
        self.destination = make_office(name="South Depot", city="Austin")
        self.third = make_office(name="West Depot", city="Denver")

    def history(self, vehicle_id):
        response = self.client.get(reverse("vehicle-assignments", args=[vehicle_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["results"]

    def create_vehicle(self):
        response = self.client.post(
            reverse("vehicle-list"),
            {
                "vin": "1HGBH41JXMN109186",
                "license_plate": "ABC-1234",
                "make": "Ford",
                "model": "Transit",
                "year": 2022,
                "office": self.origin.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["id"]

    def test_creating_a_vehicle_records_its_entry_office(self):
        history = self.history(self.create_vehicle())

        self.assertEqual(len(history), 1)
        self.assertIsNone(history[0]["from_office"])
        self.assertEqual(history[0]["to_office"]["name"], "North Depot")

    def test_each_move_is_appended_newest_first(self):
        vehicle_id = self.create_vehicle()

        for office in (self.destination, self.third):
            self.client.post(
                reverse("vehicle-assign-office", args=[vehicle_id]),
                {"office": office.pk},
            )

        history = self.history(vehicle_id)

        self.assertEqual(
            [row["to_office"]["name"] for row in history],
            ["West Depot", "South Depot", "North Depot"],
        )
        self.assertEqual(history[0]["from_office"]["name"], "South Depot")

    def test_move_note_is_stored(self):
        vehicle_id = self.create_vehicle()

        self.client.post(
            reverse("vehicle-assign-office", args=[vehicle_id]),
            {"office": self.destination.pk, "note": "Seasonal rebalance"},
        )

        self.assertEqual(self.history(vehicle_id)[0]["note"], "Seasonal rebalance")

    def test_rejected_move_leaves_no_trace(self):
        vehicle_id = self.create_vehicle()

        self.client.post(
            reverse("vehicle-assign-office", args=[vehicle_id]),
            {"office": self.origin.pk},
        )

        self.assertEqual(len(self.history(vehicle_id)), 1)

    def test_editing_the_office_through_crud_is_also_recorded(self):
        """A move is a move however the client makes it."""
        vehicle_id = self.create_vehicle()

        self.client.patch(
            reverse("vehicle-detail", args=[vehicle_id]),
            {"office": self.destination.pk},
        )

        history = self.history(vehicle_id)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["from_office"]["name"], "North Depot")
        self.assertEqual(history[0]["to_office"]["name"], "South Depot")

    def test_editing_other_fields_does_not_create_an_assignment(self):
        vehicle_id = self.create_vehicle()

        self.client.patch(
            reverse("vehicle-detail", args=[vehicle_id]), {"make": "Chevrolet"}
        )

        self.assertEqual(len(self.history(vehicle_id)), 1)

    def test_history_is_scoped_to_one_vehicle(self):
        vehicle_id = self.create_vehicle()
        other = make_vehicle(office=self.third)

        self.assertEqual(len(self.history(vehicle_id)), 1)
        self.assertEqual(len(self.history(other.pk)), 0)
