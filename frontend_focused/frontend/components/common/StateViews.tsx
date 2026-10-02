import { Box, Button, Stack, Typography } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import type { ReactNode } from 'react';

import { describeApiError } from '@/lib/errors';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Stack spacing={1.5} alignItems="center" sx={{ py: 7, px: 3, textAlign: 'center' }}>
      <Box sx={{ color: 'text.disabled', display: 'flex' }}>
        {icon ?? <SearchOffRoundedIcon sx={{ fontSize: 44 }} />}
      </Box>
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ pt: 1 }}>{action}</Box> : null}
    </Stack>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** Shown above the specific message to say which part of the page failed. */
  title?: string;
}

/**
 * Failures are shown in place with the reason and a retry, rather than as a
 * toast that disappears before it can be read.
 */
export function ErrorState({
  error,
  onRetry,
  title = 'Could not load this view',
}: ErrorStateProps) {
  return (
    <Stack spacing={1.5} alignItems="center" sx={{ py: 7, px: 3, textAlign: 'center' }}>
      <ErrorOutlineRoundedIcon color="error" sx={{ fontSize: 44 }} />
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
        {describeApiError(error)}
      </Typography>
      {onRetry ? (
        <Box sx={{ pt: 1 }}>
          <Button variant="outlined" onClick={onRetry}>
            Try again
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}
