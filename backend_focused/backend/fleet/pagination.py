from rest_framework.pagination import PageNumberPagination


class FleetPagination(PageNumberPagination):
    """Lets the client size pages, with a ceiling so one request cannot pull the
    whole maintenance table into memory."""

    page_size_query_param = "page_size"
    max_page_size = 200
