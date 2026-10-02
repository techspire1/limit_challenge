'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { maintenanceApi, vehiclesApi } from '../api';
import { queryKeys } from '../query-keys';
import type { MaintenanceRecordInput, VehicleInput, VehicleSearchParams } from '../types';

export function useVehicleSearch(params: VehicleSearchParams) {
  return useQuery({
    queryKey: queryKeys.vehicles.search(params),
    queryFn: () => vehiclesApi.search(params),
    // Keeps the current page on screen while the next one loads, so paging and
    // filtering do not flash an empty table.
    placeholderData: keepPreviousData,
  });
}

export function useVehicle(id: number) {
  return useQuery({
    queryKey: queryKeys.vehicles.detail(id),
    queryFn: () => vehiclesApi.detail(id),
    enabled: Number.isFinite(id),
  });
}

export function useVehicleAssignments(id: number) {
  return useQuery({
    queryKey: queryKeys.vehicles.assignments(id),
    queryFn: () => vehiclesApi.assignments(id),
    enabled: Number.isFinite(id),
  });
}

export function useVehiclesNeedingMaintenance(params: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.vehicles.needsMaintenance(params),
    queryFn: () => vehiclesApi.needsMaintenance(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Warns about VIN / plate clashes while the user is still typing, instead of
 * waiting for a failed submit. Disabled until there is something worth checking.
 */
export function useDuplicateCheck(params: {
  vin?: string;
  license_plate?: string;
  exclude_id?: number;
}) {
  const hasInput = Boolean(params.vin || params.license_plate);

  return useQuery({
    queryKey: queryKeys.vehicles.duplicateCheck(params),
    queryFn: () => vehiclesApi.duplicateCheck(params),
    enabled: hasInput,
    staleTime: 30_000,
  });
}

export function useSaveVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: VehicleInput & { id?: number }) =>
      id ? vehiclesApi.update(id, payload) : vehiclesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.offices.summary() });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => vehiclesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.offices.summary() });
    },
  });
}

export function useAssignOffice(vehicleId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { office: number; note?: string }) =>
      vehiclesApi.assignOffice(vehicleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.offices.summary() });
    },
  });
}

export function useSaveMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: MaintenanceRecordInput & { id?: number }) =>
      id ? maintenanceApi.update(id, payload) : maintenanceApi.create(payload),
    onSuccess: () => {
      invalidateMaintenanceViews(queryClient);
    },
  });
}

export function useDeleteMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => maintenanceApi.remove(id),
    onSuccess: () => {
      invalidateMaintenanceViews(queryClient);
    },
  });
}

/** Maintenance feeds the office spend, mechanic workload and overdue reports. */
function invalidateMaintenanceViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.offices.summary() });
  queryClient.invalidateQueries({ queryKey: queryKeys.mechanics.workload() });
}
