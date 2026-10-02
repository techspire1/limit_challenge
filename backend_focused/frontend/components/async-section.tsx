'use client';

import { Alert, AlertTitle, Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { errorMessage } from '@/lib/errors';

interface AsyncSectionProps {
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  skeletonRows?: number;
  children: ReactNode;
}

/**
 * Single place where loading, error and empty states are rendered.
 *
 * Every list and panel in the app routes through this so the three states look
 * and behave the same way wherever they appear.
 */
export function AsyncSection({
  isPending,
  isError,
  error,
  onRetry,
  isEmpty = false,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyAction,
  skeletonRows = 4,
  children,
}: AsyncSectionProps) {
  if (isPending) {
    return (
      <Stack spacing={1} sx={{ py: 1 }} aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonRows }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={44} />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      >
        <AlertTitle>Could not load this data</AlertTitle>
        {errorMessage(error)}
      </Alert>
    );
  }

  if (isEmpty) {
    return (
      <Box
        sx={{
          py: 6,
          px: 3,
          textAlign: 'center',
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          {emptyTitle}
        </Typography>
        {emptyDescription ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {emptyDescription}
          </Typography>
        ) : null}
        {emptyAction ? <Box sx={{ mt: 2 }}>{emptyAction}</Box> : null}
      </Box>
    );
  }

  return <>{children}</>;
}
