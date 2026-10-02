import { apiClient } from './api-client';
import type {
  DuplicateCheck,
  MaintenanceRecord,
  MaintenanceRecordInput,
  Mechanic,
  MechanicWorkload,
  Office,
  OfficeSummary,
  Paginated,
  Vehicle,
  VehicleAssignment,
  VehicleDetail,
  VehicleInput,
  VehicleNeedingMaintenance,
  VehicleSearchParams,
} from './types';

/** Strips empty values so the URL never carries `?make=&model=`. */
export function cleanParams(params: object): Record<string, string> {
  return Object.entries(params).reduce<Record<string, string>>((result, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = String(value);
    }
    return result;
  }, {});
}

export const officesApi = {
  list: async (params: { page?: number; page_size?: number } = {}) =>
    (await apiClient.get<Paginated<Office>>('/offices/', { params: cleanParams(params) })).data,
  summary: async () => (await apiClient.get<OfficeSummary[]>('/offices/summary/')).data,
  create: async (payload: Omit<Office, 'id'>) =>
    (await apiClient.post<Office>('/offices/', payload)).data,
  update: async (id: number, payload: Omit<Office, 'id'>) =>
    (await apiClient.put<Office>(`/offices/${id}/`, payload)).data,
  remove: async (id: number) => {
    await apiClient.delete(`/offices/${id}/`);
  },
};

export const mechanicsApi = {
  list: async (params: { is_active?: string; page?: number; page_size?: number } = {}) =>
    (await apiClient.get<Paginated<Mechanic>>('/mechanics/', { params: cleanParams(params) })).data,
  workload: async () => (await apiClient.get<MechanicWorkload[]>('/mechanics/workload/')).data,
  create: async (payload: Omit<Mechanic, 'id'>) =>
    (await apiClient.post<Mechanic>('/mechanics/', payload)).data,
  update: async (id: number, payload: Omit<Mechanic, 'id'>) =>
    (await apiClient.put<Mechanic>(`/mechanics/${id}/`, payload)).data,
  remove: async (id: number) => {
    await apiClient.delete(`/mechanics/${id}/`);
  },
};

export const vehiclesApi = {
  search: async (params: VehicleSearchParams) =>
    (await apiClient.get<Paginated<Vehicle>>('/vehicles/', { params: cleanParams(params) })).data,
  detail: async (id: number) => (await apiClient.get<VehicleDetail>(`/vehicles/${id}/`)).data,
  create: async (payload: VehicleInput) =>
    (await apiClient.post<Vehicle>('/vehicles/', payload)).data,
  update: async (id: number, payload: VehicleInput) =>
    (await apiClient.put<Vehicle>(`/vehicles/${id}/`, payload)).data,
  remove: async (id: number) => {
    await apiClient.delete(`/vehicles/${id}/`);
  },
  needsMaintenance: async (params: { page?: number; page_size?: number } = {}) =>
    (
      await apiClient.get<Paginated<VehicleNeedingMaintenance>>('/vehicles/needs-maintenance/', {
        params: cleanParams(params),
      })
    ).data,
  assignments: async (id: number) =>
    (await apiClient.get<Paginated<VehicleAssignment>>(`/vehicles/${id}/assignments/`)).data,
  assignOffice: async (id: number, payload: { office: number; note?: string }) =>
    (await apiClient.post<Vehicle>(`/vehicles/${id}/assign-office/`, payload)).data,
  duplicateCheck: async (params: { vin?: string; license_plate?: string; exclude_id?: number }) =>
    (
      await apiClient.get<DuplicateCheck>('/vehicles/duplicate-check/', {
        params: cleanParams(params),
      })
    ).data,
};

export const maintenanceApi = {
  create: async (payload: MaintenanceRecordInput) =>
    (await apiClient.post<MaintenanceRecord>('/maintenance-records/', payload)).data,
  update: async (id: number, payload: MaintenanceRecordInput) =>
    (await apiClient.put<MaintenanceRecord>(`/maintenance-records/${id}/`, payload)).data,
  remove: async (id: number) => {
    await apiClient.delete(`/maintenance-records/${id}/`);
  },
};
