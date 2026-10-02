"""Queryset builders for the submission endpoints.

Both list and detail run in a fixed number of queries regardless of how many
related rows a submission has, which is what keeps the workspace responsive as
the dataset grows.
"""

from django.db.models import Case, Count, IntegerField, OuterRef, Prefetch, QuerySet, Subquery, When

from .models import Contact, Document, Note, Submission

# Newest first, with id as the tie-breaker so rows seeded in the same instant
# still resolve to one deterministic "latest" note.
_LATEST_NOTE = Note.objects.filter(submission=OuterRef('pk')).order_by('-created_at', '-id')

# Sorting on the raw column would order high/low/medium alphabetically.
_PRIORITY_RANK = Case(
    When(priority=Submission.Priority.HIGH, then=0),
    When(priority=Submission.Priority.MEDIUM, then=1),
    When(priority=Submission.Priority.LOW, then=2),
    default=3,
    output_field=IntegerField(),
)


def submission_list_queryset() -> QuerySet[Submission]:
    """List rows with their related counts and a preview of the newest note.

    The counts use `distinct=True` on purpose: joining documents and notes in
    one query multiplies the rows, so a plain `Count` would report
    `documents x notes` for both columns instead of the real totals.
    """
    return (
        Submission.objects.select_related('company', 'broker', 'owner')
        .annotate(
            document_count=Count('documents', distinct=True),
            note_count=Count('notes', distinct=True),
            latest_note_author=Subquery(_LATEST_NOTE.values('author_name')[:1]),
            latest_note_body=Subquery(_LATEST_NOTE.values('body')[:1]),
            latest_note_created_at=Subquery(_LATEST_NOTE.values('created_at')[:1]),
            priority_rank=_PRIORITY_RANK,
        )
        .order_by('-created_at', '-id')
    )


def submission_detail_queryset() -> QuerySet[Submission]:
    """A single submission with every related collection prefetched.

    Four prefetches plus the row itself, so a submission with hundreds of notes
    costs the same number of queries as one with three.
    """
    return Submission.objects.select_related('company', 'broker', 'owner').prefetch_related(
        Prefetch('contacts', queryset=Contact.objects.order_by('name', 'id')),
        Prefetch('documents', queryset=Document.objects.order_by('-uploaded_at', '-id')),
        Prefetch('notes', queryset=Note.objects.order_by('-created_at', '-id')),
    )
