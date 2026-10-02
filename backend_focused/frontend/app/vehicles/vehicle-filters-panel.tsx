'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useDebouncedField } from '@/lib/hooks/use-debounced-field';
import { useMechanics } from '@/lib/hooks/use-mechanics';
import { useOffices } from '@/lib/hooks/use-offices';
import type { VehicleFilters } from '@/lib/hooks/use-vehicle-filters';

const ORDERING_OPTIONS = [
  { value: 'vin', label: 'VIN (A–Z)' },
  { value: 'license_plate', label: 'License plate (A–Z)' },
  { value: 'make', label: 'Make (A–Z)' },
  { value: 'model', label: 'Model (A–Z)' },
  { value: '-year', label: 'Year (newest first)' },
  { value: 'year', label: 'Year (oldest first)' },
];

interface Props {
  filters: VehicleFilters;
  activeFilterCount: number;
  onChange: (updates: Partial<Record<keyof VehicleFilters, string | number>>) => void;
  onReset: () => void;
}

export function VehicleFiltersPanel({ filters, activeFilterCount, onChange, onReset }: Props) {
  const offices = useOffices();
  const mechanics = useMechanics();

  const [makeDraft, setMakeDraft] = useDebouncedField(filters.make, (make) => onChange({ make }));
  const [modelDraft, setModelDraft] = useDebouncedField(filters.model, (model) =>
    onChange({ model }),
  );

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
          gap={1}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              Filters
            </Typography>
            {activeFilterCount > 0 ? (
              <Chip size="small" color="primary" label={`${activeFilterCount} active`} />
            ) : null}
          </Stack>
          <Button size="small" onClick={onReset} disabled={activeFilterCount === 0}>
            Clear all
          </Button>
        </Stack>

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
            select
            label="Office"
            value={filters.office}
            onChange={(event) => onChange({ office: event.target.value })}
            disabled={offices.isPending || offices.isError}
            helperText={offices.isError ? 'Could not load offices' : ' '}
            error={offices.isError}
          >
            <MenuItem value="">All offices</MenuItem>
            {offices.data?.results.map((office) => (
              <MenuItem key={office.id} value={String(office.id)}>
                {office.name} — {office.city}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            value={filters.is_active}
            onChange={(event) => onChange({ is_active: event.target.value })}
            helperText=" "
          >
            <MenuItem value="">Active and inactive</MenuItem>
            <MenuItem value="true">Active only</MenuItem>
            <MenuItem value="false">Inactive only</MenuItem>
          </TextField>

          <TextField
            label="Make"
            placeholder="e.g. Ford"
            value={makeDraft}
            onChange={(event) => setMakeDraft(event.target.value)}
            helperText="Partial match"
          />

          <TextField
            label="Model"
            placeholder="e.g. Transit"
            value={modelDraft}
            onChange={(event) => setModelDraft(event.target.value)}
            helperText="Partial match"
          />

          <TextField
            type="date"
            label="Serviced from"
            value={filters.maintenance_from}
            onChange={(event) => onChange({ maintenance_from: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText=" "
          />

          <TextField
            type="date"
            label="Serviced to"
            value={filters.maintenance_to}
            onChange={(event) => onChange({ maintenance_to: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText=" "
          />

          <TextField
            select
            label="Serviced by"
            value={filters.mechanic_certification_number}
            onChange={(event) => onChange({ mechanic_certification_number: event.target.value })}
            disabled={mechanics.isPending || mechanics.isError}
            helperText="Matches the same visit as the date range"
            error={mechanics.isError}
          >
            <MenuItem value="">Any mechanic</MenuItem>
            {mechanics.data?.results.map((mechanic) => (
              <MenuItem key={mechanic.id} value={mechanic.certification_number}>
                {mechanic.name} — {mechanic.certification_number}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Sort by"
            value={filters.ordering}
            onChange={(event) => onChange({ ordering: event.target.value })}
            helperText=" "
          >
            {ORDERING_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </CardContent>
    </Card>
  );
}
