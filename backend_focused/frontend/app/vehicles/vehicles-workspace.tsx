'use client';

import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/components/app-shell';
import { AsyncSection } from '@/components/async-section';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useFeedback } from '@/components/feedback-provider';
import { errorMessage } from '@/lib/errors';
import { useVehicleFilters } from '@/lib/hooks/use-vehicle-filters';
import { useDeleteVehicle, useVehicleSearch } from '@/lib/hooks/use-vehicles';
import { pluralize } from '@/lib/format';
import type { Vehicle } from '@/lib/types';

import { VehicleFiltersPanel } from './vehicle-filters-panel';
import { VehicleFormDialog } from './vehicle-form-dialog';

export function VehiclesWorkspace() {
  const { filters, searchQuery, setFilters, reset, activeFilterCount } = useVehicleFilters();
  const search = useVehicleSearch(searchQuery);
  const deleteVehicle = useDeleteVehicle();
  const { notify } = useFeedback();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Vehicle | null>(null);

  const results = search.data?.results ?? [];
  const total = search.data?.count ?? 0;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteVehicle.mutateAsync(pendingDelete.id);
      notify(`${pendingDelete.license_plate} removed from the fleet.`);
      setPendingDelete(null);
    } catch (error) {
      notify(errorMessage(error), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Search the fleet by office, status, make, model, or service history."
        actions={
          <Button variant="contained" onClick={openCreate}>
            Add vehicle
          </Button>
        }
      />

      <VehicleFiltersPanel
        filters={filters}
        activeFilterCount={activeFilterCount}
        onChange={setFilters}
        onReset={reset}
      />

      <Card>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 2, py: 1.5 }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {search.isPending ? 'Searching…' : `${pluralize(total, 'vehicle')} found`}
          </Typography>
          {search.isFetching && !search.isPending ? (
            <Typography variant="caption" color="text.secondary">
              Updating…
            </Typography>
          ) : null}
        </Stack>

        <Box sx={{ px: 2, pb: 2 }}>
          <AsyncSection
            isPending={search.isPending}
            isError={search.isError}
            error={search.error}
            onRetry={() => search.refetch()}
            isEmpty={results.length === 0}
            emptyTitle="No vehicles match these filters"
            emptyDescription={
              activeFilterCount > 0
                ? 'Try widening the date range or clearing a filter.'
                : 'Add the first vehicle to get started.'
            }
            emptyAction={
              activeFilterCount > 0 ? (
                <Button onClick={reset}>Clear all filters</Button>
              ) : (
                <Button variant="contained" onClick={openCreate}>
                  Add vehicle
                </Button>
              )
            }
            skeletonRows={6}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>VIN</TableCell>
                    <TableCell>Plate</TableCell>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>Office</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((vehicle) => (
                    <TableRow key={vehicle.id} hover>
                      <TableCell sx={{ fontFamily: 'var(--font-geist-mono), monospace' }}>
                        <Link href={`/vehicles/${vehicle.id}`}>{vehicle.vin}</Link>
                      </TableCell>
                      <TableCell>{vehicle.license_plate}</TableCell>
                      <TableCell>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </TableCell>
                      <TableCell>
                        {vehicle.office_name}
                        <Typography variant="caption" color="text.secondary" display="block">
                          {vehicle.office_city}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={vehicle.is_active ? 'Active' : 'Retired'}
                          color={vehicle.is_active ? 'success' : 'default'}
                          variant={vehicle.is_active ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button size="small" component={Link} href={`/vehicles/${vehicle.id}`}>
                            View
                          </Button>
                          <Button size="small" onClick={() => openEdit(vehicle)}>
                            Edit
                          </Button>
                          <Tooltip title="Delete vehicle and its maintenance history">
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={`Delete ${vehicle.license_plate}`}
                              onClick={() => setPendingDelete(vehicle)}
                            >
                              ×
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={total}
              page={filters.page - 1}
              onPageChange={(_, page) => setFilters({ page: page + 1 })}
              rowsPerPage={filters.page_size}
              rowsPerPageOptions={[10, 25, 50]}
              onRowsPerPageChange={(event) =>
                setFilters({ page_size: event.target.value, page: 1 })
              }
            />
          </AsyncSection>
        </Box>
      </Card>

      <VehicleFormDialog open={formOpen} vehicle={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this vehicle?"
        description={
          pendingDelete
            ? `${pendingDelete.year} ${pendingDelete.make} ${pendingDelete.model} (${pendingDelete.license_plate}) and its entire maintenance history will be removed. Retiring the vehicle instead keeps the history.`
            : ''
        }
        isPending={deleteVehicle.isPending}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
