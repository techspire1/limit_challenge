'use client';

import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { filtersToApiParams } from '@/lib/submission-filters';
import type {
  PaginatedResponse,
  SubmissionDetail,
  SubmissionListFilters,
  SubmissionListItem,
} from '@/lib/types';

const SUBMISSIONS_QUERY_KEY = 'submissions';

async function fetchSubmissions(filters: SubmissionListFilters) {
  const response = await apiClient.get<PaginatedResponse<SubmissionListItem>>('/submissions/', {
    params: filtersToApiParams(filters),
  });
  return response.data;
}

async function fetchSubmissionDetail(id: string | number) {
  const response = await apiClient.get<SubmissionDetail>(`/submissions/${id}/`);
  return response.data;
}

export function useSubmissionsList(filters: SubmissionListFilters) {
  return useQuery({
    // The API params rather than the raw filters, so two states that produce
    // the same request share one cache entry.
    queryKey: [SUBMISSIONS_QUERY_KEY, 'list', filtersToApiParams(filters)] as QueryKey,
    queryFn: () => fetchSubmissions(filters),
    // Keeps the previous page on screen while the next one loads, instead of
    // collapsing the table to an empty state on every filter keystroke.
    placeholderData: keepPreviousData,
  });
}

export function useSubmissionDetail(id: string | number) {
  return useQuery({
    queryKey: [SUBMISSIONS_QUERY_KEY, 'detail', String(id)],
    queryFn: () => fetchSubmissionDetail(id),
    enabled: Boolean(id),
    staleTime: 60_000,
    // A missing or malformed id will never succeed on retry.
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
