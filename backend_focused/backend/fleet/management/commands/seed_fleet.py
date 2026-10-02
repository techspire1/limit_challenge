"""Populate the database with realistic dummy data for manual testing.

The generated data deliberately covers the edge cases the reporting endpoints care
about: vehicles that have never been serviced, vehicles overdue by more than a
year, retired vehicles whose plates have been reissued, and inactive mechanics.
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from faker import Faker

from fleet.models import (
    MaintenanceRecord,
    Mechanic,
    Office,
    Vehicle,
    VehicleAssignment,
)

VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"  # excludes I, O and Q

MAKES_AND_MODELS = {
    "Ford": ["F-150", "Transit", "Explorer", "Escape"],
    "Chevrolet": ["Silverado", "Express", "Tahoe", "Colorado"],
    "Toyota": ["Hilux", "Camry", "RAV4", "Tacoma"],
    "Ram": ["ProMaster", "1500", "2500"],
    "Mercedes-Benz": ["Sprinter", "Vito", "Metris"],
    "Nissan": ["NV200", "Frontier", "Titan"],
}

TYPE_COST_RANGES = {
    MaintenanceRecord.MaintenanceType.OIL_CHANGE: (60, 180),
    MaintenanceRecord.MaintenanceType.TIRE_ROTATION: (40, 150),
    MaintenanceRecord.MaintenanceType.BRAKE_SERVICE: (200, 900),
    MaintenanceRecord.MaintenanceType.INSPECTION: (50, 250),
    MaintenanceRecord.MaintenanceType.ENGINE_REPAIR: (800, 6500),
    MaintenanceRecord.MaintenanceType.TRANSMISSION: (1200, 5200),
    MaintenanceRecord.MaintenanceType.BODY_WORK: (300, 4000),
    MaintenanceRecord.MaintenanceType.OTHER: (75, 1200),
}


class Command(BaseCommand):
    help = "Fill the database with dummy offices, vehicles, mechanics and maintenance records."

    def add_arguments(self, parser):
        parser.add_argument("--offices", type=int, default=6)
        parser.add_argument("--vehicles", type=int, default=120)
        parser.add_argument("--mechanics", type=int, default=14)
        parser.add_argument(
            "--seed",
            type=int,
            default=None,
            help="Random seed, for reproducible datasets.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing fleet data before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        faker = Faker()
        if options["seed"] is not None:
            Faker.seed(options["seed"])
            random.seed(options["seed"])

        if options["force"]:
            MaintenanceRecord.objects.all().delete()
            VehicleAssignment.objects.all().delete()
            Vehicle.objects.all().delete()
            Mechanic.objects.all().delete()
            Office.objects.all().delete()
        elif Vehicle.objects.exists():
            raise CommandError(
                "The database already contains fleet data. Re-run with --force to rebuild it."
            )

        today = timezone.localdate()

        offices = self._create_offices(faker, options["offices"])
        mechanics = self._create_mechanics(faker, options["mechanics"])
        vehicles = self._create_vehicles(faker, options["vehicles"], offices, today)
        records = self._create_maintenance_records(faker, vehicles, mechanics, today)
        moves = self._create_assignments(vehicles, offices, today)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(offices)} offices, {len(mechanics)} mechanics, "
                f"{len(vehicles)} vehicles, {records} maintenance records and "
                f"{moves} assignment records."
            )
        )

    def _create_offices(self, faker: Faker, count: int) -> list[Office]:
        seen: set[tuple[str, str]] = set()
        offices = []
        while len(offices) < count:
            city = faker.city()
            key = (f"{city} Depot", city)
            if key in seen:
                continue
            seen.add(key)
            offices.append(Office(name=key[0], city=city))
        return Office.objects.bulk_create(offices)

    def _create_mechanics(self, faker: Faker, count: int) -> list[Mechanic]:
        mechanics = [
            Mechanic(
                name=faker.name(),
                certification_number=f"CERT-{index + 1:05d}",
                # A realistic fleet keeps former mechanics on file for history.
                is_active=index % 7 != 0,
            )
            for index in range(count)
        ]
        return Mechanic.objects.bulk_create(mechanics)

    def _create_vehicles(
        self, faker: Faker, count: int, offices: list[Office], today: date
    ) -> list[Vehicle]:
        used_vins: set[str] = set()
        used_active_plates: set[str] = set()
        vehicles = []

        for index in range(count):
            vin = self._unique_vin(used_vins)
            make = random.choice(list(MAKES_AND_MODELS))
            # Roughly one vehicle in six is retired.
            is_active = index % 6 != 0

            plate = self._unique_plate(faker, used_active_plates, is_active)

            vehicles.append(
                Vehicle(
                    vin=vin,
                    license_plate=plate,
                    make=make,
                    model=random.choice(MAKES_AND_MODELS[make]),
                    year=random.randint(today.year - 14, today.year),
                    office=random.choice(offices),
                    is_active=is_active,
                )
            )

        return Vehicle.objects.bulk_create(vehicles)

    def _unique_vin(self, used: set[str]) -> str:
        while True:
            vin = "".join(random.choices(VIN_ALPHABET, k=17))
            if vin not in used:
                used.add(vin)
                return vin

    def _unique_plate(self, faker: Faker, used_active: set[str], is_active: bool) -> str:
        while True:
            plate = faker.license_plate().upper().replace(" ", "")[:16]
            if not is_active:
                # Retired vehicles may share a plate; only active ones must differ.
                return plate
            if plate not in used_active:
                used_active.add(plate)
                return plate

    def _create_maintenance_records(
        self,
        faker: Faker,
        vehicles: list[Vehicle],
        mechanics: list[Mechanic],
        today: date,
    ) -> int:
        records: list[MaintenanceRecord] = []
        types = list(TYPE_COST_RANGES)

        for index, vehicle in enumerate(vehicles):
            # Every eighth vehicle stays untouched so "needs maintenance" has
            # never-serviced rows to return.
            if index % 8 == 0:
                continue

            # Every fifth vehicle is deliberately overdue by more than a year.
            overdue = index % 5 == 0
            newest_offset = random.randint(400, 900) if overdue else random.randint(1, 300)

            for visit in range(random.randint(1, 12)):
                days_ago = newest_offset + visit * random.randint(40, 160)
                maintenance_date = today - timedelta(days=days_ago)
                if maintenance_date.year < vehicle.year:
                    break

                maintenance_type = random.choice(types)
                low, high = TYPE_COST_RANGES[maintenance_type]
                records.append(
                    MaintenanceRecord(
                        vehicle=vehicle,
                        mechanic=random.choice(mechanics),
                        maintenance_date=maintenance_date,
                        maintenance_type=maintenance_type,
                        cost=Decimal(random.randint(low * 100, high * 100)) / 100,
                        notes=faker.sentence(nb_words=10) if random.random() < 0.6 else "",
                    )
                )

        MaintenanceRecord.objects.bulk_create(records, batch_size=500)
        return len(records)

    def _create_assignments(
        self, vehicles: list[Vehicle], offices: list[Office], today: date
    ) -> int:
        """Give every vehicle an entry record, and move roughly a fifth of them once.

        A moved vehicle entered the fleet at a different office and was later
        transferred to the one it occupies now, so the history always ends at the
        vehicle's current office.
        """
        assignments: list[VehicleAssignment] = []
        timestamps: list[datetime] = []

        for index, vehicle in enumerate(vehicles):
            moved = index % 5 == 0 and len(offices) > 1
            entry_office = vehicle.office

            if moved:
                entry_office = random.choice(
                    [office for office in offices if office.pk != vehicle.office_id]
                )

            entry_days_ago = random.randint(400, 2000)
            assignments.append(
                VehicleAssignment(vehicle=vehicle, to_office=entry_office)
            )
            timestamps.append(self._as_datetime(today - timedelta(days=entry_days_ago)))

            if moved:
                assignments.append(
                    VehicleAssignment(
                        vehicle=vehicle,
                        from_office=entry_office,
                        to_office=vehicle.office,
                        note="Rebalanced across depots.",
                    )
                )
                timestamps.append(
                    self._as_datetime(
                        today - timedelta(days=random.randint(1, entry_days_ago - 1))
                    )
                )

        created = VehicleAssignment.objects.bulk_create(assignments, batch_size=500)

        # assigned_at is auto_now_add, so every row lands on "now" and has to be
        # backdated afterwards for the history to look plausible.
        for assignment, moment in zip(created, timestamps):
            assignment.assigned_at = moment
        VehicleAssignment.objects.bulk_update(
            created, ["assigned_at"], batch_size=500
        )

        return len(created)

    def _as_datetime(self, day: date) -> datetime:
        return timezone.make_aware(datetime.combine(day, time(hour=9)))
