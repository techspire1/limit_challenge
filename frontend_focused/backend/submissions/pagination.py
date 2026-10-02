from rest_framework.pagination import PageNumberPagination


class SubmissionPagination(PageNumberPagination):
    """Lets the client pick a page size so the table's rows-per-page control works.

    Capped so a stray `?pageSize=100000` cannot ask the database for everything.
    """

    page_size_query_param = 'pageSize'
    max_page_size = 100
