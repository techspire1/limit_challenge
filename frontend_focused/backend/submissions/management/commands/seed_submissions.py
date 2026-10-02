from datetime import timedelta
from random import choice, randint

from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from submissions import models


def follows(created_at, hours):
    """A timestamp `hours` after `created_at`, never in the future.

    Submissions seeded with a recent `created_at` would otherwise get notes and
    documents dated days ahead, which the UI reports as "in 2 days".
    """
    return min(created_at + timedelta(hours=hours), timezone.now())


class Command(BaseCommand):
    help = "Seed a small dataset for the Submission Tracker challenge"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Clear existing submissions data before seeding",
        )

    def handle(self, *args, **options):
        if models.Submission.objects.exists():
            if not options["force"]:
                self.stdout.write(
                    self.style.WARNING(
                        "Submissions already exist; rerun with --force to rebuild seed data."
                    )
                )
                return
            self.stdout.write("Clearing existing submissions data...")
            models.Note.objects.all().delete()
            models.Document.objects.all().delete()
            models.Contact.objects.all().delete()
            models.Submission.objects.all().delete()
            models.Broker.objects.all().delete()
            models.Company.objects.all().delete()
            models.TeamMember.objects.all().delete()

        fake = Faker()
        now = timezone.now()

        brokers = [
            models.Broker.objects.create(
                name=f"{fake.company()} Brokerage",
                primary_contact_email=fake.company_email(),
            )
            for _ in range(5)
        ]

        companies = [
            models.Company.objects.create(
                legal_name=fake.unique.company(),
                industry=fake.job().split(" ")[0],
                headquarters_city=fake.city(),
            )
            for _ in range(12)
        ]

        owners = [
            models.TeamMember.objects.create(
                full_name=fake.unique.name(),
                email=fake.unique.email(),
            )
            for _ in range(6)
        ]

        status_options = list(models.Submission.Status)
        priority_options = list(models.Submission.Priority)

        submissions = []
        for _ in range(25):
            company = choice(companies)
            broker = choice(brokers)
            owner = choice(owners)
            submissions.append(
                models.Submission(
                    company=company,
                    broker=broker,
                    owner=owner,
                    status=choice(status_options),
                    priority=choice(priority_options),
                    summary=fake.text(max_nb_chars=120),
                    created_at=now - timedelta(days=randint(0, 60)),
                )
            )

        submissions = models.Submission.objects.bulk_create(submissions)

        contacts = []
        documents = []
        notes = []

        doc_types = ["Summary", "Spreadsheet", "Presentation", "Contract"]

        for submission in submissions:
            for _ in range(randint(1, 3)):
                contacts.append(
                    models.Contact(
                        submission=submission,
                        name=fake.name(),
                        role=fake.job(),
                        email=fake.email(),
                        phone=fake.phone_number(),
                    )
                )

            for _ in range(randint(1, 4)):
                documents.append(
                    models.Document(
                        submission=submission,
                        title=fake.catch_phrase(),
                        doc_type=choice(doc_types),
                        file_url=fake.url(),
                        uploaded_at=follows(submission.created_at, randint(1, 48)),
                    )
                )

            for _ in range(randint(1, 5)):
                notes.append(
                    models.Note(
                        submission=submission,
                        author_name=choice([submission.owner.full_name, fake.name()]),
                        body=fake.paragraph(nb_sentences=3),
                        created_at=follows(submission.created_at, randint(2, 72)),
                    )
                )

        models.Contact.objects.bulk_create(contacts)
        models.Note.objects.bulk_create(notes)

        # `Document.uploaded_at` is auto_now_add, so the insert overwrites the
        # timestamps above with "now" and every document looks like it arrived
        # today. Capture the intended values first, then write them back.
        intended_upload_times = [document.uploaded_at for document in documents]
        created_documents = models.Document.objects.bulk_create(documents)
        for document, uploaded_at in zip(created_documents, intended_upload_times):
            document.uploaded_at = uploaded_at
        models.Document.objects.bulk_update(created_documents, ["uploaded_at"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed data created: {len(submissions)} submissions, "
                f"{len(contacts)} contacts, {len(documents)} documents, {len(notes)} notes."
            )
        )
