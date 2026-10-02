'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  countActiveFilters,
  filtersToSearchParams,
  parseFilters,
  withoutFilters,
  type SubmissionFilterKey,
} from '@/lib/submission-filters';
import type { SubmissionListFilters } from '@/lib/types';

/** Changing these should send the user back to the first page of results. */
const PAGE_RESETTING_KEYS = new Set<keyof SubmissionListFilters>([
  'status',
  'priority',
  'brokerId',
  'companySearch',
  'createdFrom',
  'createdTo',
  'hasDocuments',
  'hasNotes',
  'pageSize',
]);

/**
 * Reads and writes the list's filter state through the URL.
 *
 * Navigation uses `replace` so a session of filter tweaking leaves one history
 * entry rather than twenty, and back still returns where the user came from.
 */
export function useSubmissionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryString = searchParams.toString();

  const filters = useMemo(() => parseFilters(new URLSearchParams(queryString)), [queryString]);

  const navigate = useCallback(
    (next: SubmissionListFilters) => {
      const params = filtersToSearchParams(next).toString();
      router.replace(params ? `${pathname}?${params}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (patch: Partial<SubmissionListFilters>) => {
      const next: SubmissionListFilters = { ...filters, ...patch };

      // Page 7 of an unfiltered list is page 7 of nothing once a filter lands.
      if (Object.keys(patch).some((key) => PAGE_RESETTING_KEYS.has(key as never))) {
        delete next.page;
      }

      // `undefined` in a patch means "remove this filter".
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) {
          delete next[key as keyof SubmissionListFilters];
        }
      }

      navigate(next);
    },
    [filters, navigate],
  );

  const clearFilter = useCallback(
    (key: SubmissionFilterKey) => setFilters({ [key]: undefined }),
    [setFilters],
  );

  const clearAllFilters = useCallback(() => navigate(withoutFilters(filters)), [filters, navigate]);

  return {
    filters,
    /** The current query string, for links that should preserve the list view. */
    queryString,
    activeFilterCount: countActiveFilters(filters),
    setFilters,
    clearFilter,
    clearAllFilters,
  };
}
