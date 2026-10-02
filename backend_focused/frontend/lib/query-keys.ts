import type { VehicleSearchParams } from './types';

/**
 * Keys are nested so a mutation can invalidate a whole entity with one call,
 * e.g. `queryKeys.vehicles.all` covers every search, detail and report view.
 */
export const queryKeys = {
  offices: {
    all: ['offices'] as const,
    list: (params: Record<string, unknown>) => ['offices', 'list', params] as const,
    summary: () => ['offices', 'summary'] as const,
  },
  mechanics: {
    all: ['mechanics'] as const,
    list: (params: Record<string, unknown>) => ['mechanics', 'list', params] as const,
    workload: () => ['mechanics', 'workload'] as const,
  },
  vehicles: {
    all: ['vehicles'] as const,
    search: (params: VehicleSearchParams) => ['vehicles', 'search', params] as const,
    detail: (id: number) => ['vehicles', 'detail', id] as const,
    assignments: (id: number) => ['vehicles', 'assignments', id] as const,
    needsMaintenance: (params: Record<string, unknown>) =>
      ['vehicles', 'needs-maintenance', params] as const,
    duplicateCheck: (params: Record<string, unknown>) =>
      ['vehicles', 'duplicate-check', params] as const,
  },
};
