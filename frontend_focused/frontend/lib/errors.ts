import { AxiosError } from 'axios';

/**
 * Turns anything thrown by the API layer into a sentence worth showing a user.
 *
 * DRF reports filter problems as `{ field: ["message"] }`, which is precise but
 * unreadable, so those are surfaced as "Field: message". A failed request with
 * no response at all almost always means the Django server is not running,
 * which is the single most likely cause during local development.
 */
export function describeApiError(error: unknown): string {
  if (!(error instanceof AxiosError)) {
    return error instanceof Error ? error.message : 'Something went wrong.';
  }

  if (!error.response) {
    return 'Could not reach the API. Check that the Django server is running on port 8000.';
  }

  const { status, data } = error.response;

  if (status === 404) {
    return 'That submission no longer exists.';
  }

  if (status >= 500) {
    return 'The API returned a server error. Check the Django logs for details.';
  }

  if (data && typeof data === 'object') {
    const messages = Object.entries(data as Record<string, unknown>).map(([field, value]) => {
      const text = Array.isArray(value) ? value.join(' ') : String(value);
      return field === 'detail' ? text : `${humanizeField(field)}: ${text}`;
    });
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  return error.message || 'The request failed.';
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 404;
}

function humanizeField(field: string): string {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
