'use client';

import {
  Box,
  Button,
  Card,
  Fade,
  LinearProgress,
  Stack,
  TablePagination,
  Typography,
} from '@mui/material';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import { useCallback } from 'react';

import { EmptyState, ErrorState } from '@/components/common/StateViews';
import { SubmissionFilters } from './SubmissionFilters';
import { SubmissionTable, SubmissionTableSkeleton } from './SubmissionTable';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/constants';
import { useSubmissionFilters } from '@/lib/hooks/useSubmissionFilters';
import { useSubmissionsList } from '@/lib/hooks/useSubmissions';
import { nextSortDirection, resolveSort } from '@/lib/submission-filters';
import { pluralize } from '@/lib/format';
import type { SubmissionSortField } from '@/lib/types';

export function SubmissionsWorkspace() {
  const { filters, queryString, activeFilterCount, setFilters, clearFilter, clearAllFilters } =
    useSubmissionFilters();

  const query = useSubmissionsList(filters);
  const sort = resolveSort(filters);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  const handleSort = useCallback(
    (field: SubmissionSortField) =>
      setFilters({ sortBy: field, sortDirection: nextSortDirection(field, sort) }),
    [setFilters, sort],
  );

  const submissions = query.data?.results ?? [];
  const total = query.data?.count ?? 0;

  // `isPending` is only true with no cached data at all; afterwards
  // `keepPreviousData` holds the last page on screen while the next loads.
  const showSkeleton = query.isPending;
  const isRefreshing = query.isFetching && !query.isPending;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'flex-end' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h4" component="h1">
            Submissions
          </Typography>
          <Typography color="text.secondary">
            Review broker-submitted opportunities and open one for the full history.
          </Typography>
        </Box>

        {query.data ? (
          <Typography variant="body2" color="text.secondary">
            {activeFilterCount > 0
              ? `${pluralize(total, 'match', 'matches')} for the current filters`
              : pluralize(total, 'submission')}
          </Typography>
        ) : null}
      </Stack>

      <SubmissionFilters
        filters={filters}
        activeFilterCount={activeFilterCount}
        onChange={setFilters}
        onClearFilter={clearFilter}
        onClearAll={clearAllFilters}
      />

      <Card>
        {/* A thin bar keeps refetches visible without the table jumping. */}
        <Box sx={{ height: 4 }}>
          <Fade in={isRefreshing} unmountOnExit>
            <LinearProgress sx={{ height: 4 }} />
          </Fade>
        </Box>

        {showSkeleton ? (
          <Box sx={{ overflowX: 'auto' }}>
            <SubmissionTableSkeleton rows={Math.min(pageSize, 6)} />
          </Box>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            title="Could not load submissions"
            onRetry={() => query.refetch()}
          />
        ) : submissions.length === 0 ? (
          // Distinguishing the two cases matters: one is a dead end the user
          // created, the other means the database is empty.
          activeFilterCount > 0 ? (
            <EmptyState
              title="No submissions match these filters"
              description="Try widening the date range or clearing a filter to see more results."
              action={
                <Button variant="outlined" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<InboxRoundedIcon sx={{ fontSize: 44 }} />}
              title="No submissions yet"
              description="Seed the backend with `python manage.py seed_submissions` to populate the workspace."
            />
          )
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <SubmissionTable
                submissions={submissions}
                sortBy={sort.sortBy}
                sortDirection={sort.sortDirection}
                onSort={handleSort}
                listQueryString={queryString}
              />
            </Box>
            <TablePagination
              component="div"
              count={total}
              page={page - 1}
              rowsPerPage={pageSize}
              rowsPerPageOptions={PAGE_SIZE_OPTIONS}
              onPageChange={(_, zeroBasedPage) => setFilters({ page: zeroBasedPage + 1 })}
              onRowsPerPageChange={(event) => setFilters({ pageSize: Number(event.target.value) })}
              sx={{ borderTop: 1, borderColor: 'divider' }}
            />
          </>
        )}
      </Card>
    </Stack>
  );
}
