import axios from 'axios';

export type FieldErrors = Record<string, string>;

export interface ApiError {
  /** Message suitable for a snackbar or an error panel. */
  message: string;
  /** Per-field messages, keyed by the serializer field name. */
  fieldErrors: FieldErrors;
}

const GENERIC = 'Something went wrong. Please try again.';

function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

/**
 * Flattens a DRF error body into something the UI can render.
 *
 * DRF answers with `{"detail": "..."}` for request-level problems and
 * `{"field": ["..."]}` for validation, so both shapes have to be handled.
 */
export function parseApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : GENERIC, fieldErrors: {} };
  }

  if (!error.response) {
    return {
      message:
        'Could not reach the API. Check that the Django server is running on http://localhost:8000.',
      fieldErrors: {},
    };
  }

  const { status, data } = error.response;

  if (status === 404) {
    return { message: 'That record no longer exists.', fieldErrors: {} };
  }

  if (typeof data === 'string') {
    return { message: data || GENERIC, fieldErrors: {} };
  }

  if (!data || typeof data !== 'object') {
    return { message: GENERIC, fieldErrors: {} };
  }

  const body = data as Record<string, unknown>;

  const detail = firstString(body.detail);
  if (detail) {
    return { message: detail, fieldErrors: {} };
  }

  const fieldErrors: FieldErrors = {};
  for (const [field, value] of Object.entries(body)) {
    const message = firstString(value);
    if (message) fieldErrors[field] = message;
  }

  const nonField = fieldErrors.non_field_errors;
  delete fieldErrors.non_field_errors;

  const message =
    nonField ??
    (Object.keys(fieldErrors).length > 0 ? 'Please fix the highlighted fields.' : GENERIC);

  return { message, fieldErrors };
}

export function errorMessage(error: unknown): string {
  return parseApiError(error).message;
}
