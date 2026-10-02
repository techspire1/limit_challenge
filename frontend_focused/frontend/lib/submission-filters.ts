/**
 * The URL query string is the single source of truth for list state.
 *
 * Filters, paging and sorting all live there, so a filtered view can be
 * bookmarked, shared with a colleague, reloaded, or reached with the back
 * button. These helpers are pure functions in both directions, which keeps the
 * React layer free of parsing logic.
 */

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PRIORITY_META, STATUS_META } from './constants';
import type {
  SortDirection,
  SubmissionListFilters,
  SubmissionPriority,
  SubmissionSortField,
  SubmissionStatus,
} from './types';

export const DEFAULT_SORT_BY: SubmissionSortField = 'createdAt';
export const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

const SORT_FIELDS: SubmissionSortField[] = [
  'createdAt',
  'company',
  'broker',
  'owner',
  'status',
  'priority',
  'documentCount',
  'noteCount',
  'latestNoteAt',
];

/** Columns where the useful first click is "most recent"/"most" rather than "least". */
const DESCENDING_FIRST: SubmissionSortField[] = [
  'createdAt',
  'latestNoteAt',
  'documentCount',
  'noteCount',
];

/** The filters a user sets, as opposed to paging and sorting. */
const FILTER_KEYS = [
  'status',
  'priority',
  'brokerId',
  'companySearch',
  'createdFrom',
  'createdTo',
  'hasDocuments',
  'hasNotes',
] as const satisfies readonly (keyof SubmissionListFilters)[];

export type SubmissionFilterKey = (typeof FILTER_KEYS)[number];

export function parseFilters(params: URLSearchParams): SubmissionListFilters {
  const filters: SubmissionListFilters = {};

  const status = params.get('status');
  if (status && status in STATUS_META) {
    filters.status = status as SubmissionStatus;
  }

  const priority = params.get('priority');
  if (priority && priority in PRIORITY_META) {
    filters.priority = priority as SubmissionPriority;
  }

  const brokerId = params.get('brokerId');
  if (brokerId && /^\d+$/.test(brokerId)) {
    filters.brokerId = brokerId;
  }

  const companySearch = params.get('companySearch')?.trim();
  if (companySearch) {
    filters.companySearch = companySearch;
  }

  for (const key of ['createdFrom', 'createdTo'] as const) {
    const value = params.get(key);
    // Anything else would just be rejected by the API with a 400.
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      filters[key] = value;
    }
  }

  for (const key of ['hasDocuments', 'hasNotes'] as const) {
    const value = params.get(key);
    if (value === 'true') filters[key] = true;
    if (value === 'false') filters[key] = false;
  }

  const page = Number(params.get('page'));
  if (Number.isInteger(page) && page > 1) {
    filters.page = page;
  }

  const pageSize = Number(params.get('pageSize'));
  if (Number.isInteger(pageSize) && pageSize > 0) {
    filters.pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  }

  const sortBy = params.get('sortBy') as SubmissionSortField | null;
  if (sortBy && SORT_FIELDS.includes(sortBy)) {
    filters.sortBy = sortBy;
  }

  const sortDirection = params.get('sortDirection');
  if (sortDirection === 'asc' || sortDirection === 'desc') {
    filters.sortDirection = sortDirection;
  }

  return filters;
}

/**
 * Only non-default values are written, so the common case stays a clean
 * `/submissions` instead of a URL restating every default.
 */
export function filtersToSearchParams(filters: SubmissionListFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.brokerId) params.set('brokerId', filters.brokerId);
  if (filters.companySearch) params.set('companySearch', filters.companySearch);
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) params.set('createdTo', filters.createdTo);
  if (filters.hasDocuments !== undefined) params.set('hasDocuments', String(filters.hasDocuments));
  if (filters.hasNotes !== undefined) params.set('hasNotes', String(filters.hasNotes));
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('pageSize', String(filters.pageSize));
  }
  if (filters.sortBy && filters.sortBy !== DEFAULT_SORT_BY) {
    params.set('sortBy', filters.sortBy);
  }
  if (filters.sortDirection && filters.sortDirection !== DEFAULT_SORT_DIRECTION) {
    params.set('sortDirection', filters.sortDirection);
  }

  return params;
}

/** Translates list state into the query parameters the API expects. */
export function filtersToApiParams(filters: SubmissionListFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.status) params.status = filters.status;
  if (filters.priority) params.priority = filters.priority;
  if (filters.brokerId) params.brokerId = filters.brokerId;
  if (filters.companySearch) params.companySearch = filters.companySearch;
  if (filters.createdFrom) params.createdFrom = filters.createdFrom;
  if (filters.createdTo) params.createdTo = filters.createdTo;
  if (filters.hasDocuments !== undefined) params.hasDocuments = String(filters.hasDocuments);
  if (filters.hasNotes !== undefined) params.hasNotes = String(filters.hasNotes);

  params.page = String(filters.page ?? 1);
  params.pageSize = String(filters.pageSize ?? DEFAULT_PAGE_SIZE);

  const sortBy = filters.sortBy ?? DEFAULT_SORT_BY;
  const direction = filters.sortDirection ?? DEFAULT_SORT_DIRECTION;
  params.ordering = direction === 'desc' ? `-${sortBy}` : sortBy;

  return params;
}

export function countActiveFilters(filters: SubmissionListFilters): number {
  return FILTER_KEYS.filter((key) => filters[key] !== undefined && filters[key] !== '').length;
}

export function hasActiveFilters(filters: SubmissionListFilters): boolean {
  return countActiveFilters(filters) > 0;
}

/** Drops the filters but keeps how the user is looking at the list. */
export function withoutFilters(filters: SubmissionListFilters): SubmissionListFilters {
  const next = { ...filters };
  for (const key of FILTER_KEYS) {
    delete next[key];
  }
  delete next.page;
  return next;
}

export function nextSortDirection(
  field: SubmissionSortField,
  current: { sortBy: SubmissionSortField; sortDirection: SortDirection },
): SortDirection {
  if (current.sortBy === field) {
    return current.sortDirection === 'asc' ? 'desc' : 'asc';
  }
  return DESCENDING_FIRST.includes(field) ? 'desc' : 'asc';
}

export function resolveSort(filters: SubmissionListFilters): {
  sortBy: SubmissionSortField;
  sortDirection: SortDirection;
} {
  return {
    sortBy: filters.sortBy ?? DEFAULT_SORT_BY,
    sortDirection: filters.sortDirection ?? DEFAULT_SORT_DIRECTION,
  };
}
