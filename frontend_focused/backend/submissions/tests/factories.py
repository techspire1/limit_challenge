"""Small builders so each test states only the data it actually cares about."""

from datetime import timedelta
from itertools import count

from django.utils import timezone

from submissions.models import Broker, Company, Contact, Document, Note, Submission, TeamMember

_counter = count(1)


def make_broker(**kwargs) -> Broker:
    n = next(_counter)
    return Broker.objects.create(
        name=kwargs.pop('name', f'Broker {n}'),
        primary_contact_email=kwargs.pop('primary_contact_email', f'broker{n}@example.com'),
        **kwargs,
    )


def make_company(**kwargs) -> Company:
    n = next(_counter)
    return Company.objects.create(
        legal_name=kwargs.pop('legal_name', f'Company {n}'),
        industry=kwargs.pop('industry', 'Logistics'),
        headquarters_city=kwargs.pop('headquarters_city', 'Chicago'),
        **kwargs,
    )


def make_team_member(**kwargs) -> TeamMember:
    n = next(_counter)
    return TeamMember.objects.create(
        full_name=kwargs.pop('full_name', f'Owner {n}'),
        email=kwargs.pop('email', f'owner{n}@example.com'),
        **kwargs,
    )


def make_submission(**kwargs) -> Submission:
    kwargs.setdefault('company', make_company())
    kwargs.setdefault('broker', make_broker())
    kwargs.setdefault('owner', make_team_member())
    kwargs.setdefault('summary', 'Summary text')
    return Submission.objects.create(**kwargs)


def make_contact(submission: Submission, **kwargs) -> Contact:
    n = next(_counter)
    return Contact.objects.create(
        submission=submission,
        name=kwargs.pop('name', f'Contact {n}'),
        role=kwargs.pop('role', 'CFO'),
        email=kwargs.pop('email', f'contact{n}@example.com'),
        phone=kwargs.pop('phone', '555-0100'),
        **kwargs,
    )


def make_document(submission: Submission, uploaded_at=None, **kwargs) -> Document:
    n = next(_counter)
    document = Document.objects.create(
        submission=submission,
        title=kwargs.pop('title', f'Document {n}'),
        doc_type=kwargs.pop('doc_type', 'Contract'),
        file_url=kwargs.pop('file_url', 'https://example.com/doc.pdf'),
        **kwargs,
    )
    if uploaded_at is not None:
        # `uploaded_at` is auto_now_add, so it can only be set after insert.
        Document.objects.filter(pk=document.pk).update(uploaded_at=uploaded_at)
        document.refresh_from_db()
    return document


def make_note(submission: Submission, **kwargs) -> Note:
    n = next(_counter)
    return Note.objects.create(
        submission=submission,
        author_name=kwargs.pop('author_name', f'Author {n}'),
        body=kwargs.pop('body', 'Note body'),
        **kwargs,
    )


def days_ago(days: int):
    return timezone.now() - timedelta(days=days)
