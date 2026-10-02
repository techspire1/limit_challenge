import { Chip } from '@mui/material';

import { PRIORITY_META, STATUS_META } from '@/lib/constants';
import type { SubmissionPriority, SubmissionStatus } from '@/lib/types';

export function StatusChip({ status }: { status: SubmissionStatus }) {
  const meta = STATUS_META[status];
  return <Chip size="small" label={meta?.label ?? status} color={meta?.color ?? 'default'} />;
}

export function PriorityChip({ priority }: { priority: SubmissionPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Chip
      size="small"
      variant="outlined"
      label={meta?.label ?? priority}
      color={meta?.color ?? 'default'}
    />
  );
}
