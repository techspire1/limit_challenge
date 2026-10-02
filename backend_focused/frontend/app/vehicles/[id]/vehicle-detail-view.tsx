'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/app-shell';
import { AsyncSection } from '@/components/async-section';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useFeedback } from '@/components/feedback-provider';
import { errorMessage } from '@/lib/errors';
import { formatCurrency, formatDate, formatDateTime, pluralize } from '@/lib/format';
import {
  useDeleteMaintenanceRecord,
  useDeleteVehicle,
  useVehicle,
  useVehicleAssignments,
} from '@/lib/hooks/use-vehicles';
import type { MaintenanceHistoryEntry } from '@/lib/types';

import { VehicleFormDialog } from '../vehicle-form-dialog';
import { AssignOfficeDialog } from './assign-office-dialog';
import { MaintenanceRecordDialog } from './maintenance-record-dialog';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  /** Names need a smaller type scale than figures or they wrap to three lines. */
  emphasis?: 'metric' | 'text';
}

function StatCard({ label, value, hint, emphasis = 'metric' }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary" display="block" lineHeight={1.4}>
          {label}
        </Typography>
        <Typography
          variant={emphasis === 'metric' ? 'h5' : 'subtitle1'}
          fontWeight={700}
          sx={{ overflowWrap: 'anywhere' }}
        >
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function VehicleDetailView({ vehicleId }: { vehicleId: number }) {
  const router = useRouter();
  const { notify } = useFeedback();

  const vehicle = useVehicle(vehicleId);
  const assignments = useVehicleAssignments(vehicleId);
  const deleteVehicle = useDeleteVehicle();
  const deleteRecord = useDeleteMaintenanceRecord();

  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceHistoryEntry | null>(null);
  const [pendingRecordDelete, setPendingRecordDelete] = useState<MaintenanceHistoryEntry | null>(
    null,
  );
  const [confirmVehicleDelete, setConfirmVehicleDelete] = useState(false);

  const history = useMemo(() => vehicle.data?.maintenance_history ?? [], [vehicle.data]);
  const totalSpend = useMemo(
    () => history.reduce((sum, record) => sum + record.cost, 0),
    [history],
  );

  const openNewRecord = () => {
    setEditingRecord(null);
    setRecordOpen(true);
  };

  const openEditRecord = (record: MaintenanceHistoryEntry) => {
    setEditingRecord(record);
    setRecordOpen(true);
  };

  const handleDeleteRecord = async () => {
    if (!pendingRecordDelete) return;
    try {
      await deleteRecord.mutateAsync(pendingRecordDelete.id);
      notify('Maintenance record deleted.');
      setPendingRecordDelete(null);
    } catch (error) {
      notify(errorMessage(error), 'error');
    }
  };

  const handleDeleteVehicle = async () => {
    try {
      await deleteVehicle.mutateAsync(vehicleId);
      notify('Vehicle deleted.');
      router.push('/vehicles');
    } catch (error) {
      notify(errorMessage(error), 'error');
      setConfirmVehicleDelete(false);
    }
  };

  if (vehicle.isPending || vehicle.isError) {
    return (
      <>
        <Button component={Link} href="/vehicles" sx={{ mb: 2 }}>
          ← Back to vehicles
        </Button>
        <AsyncSection
          isPending={vehicle.isPending}
          isError={vehicle.isError}
          error={vehicle.error}
          onRetry={() => vehicle.refetch()}
          skeletonRows={8}
        >
          {null}
        </AsyncSection>
      </>
    );
  }

  const data = vehicle.data;

  return (
    <>
      <Button component={Link} href="/vehicles" sx={{ mb: 2 }}>
        ← Back to vehicles
      </Button>

      <PageHeader
        title={`${data.year} ${data.make} ${data.model}`}
        description={`VIN ${data.vin} · Plate ${data.license_plate}`}
        actions={
          <>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            <Button onClick={() => setAssignOpen(true)}>Move office</Button>
            <Button variant="contained" onClick={openNewRecord}>
              Log maintenance
            </Button>
            <Button color="error" onClick={() => setConfirmVehicleDelete(true)}>
              Delete
            </Button>
          </>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={data.is_active ? 'Active' : 'Retired'}
                color={data.is_active ? 'success' : 'default'}
                variant={data.is_active ? 'filled' : 'outlined'}
              />
            </Box>
          </CardContent>
        </Card>
        <StatCard label="Office" value={data.office.name} hint={data.office.city} emphasis="text" />
        <StatCard
          label="Lifetime spend"
          value={formatCurrency(totalSpend)}
          hint={pluralize(history.length, 'visit')}
        />
        <StatCard
          label="Last serviced"
          value={formatDate(history[0]?.maintenance_date)}
          hint={history[0]?.maintenance_type_display ?? 'Never serviced'}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Card>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, py: 1.5 }}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              Maintenance history
            </Typography>
            <Button size="small" onClick={openNewRecord}>
              Add record
            </Button>
          </Stack>
          <Divider />
          <Box sx={{ p: 2 }}>
            <AsyncSection
              isPending={false}
              isError={false}
              isEmpty={history.length === 0}
              emptyTitle="No maintenance logged yet"
              emptyDescription="This vehicle has never been serviced."
              emptyAction={
                <Button variant="contained" onClick={openNewRecord}>
                  Log the first service
                </Button>
              }
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Mechanic</TableCell>
                      <TableCell align="right">Cost</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((record) => (
                      <TableRow key={record.id} hover>
                        <TableCell>{formatDate(record.maintenance_date)}</TableCell>
                        <TableCell>
                          {record.maintenance_type_display}
                          {record.notes ? (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {record.notes}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {record.mechanic.name}
                          <Typography variant="caption" color="text.secondary" display="block">
                            {record.mechanic.certification_number}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(record.cost)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button size="small" onClick={() => openEditRecord(record)}>
                              Edit
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setPendingRecordDelete(record)}
                            >
                              Delete
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AsyncSection>
          </Box>
        </Card>

        <Card>
          <Typography variant="subtitle1" fontWeight={700} sx={{ px: 2, py: 1.5 }}>
            Office assignments
          </Typography>
          <Divider />
          <Box sx={{ p: 2 }}>
            <AsyncSection
              isPending={assignments.isPending}
              isError={assignments.isError}
              error={assignments.error}
              onRetry={() => assignments.refetch()}
              isEmpty={(assignments.data?.results.length ?? 0) === 0}
              emptyTitle="No assignment history"
              emptyDescription="This vehicle predates assignment tracking."
              skeletonRows={3}
            >
              <Stack spacing={2}>
                {assignments.data?.results.map((assignment) => (
                  <Box key={assignment.id}>
                    <Typography variant="body2" fontWeight={600}>
                      {assignment.from_office
                        ? `${assignment.from_office.name} → ${assignment.to_office.name}`
                        : `Entered the fleet at ${assignment.to_office.name}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatDateTime(assignment.assigned_at)}
                    </Typography>
                    {assignment.note ? (
                      <Typography variant="caption" color="text.secondary">
                        {assignment.note}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            </AsyncSection>
          </Box>
        </Card>
      </Box>

      <VehicleFormDialog open={editOpen} vehicle={data} onClose={() => setEditOpen(false)} />

      <AssignOfficeDialog
        open={assignOpen}
        vehicleId={vehicleId}
        currentOffice={data.office}
        onClose={() => setAssignOpen(false)}
      />

      <MaintenanceRecordDialog
        open={recordOpen}
        vehicleId={vehicleId}
        record={editingRecord}
        onClose={() => setRecordOpen(false)}
      />

      <ConfirmDialog
        open={pendingRecordDelete !== null}
        title="Delete this record?"
        description={
          pendingRecordDelete
            ? `The ${pendingRecordDelete.maintenance_type_display.toLowerCase()} on ${formatDate(pendingRecordDelete.maintenance_date)} will be removed from the vehicle's history.`
            : ''
        }
        isPending={deleteRecord.isPending}
        onConfirm={handleDeleteRecord}
        onClose={() => setPendingRecordDelete(null)}
      />

      <ConfirmDialog
        open={confirmVehicleDelete}
        title="Delete this vehicle?"
        description={`${data.license_plate} and its ${pluralize(history.length, 'maintenance record')} will be removed. Retiring the vehicle instead keeps the history.`}
        isPending={deleteVehicle.isPending}
        onConfirm={handleDeleteVehicle}
        onClose={() => setConfirmVehicleDelete(false)}
      />
    </>
  );
}
