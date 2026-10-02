'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { VehicleSearchParams } from '../types';

export interface VehicleFilters {
  office: string;
  is_active: string;
  make: string;
  model: string;
  maintenance_from: string;
  maintenance_to: string;
  mechanic_certification_number: string;
  ordering: string;
  page: number;
  page_size: number;
}

export const DEFAULT_PAGE_SIZE = 10;

const EMPTY_FILTERS: VehicleFilters = {
  office: '',
  is_active: '',
  make: '',
  model: '',
  maintenance_from: '',
  maintenance_to: '',
  mechanic_certification_number: '',
  ordering: 'vin',
  page: 1,
  page_size: DEFAULT_PAGE_SIZE,
};

/** Filter keys that should send the user back to page 1 when they change. */
const NARROWING_KEYS = [
  'office',
  'is_active',
  'make',
  'model',
  'maintenance_from',
  'maintenance_to',
  'mechanic_certification_number',
] as const satisfies readonly (keyof VehicleFilters)[];

/**
 * The URL is the single source of truth for the search state.
 *
 * Keeping it there rather than in component state means a filtered view can be
 * bookmarked, shared and reached with the browser's back button, and React Query
 * caches each distinct search separately for free.
 */
export function useVehicleFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<VehicleFilters>(() => {
    const read = (key: string) => searchParams.get(key) ?? '';
    const page = Number(searchParams.get('page'));
    const pageSize = Number(searchParams.get('page_size'));

    return {
      office: read('office'),
      is_active: read('is_active'),
      make: read('make'),
      model: read('model'),
      maintenance_from: read('maintenance_from'),
      maintenance_to: read('maintenance_to'),
      mechanic_certification_number: read('mechanic_certification_number'),
      ordering: read('ordering') || EMPTY_FILTERS.ordering,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      page_size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    };
  }, [searchParams]);

  const write = useCallback(
    (updates: Partial<Record<keyof VehicleFilters, string | number>>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === '' || value === undefined) next.delete(key);
        else next.set(key, String(value));
      }

      // Page 7 of the old result set is meaningless once the filters change.
      if (NARROWING_KEYS.some((key) => key in updates)) next.delete('page');

      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  const activeFilterCount = useMemo(
    () => NARROWING_KEYS.filter((key) => filters[key] !== '').length,
    [filters],
  );

  /** What actually goes to the API — defaults and empties are dropped by `cleanParams`. */
  const searchQuery = useMemo<VehicleSearchParams>(
    () => ({
      office: filters.office,
      is_active: filters.is_active,
      make: filters.make,
      model: filters.model,
      maintenance_from: filters.maintenance_from,
      maintenance_to: filters.maintenance_to,
      mechanic_certification_number: filters.mechanic_certification_number,
      ordering: filters.ordering,
      page: filters.page,
      page_size: filters.page_size,
    }),
    [filters],
  );

  return { filters, searchQuery, setFilters: write, reset, activeFilterCount };
}
