from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Turn referential-integrity failures into 409s instead of 500s.

    Offices and mechanics are referenced with ``on_delete=PROTECT`` so history is
    never silently destroyed; deleting one that is still in use is a conflict the
    client can act on, not a server fault.
    """
    if isinstance(exc, ProtectedError):
        return Response(
            {
                "detail": (
                    "This record is still referenced by other records and cannot "
                    "be deleted. Deactivate it instead, or remove the dependent "
                    "records first."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )

    return drf_exception_handler(exc, context)
