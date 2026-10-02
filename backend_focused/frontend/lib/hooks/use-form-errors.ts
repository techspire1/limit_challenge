'use client';

import { useCallback, useState } from 'react';

import { parseApiError, type FieldErrors } from '../errors';

/**
 * Holds the feedback from a rejected submit: a summary message plus the
 * per-field messages.
 *
 * Both describe the values the server saw, so editing any field clears them
 * rather than leaving stale complaints next to corrected inputs.
 */
export function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const showError = useCallback((error: unknown) => {
    const parsed = parseApiError(error);
    setFieldErrors(parsed.fieldErrors);
    setFormError(parsed.message);
  }, []);

  const reset = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
  }, []);

  const clearField = useCallback((field: string) => {
    setFormError(null);
    setFieldErrors((previous) => {
      if (!(field in previous)) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }, []);

  return { fieldErrors, formError, showError, clearField, reset };
}
