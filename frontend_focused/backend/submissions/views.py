"""Read-only endpoints for the submission workspace.

The dataset is broker-submitted and reviewed elsewhere, so this API only reads.
Writes would need an auth story that the challenge leaves out of scope.
"""

from django.utils.cache import add_never_cache_headers
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets

from .filters import SubmissionFilter, SubmissionOrderingFilter
from .models import Broker
from .pagination import SubmissionPagination
from .selectors import submission_detail_queryset, submission_list_queryset
from .serializers import BrokerSerializer, SubmissionDetailSerializer, SubmissionListSerializer


class NeverCacheMixin:
    """Marks API responses as uncacheable.

    Without any `Cache-Control` header, browsers are free to heuristically
    cache these GETs, which would show an operations manager a submission's
    state from some earlier point in the day.
    """

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        add_never_cache_headers(response)
        return response


class SubmissionViewSet(NeverCacheMixin, viewsets.ReadOnlyModelViewSet):
    """`GET /api/submissions/` and `GET /api/submissions/<id>/`.

    The two actions use different querysets: the list needs aggregates across
    many rows, the detail needs the full related collections for one row.
    Serving either from a single queryset would mean paying for both.
    """

    pagination_class = SubmissionPagination
    filter_backends = [DjangoFilterBackend, SubmissionOrderingFilter]
    filterset_class = SubmissionFilter

    def get_queryset(self):
        if self.action == 'retrieve':
            return submission_detail_queryset()
        return submission_list_queryset()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SubmissionDetailSerializer
        return SubmissionListSerializer


class BrokerViewSet(NeverCacheMixin, viewsets.ReadOnlyModelViewSet):
    """`GET /api/brokers/`, unpaginated because it populates a filter dropdown.

    Five brokers in the seed data and a naturally small set in practice; paging
    it would just force the frontend to loop to build one `<select>`.
    """

    queryset = Broker.objects.all()
    serializer_class = BrokerSerializer
    pagination_class = None
