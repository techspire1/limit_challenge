'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { mechanicsApi } from '../api';
import { queryKeys } from '../query-keys';
import type { Mechanic } from '../types';

type MechanicInput = Omit<Mechanic, 'id'>;

export function useMechanics(params: { is_active?: string } = {}) {
  const query = { page_size: 200, ...params };

  return useQuery({
    queryKey: queryKeys.mechanics.list(query),
    queryFn: () => mechanicsApi.list(query),
    staleTime: 60_000,
  });
}

export function useMechanicWorkload() {
  return useQuery({
    queryKey: queryKeys.mechanics.workload(),
    queryFn: mechanicsApi.workload,
  });
}

export function useSaveMechanic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: MechanicInput & { id?: number }) =>
      id ? mechanicsApi.update(id, payload) : mechanicsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mechanics.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
    },
  });
}

export function useDeleteMechanic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mechanicsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mechanics.all });
    },
  });
}
