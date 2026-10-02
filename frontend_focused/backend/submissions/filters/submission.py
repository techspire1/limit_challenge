"""Filters backing the submission list.

Every parameter is optional and they compose, so the frontend can map its filter
bar straight onto the query string.

The attribute names are camelCase because django-filter uses them verbatim as
query parameter names, and the frontend's contract (`brokerId`,
`companySearch`, ...) is camelCase throughout.
"""

from django.db.models import Exists, OuterRef, Q
from django_filters import rest_framework as filters

from ..models import Document, Note, Submission


class SubmissionFilter(filters.FilterSet):
    status = filters.ChoiceFilter(choices=Submission.Status.choices)
    priority = filters.ChoiceFilter(choices=Submission.Priority.choices)

    brokerId = filters.NumberFilter(field_name='broker_id')
    ownerId = filters.NumberFilter(field_name='owner_id')

    companySearch = filters.CharFilter(method='filter_company_search')

    # `created_at` is a datetime, so compare on the date part: `createdTo`
    # otherwise means "midnight that day" and silently drops the whole day.
    createdFrom = filters.DateFilter(field_name='created_at', lookup_expr='date__gte')
    createdTo = filters.DateFilter(field_name='created_at', lookup_expr='date__lte')

    hasDocuments = filters.BooleanFilter(method='filter_has_documents')
    hasNotes = filters.BooleanFilter(method='filter_has_notes')

    class Meta:
        model = Submission
        fields = []

    def filter_company_search(self, queryset, name, value):
        """Matches the company a manager is likely thinking of.

        Searching the industry and city as well as the legal name means
        "Chicago" or "Manufacturing" find their submissions too, which is what
        people reach for in practice.
        """
        term = value.strip()
        if not term:
            return queryset

        return queryset.filter(
            Q(company__legal_name__icontains=term)
            | Q(company__industry__icontains=term)
            | Q(company__headquarters_city__icontains=term)
        )

    def filter_has_documents(self, queryset, name, value):
        return self._filter_by_existence(queryset, Document, value)

    def filter_has_notes(self, queryset, name, value):
        return self._filter_by_existence(queryset, Note, value)

    @staticmethod
    def _filter_by_existence(queryset, related_model, value):
        """`EXISTS` rather than a join, which would duplicate rows and need `distinct`."""
        exists = Exists(related_model.objects.filter(submission=OuterRef('pk')))
        return queryset.filter(exists) if value else queryset.exclude(exists)
