"""Ordering for the submission list, exposed under camelCase aliases."""

from rest_framework.filters import OrderingFilter


class SubmissionOrderingFilter(OrderingFilter):
    """Maps `?ordering=` values onto ORM expressions.

    Aliasing rather than exposing ORM paths keeps the query string stable if the
    models move, and lets `priority` sort by urgency instead of alphabetically
    (see `priority_rank` in `selectors`): ascending puts High first.
    """

    ALIASES = {
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
        'company': 'company__legal_name',
        'broker': 'broker__name',
        'owner': 'owner__full_name',
        'status': 'status',
        'priority': 'priority_rank',
        'documentCount': 'document_count',
        'noteCount': 'note_count',
        'latestNoteAt': 'latest_note_created_at',
    }

    def remove_invalid_fields(self, queryset, fields, view, request):
        ordering = []
        for field in fields:
            descending = field.startswith('-')
            target = self.ALIASES.get(field.lstrip('-'))
            if target is None:
                continue
            ordering.append(f'-{target}' if descending else target)

        if ordering:
            # None of the sortable columns are unique, and a non-deterministic
            # order lets rows repeat or vanish between pages.
            ordering.append('-id')

        return ordering
