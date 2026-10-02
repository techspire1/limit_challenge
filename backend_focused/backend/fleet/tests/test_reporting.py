from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import make_mechanic, make_office, make_record, make_vehicle


class OfficeSummaryTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.today = timezone.localdate()
        cls.busy = make_office(name="Busy Depot", city="Boston")
        cls.quiet = make_office(name="Quiet Depot", city="Austin")

        active = make_vehicle(office=cls.busy, is_active=True)
        make_vehicle(office=cls.busy, is_active=True)
        make_vehicle(office=cls.busy, is_active=False)

        make_record(
            vehicle=active,
            maintenance_date=cls.today - timedelta(days=30),
            cost=Decimal("100.00"),
        )
        make_record(
            vehicle=active,
            maintenance_date=cls.today - timedelta(days=200),
            cost=Decimal("250.50"),
        )
        # Older than the rolling window, so excluded from the cost but still the
        # candidate for "most recent" only if nothing newer exists.
        make_record(
            vehicle=active,
            maintenance_date=cls.today - timedelta(days=500),
            cost=Decimal("999.99"),
        )

    def summary(self):
        response = self.client.get(reverse("office-summary"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {row["name"]: row for row in response.data}

    def test_every_office_is_listed(self):
        self.assertEqual(set(self.summary()), {"Busy Depot", "Quiet Depot"})

    def test_counts_only_active_vehicles(self):
        self.assertEqual(self.summary()["Busy Depot"]["active_vehicle_count"], 2)

    def test_cost_covers_the_last_twelve_months_only(self):
        self.assertEqual(
            Decimal(str(self.summary()["Busy Depot"]["maintenance_cost_last_year"])),
            Decimal("350.50"),
        )

    def test_reports_the_most_recent_maintenance_date(self):
        self.assertEqual(
            self.summary()["Busy Depot"]["last_maintenance"],
            str(self.today - timedelta(days=30)),
        )

    def test_office_without_activity_reports_zeroes_not_nulls(self):
        quiet = self.summary()["Quiet Depot"]

        self.assertEqual(quiet["active_vehicle_count"], 0)
        self.assertEqual(Decimal(str(quiet["maintenance_cost_last_year"])), Decimal("0.00"))
        self.assertIsNone(quiet["last_maintenance"])

    def test_summary_is_a_constant_number_of_queries(self):
        make_office(name="Third Depot", city="Denver")

        with self.assertNumQueries(1):
            self.client.get(reverse("office-summary"))


class MechanicWorkloadTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.today = timezone.localdate()
        cls.year_start = cls.today.replace(month=1, day=1)

        cls.busiest = make_mechanic(name="Ace", certification_number="CERT-AAA")
        cls.quieter = make_mechanic(name="Bolt", certification_number="CERT-BBB")
        cls.idle = make_mechanic(name="Cass", certification_number="CERT-CCC")

        vehicle = make_vehicle()
        for _ in range(3):
            make_record(
                vehicle=vehicle,
                mechanic=cls.busiest,
                maintenance_date=cls.year_start,
                cost=Decimal("100.00"),
            )
        make_record(
            vehicle=vehicle,
            mechanic=cls.quieter,
            maintenance_date=cls.year_start,
            cost=Decimal("500.00"),
        )
        # Last year's work must not count toward the current-year totals.
        make_record(
            vehicle=vehicle,
            mechanic=cls.idle,
            maintenance_date=cls.year_start - timedelta(days=1),
            cost=Decimal("900.00"),
        )

    def test_mechanics_are_ordered_busiest_first(self):
        response = self.client.get(reverse("mechanic-workload"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["name"] for row in response.data], ["Ace", "Bolt", "Cass"]
        )

    def test_counts_and_costs_cover_the_current_year(self):
        response = self.client.get(reverse("mechanic-workload"))
        rows = {row["name"]: row for row in response.data}

        self.assertEqual(rows["Ace"]["maintenance_count_current_year"], 3)
        self.assertEqual(
            Decimal(str(rows["Ace"]["maintenance_cost_current_year"])),
            Decimal("300.00"),
        )

    def test_work_from_previous_years_is_excluded(self):
        response = self.client.get(reverse("mechanic-workload"))
        rows = {row["name"]: row for row in response.data}

        self.assertEqual(rows["Cass"]["maintenance_count_current_year"], 0)
        self.assertEqual(
            Decimal(str(rows["Cass"]["maintenance_cost_current_year"])),
            Decimal("0.00"),
        )


class VehiclesNeedingMaintenanceTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.today = timezone.localdate()
        office = make_office()

        cls.never_serviced = make_vehicle(office=office, is_active=True)
        cls.long_overdue = make_vehicle(office=office, is_active=True)
        cls.slightly_overdue = make_vehicle(office=office, is_active=True)
        cls.up_to_date = make_vehicle(office=office, is_active=True)
        cls.retired = make_vehicle(office=office, is_active=False)

        make_record(
            vehicle=cls.long_overdue, maintenance_date=cls.today - timedelta(days=800)
        )
        make_record(
            vehicle=cls.slightly_overdue,
            maintenance_date=cls.today - timedelta(days=366),
        )
        make_record(
            vehicle=cls.up_to_date, maintenance_date=cls.today - timedelta(days=10)
        )
        make_record(
            vehicle=cls.retired, maintenance_date=cls.today - timedelta(days=900)
        )

    def results(self):
        response = self.client.get(reverse("vehicle-needs-maintenance"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["results"]

    def test_includes_overdue_and_never_serviced_active_vehicles_only(self):
        self.assertEqual(
            {row["id"] for row in self.results()},
            {
                self.never_serviced.pk,
                self.long_overdue.pk,
                self.slightly_overdue.pk,
            },
        )

    def test_never_serviced_vehicles_sort_first_then_oldest_first(self):
        self.assertEqual(
            [row["id"] for row in self.results()],
            [self.never_serviced.pk, self.long_overdue.pk, self.slightly_overdue.pk],
        )

    def test_reports_days_since_last_maintenance(self):
        rows = {row["id"]: row for row in self.results()}

        self.assertIsNone(rows[self.never_serviced.pk]["days_since_last_maintenance"])
        self.assertEqual(rows[self.long_overdue.pk]["days_since_last_maintenance"], 800)


class DuplicateVehicleCheckTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.existing = make_vehicle(
            vin="1HGBH41JXMN109186", license_plate="ABC-1234", is_active=True
        )

    def check(self, **params):
        response = self.client.get(reverse("vehicle-duplicate-check"), params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["conflicts"]

    def test_reports_both_conflicting_fields(self):
        self.assertEqual(
            self.check(vin="1HGBH41JXMN109186", license_plate="ABC-1234"),
            ["vin", "license_plate"],
        )

    def test_reports_only_the_conflicting_field(self):
        self.assertEqual(
            self.check(vin="1HGBH41JXMN109186", license_plate="FREE-0001"), ["vin"]
        )

    def test_returns_an_empty_list_when_nothing_clashes(self):
        self.assertEqual(
            self.check(vin="5XYZH4AG4HG123456", license_plate="FREE-0001"), []
        )

    def test_comparison_ignores_case_and_padding(self):
        self.assertEqual(self.check(vin=" 1hgbh41jxmn109186 "), ["vin"])

    def test_plate_held_by_a_retired_vehicle_is_not_a_conflict(self):
        make_vehicle(license_plate="OLD-9999", is_active=False)

        self.assertEqual(self.check(license_plate="OLD-9999"), [])

    def test_exclude_id_lets_a_vehicle_check_against_itself(self):
        self.assertEqual(
            self.check(
                vin="1HGBH41JXMN109186",
                license_plate="ABC-1234",
                exclude_id=self.existing.pk,
            ),
            [],
        )

    def test_at_least_one_parameter_is_required(self):
        response = self.client.get(reverse("vehicle-duplicate-check"))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
