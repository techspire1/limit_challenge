'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useEffect, useMemo, useState } from 'react';

import { useBrokerOptions } from '@/lib/hooks/useBrokerOptions';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { PRIORITY_META, PRIORITY_OPTIONS, STATUS_META, STATUS_OPTIONS } from '@/lib/constants';
import { describeApiError } from '@/lib/errors';
import type { SubmissionFilterKey } from '@/lib/submission-filters';
import type { SubmissionListFilters, SubmissionPriority, SubmissionStatus } from '@/lib/types';

interface SubmissionFiltersProps {
  filters: SubmissionListFilters;
  activeFilterCount: number;
  onChange: (patch: Partial<SubmissionListFilters>) => void;
  onClearFilter: (key: SubmissionFilterKey) => void;
  onClearAll: () => void;
}

/** `''` is "no preference"; the API only hears about the other two. */
const TRISTATE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export function SubmissionFilters({
  filters,
  activeFilterCount,
  onChange,
  onClearFilter,
  onClearAll,
}: SubmissionFiltersProps) {
  const brokers = useBrokerOptions();

  const committedSearch = filters.companySearch ?? '';
  const [searchText, setSearchText] = useState(committedSearch);
  const debouncedSearch = useDebouncedValue(searchText);

  // Typing updates the URL once the user pauses, so every keystroke does not
  // become a request and a history write.
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === committedSearch) return;
    onChange({ companySearch: trimmed || undefined });
  }, [debouncedSearch, committedSearch, onChange]);

  // Keeps the box in step when the state changes from outside, such as "Clear
  // all" or landing on a URL that already carries a search term.
  useEffect(() => {
    setSearchText(committedSearch);
  }, [committedSearch]);

  const invalidRange = Boolean(
    filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo,
  );

  const brokerName = useMemo(
    () => brokers.data?.find((broker) => String(broker.id) === filters.brokerId)?.name,
    [brokers.data, filters.brokerId],
  );

  return (
    <Card>
      <CardContent sx={{ pb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
          }}
        >
          <TextField
            label="Search company"
            placeholder="Name, industry or city"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchText ? (
                  <InputAdornment position="end">
                    <Tooltip title="Clear search">
                      <ClearRoundedIcon
                        fontSize="small"
                        onClick={() => setSearchText('')}
                        sx={{ cursor: 'pointer', color: 'text.secondary' }}
                      />
                    </Tooltip>
                  </InputAdornment>
                ) : null,
              },
            }}
          />

          <TextField
            select
            label="Status"
            value={filters.status ?? ''}
            onChange={(event) =>
              onChange({ status: (event.target.value as SubmissionStatus) || undefined })
            }
          >
            <MenuItem value="">All statuses</MenuItem>
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Priority"
            value={filters.priority ?? ''}
            onChange={(event) =>
              onChange({ priority: (event.target.value as SubmissionPriority) || undefined })
            }
          >
            <MenuItem value="">All priorities</MenuItem>
            {PRIORITY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Broker"
            value={brokers.data ? (filters.brokerId ?? '') : ''}
            onChange={(event) => onChange({ brokerId: event.target.value || undefined })}
            disabled={brokers.isPending || brokers.isError}
            error={brokers.isError}
            helperText={
              brokers.isError
                ? describeApiError(brokers.error)
                : brokers.isPending
                  ? 'Loading brokers…'
                  : undefined
            }
          >
            <MenuItem value="">All brokers</MenuItem>
            {brokers.data?.map((broker) => (
              <MenuItem key={broker.id} value={String(broker.id)}>
                {broker.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Has documents"
            value={filters.hasDocuments === undefined ? '' : String(filters.hasDocuments)}
            onChange={(event) =>
              onChange({
                hasDocuments: event.target.value === '' ? undefined : event.target.value === 'true',
              })
            }
          >
            {TRISTATE_OPTIONS.map((option) => (
              <MenuItem key={option.label} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Created from"
            type="date"
            value={filters.createdFrom ?? ''}
            onChange={(event) => onChange({ createdFrom: event.target.value || undefined })}
            slotProps={{ inputLabel: { shrink: true } }}
            error={invalidRange}
          />

          <TextField
            label="Created to"
            type="date"
            value={filters.createdTo ?? ''}
            onChange={(event) => onChange({ createdTo: event.target.value || undefined })}
            slotProps={{ inputLabel: { shrink: true } }}
            error={invalidRange}
            helperText={invalidRange ? 'The end date is before the start date.' : undefined}
          />

          <TextField
            select
            label="Has notes"
            value={filters.hasNotes === undefined ? '' : String(filters.hasNotes)}
            onChange={(event) =>
              onChange({
                hasNotes: event.target.value === '' ? undefined : event.target.value === 'true',
              })
            }
          >
            {TRISTATE_OPTIONS.map((option) => (
              <MenuItem key={option.label} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </CardContent>

      {activeFilterCount > 0 ? (
        <>
          <Divider />
          {/* A summary of what is narrowing the list, so a surprising result
              count never looks like missing data. */}
          <CardContent sx={{ py: 1.5 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              sx={{ flexWrap: 'wrap' }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                Filtering by
              </Typography>

              {filters.companySearch ? (
                <Chip
                  size="small"
                  label={`Company: ${filters.companySearch}`}
                  onDelete={() => onClearFilter('companySearch')}
                />
              ) : null}
              {filters.status ? (
                <Chip
                  size="small"
                  label={`Status: ${STATUS_META[filters.status].label}`}
                  onDelete={() => onClearFilter('status')}
                />
              ) : null}
              {filters.priority ? (
                <Chip
                  size="small"
                  label={`Priority: ${PRIORITY_META[filters.priority].label}`}
                  onDelete={() => onClearFilter('priority')}
                />
              ) : null}
              {filters.brokerId ? (
                <Chip
                  size="small"
                  label={`Broker: ${brokerName ?? filters.brokerId}`}
                  onDelete={() => onClearFilter('brokerId')}
                />
              ) : null}
              {filters.createdFrom ? (
                <Chip
                  size="small"
                  label={`From: ${filters.createdFrom}`}
                  onDelete={() => onClearFilter('createdFrom')}
                />
              ) : null}
              {filters.createdTo ? (
                <Chip
                  size="small"
                  label={`To: ${filters.createdTo}`}
                  onDelete={() => onClearFilter('createdTo')}
                />
              ) : null}
              {filters.hasDocuments !== undefined ? (
                <Chip
                  size="small"
                  label={filters.hasDocuments ? 'Has documents' : 'No documents'}
                  onDelete={() => onClearFilter('hasDocuments')}
                />
              ) : null}
              {filters.hasNotes !== undefined ? (
                <Chip
                  size="small"
                  label={filters.hasNotes ? 'Has notes' : 'No notes'}
                  onDelete={() => onClearFilter('hasNotes')}
                />
              ) : null}

              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={onClearAll} startIcon={<ClearRoundedIcon />}>
                Clear all
              </Button>
            </Stack>
          </CardContent>
        </>
      ) : null}
    </Card>
  );
}
