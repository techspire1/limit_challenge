import type { SubmissionPriority, SubmissionStatus } from './types';

type ChipColor = 'default' | 'info' | 'success' | 'warning' | 'error';

export const STATUS_META: Record<SubmissionStatus, { label: string; color: ChipColor }> = {
  new: { label: 'New', color: 'info' },
  in_review: { label: 'In Review', color: 'warning' },
  closed: { label: 'Closed', color: 'success' },
  lost: { label: 'Lost', color: 'error' },
};

export const PRIORITY_META: Record<SubmissionPriority, { label: string; color: ChipColor }> = {
  high: { label: 'High', color: 'error' },
  medium: { label: 'Medium', color: 'warning' },
  low: { label: 'Low', color: 'default' },
};

export const STATUS_OPTIONS = (Object.keys(STATUS_META) as SubmissionStatus[]).map((value) => ({
  value,
  label: STATUS_META[value].label,
}));

export const PRIORITY_OPTIONS = (Object.keys(PRIORITY_META) as SubmissionPriority[]).map(
  (value) => ({ value, label: PRIORITY_META[value].label }),
);

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

export const DEFAULT_PAGE_SIZE = 10;

/** Matches the backend's `SubmissionPagination.max_page_size`. */
export const MAX_PAGE_SIZE = 100;
