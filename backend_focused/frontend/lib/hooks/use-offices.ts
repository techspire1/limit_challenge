'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { officesApi } from '../api';
import { queryKeys } from '../query-keys';
import type { Office } from '../types';

type OfficeInput = Omit<Office, 'id'>;

/** Offices drive several dropdowns, so the whole (small) list is fetched at once. */
export function useOffices() {
  return useQuery({
    queryKey: queryKeys.offices.list({ page_size: 200 }),
    queryFn: () => officesApi.list({ page_size: 200 }),
    staleTime: 60_000,
  });
}

export function useOfficeSummary() {
  return useQuery({
    queryKey: queryKeys.offices.summary(),
    queryFn: officesApi.summary,
  });
}

export function useSaveOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: OfficeInput & { id?: number }) =>
      id ? officesApi.update(id, payload) : officesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offices.all });
      // Vehicle rows carry the office name, so they go stale on a rename.
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
    },
  });
}

export function useDeleteOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => officesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offices.all });
    },
  });
}
