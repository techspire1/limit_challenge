from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import make_mechanic, make_office, make_record, make_vehicle


class VehicleSearchTests(APITestCase):
    """Every filter is optional, and any combination may be supplied at once."""

    @classmethod
    def setUpTestData(cls):
        cls.today = timezone.localdate()
        cls.north = make_office(name="North Depot", city="Boston")
        cls.south = make_office(name="South Depot", city="Austin")

        cls.ace = make_mechanic(name="Ace", certification_number="CERT-AAA")
        cls.bolt = make_mechanic(name="Bolt", certification_number="CERT-BBB")

        cls.transit = make_vehicle(
            make="Ford", model="Transit", office=cls.north, is_active=True
        )
        cls.explorer = make_vehicle(
            make="Ford", model="Explorer", office=cls.south, is_active=True
        )
        cls.retired = make_vehicle(
            make="Toyota", model="Hilux", office=cls.north, is_active=False
        )

        make_record(
            vehicle=cls.transit,
            mechanic=cls.ace,
            maintenance_date=cls.today - timedelta(days=10),
        )
        make_record(
            vehicle=cls.explorer,
            mechanic=cls.bolt,
            maintenance_date=cls.today - timedelta(days=400),
        )

    def search(self, **params):
        response = self.client.get(reverse("vehicle-list"), params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {row["id"] for row in response.data["results"]}

    def test_no_filters_returns_every_vehicle(self):
        self.assertEqual(
            self.search(),
            {self.transit.pk, self.explorer.pk, self.retired.pk},
        )

    def test_filter_by_office(self):
        self.assertEqual(
            self.search(office=self.north.pk), {self.transit.pk, self.retired.pk}
        )

    def test_filter_by_active_flag(self):
        self.assertEqual(self.search(is_active="false"), {self.retired.pk})

    def test_filter_by_make_is_case_insensitive_and_partial(self):
        self.assertEqual(
            self.search(make="for"), {self.transit.pk, self.explorer.pk}
        )

    def test_filter_by_model(self):
        self.assertEqual(self.search(model="Transit"), {self.transit.pk})

    def test_filter_by_maintenance_date_range(self):
        self.assertEqual(
            self.search(
                maintenance_from=str(self.today - timedelta(days=30)),
                maintenance_to=str(self.today),
            ),
            {self.transit.pk},
        )

    def test_filter_by_mechanic_certification_number(self):
        self.assertEqual(
            self.search(mechanic_certification_number="cert-bbb"), {self.explorer.pk}
        )

    def test_filters_combine(self):
        self.assertEqual(
            self.search(office=self.north.pk, is_active="true", make="Ford"),
            {self.transit.pk},
        )

    def test_date_range_and_certification_must_match_the_same_visit(self):
        """Ace worked recently and Bolt worked a year ago, so pairing Bolt's
        certificate with a recent window must return nothing."""
        self.assertEqual(
            self.search(
                maintenance_from=str(self.today - timedelta(days=30)),
                mechanic_certification_number="CERT-BBB",
            ),
            set(),
        )

    def test_matching_several_visits_does_not_duplicate_the_vehicle(self):
        for days_ago in (5, 6, 7):
            make_record(
                vehicle=self.transit,
                mechanic=self.ace,
                maintenance_date=self.today - timedelta(days=days_ago),
            )

        response = self.client.get(
            reverse("vehicle-list"),
            {"mechanic_certification_number": "CERT-AAA"},
        )

        self.assertEqual(response.data["count"], 1)

    def test_invalid_date_is_rejected(self):
        response = self.client.get(
            reverse("vehicle-list"), {"maintenance_from": "not-a-date"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
