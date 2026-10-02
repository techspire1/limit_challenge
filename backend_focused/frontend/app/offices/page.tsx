'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/components/app-shell';
import { AsyncSection } from '@/components/async-section';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useFeedback } from '@/components/feedback-provider';
import { errorMessage } from '@/lib/errors';
import { useFormErrors } from '@/lib/hooks/use-form-errors';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDeleteOffice, useOfficeSummary, useSaveOffice } from '@/lib/hooks/use-offices';
import type { Office, OfficeSummary } from '@/lib/types';

interface FormDialogProps {
  open: boolean;
  office: Office | null;
  onClose: () => void;
}

function OfficeFormDialog({ open, office, onClose }: FormDialogProps) {
  const saveOffice = useSaveOffice();

  return (
    <Dialog
      open={open}
      onClose={saveOffice.isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      {/* MUI unmounts dialog children on close, so the form starts fresh on each
          open without an effect that syncs state back from props. */}
      <OfficeForm office={office} save={saveOffice} onClose={onClose} />
    </Dialog>
  );
}

interface OfficeFormProps {
  office: Office | null;
  save: ReturnType<typeof useSaveOffice>;
  onClose: () => void;
}

function OfficeForm({ office, save, onClose }: OfficeFormProps) {
  const isEdit = office !== null;
  const { notify } = useFeedback();

  const [name, setName] = useState(office?.name ?? '');
  const [city, setCity] = useState(office?.city ?? '');
  const { fieldErrors, formError, showError, clearField, reset } = useFormErrors();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    reset();

    try {
      await save.mutateAsync({ id: office?.id, name: name.trim(), city: city.trim() });
      notify(isEdit ? 'Office updated.' : 'Office created.');
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogTitle>{isEdit ? 'Edit office' : 'New office'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}
          <TextField
            label="Name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearField('name');
            }}
            error={Boolean(fieldErrors.name)}
            helperText={fieldErrors.name ?? ' '}
          />
          <TextField
            label="City"
            required
            value={city}
            onChange={(event) => {
              setCity(event.target.value);
              clearField('city');
            }}
            error={Boolean(fieldErrors.city)}
            helperText={fieldErrors.city ?? ' '}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={save.isPending}>
          {isEdit ? 'Save changes' : 'Create office'}
        </Button>
      </DialogActions>
    </form>
  );
}

export default function OfficesPage() {
  const summary = useOfficeSummary();
  const deleteOffice = useDeleteOffice();
  const { notify } = useFeedback();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Office | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OfficeSummary | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteOffice.mutateAsync(pendingDelete.id);
      notify(`${pendingDelete.name} deleted.`);
      setPendingDelete(null);
    } catch (error) {
      // An office holding vehicles answers 409; the message explains why.
      notify(errorMessage(error), 'error');
      setPendingDelete(null);
    }
  };

  const offices = summary.data ?? [];

  return (
    <>
      <PageHeader
        title="Offices"
        description="Depots that hold vehicles, with their active fleet and rolling 12-month maintenance spend."
        actions={
          <Button variant="contained" onClick={openCreate}>
            New office
          </Button>
        }
      />

      <Card>
        <Box sx={{ p: 2 }}>
          <AsyncSection
            isPending={summary.isPending}
            isError={summary.isError}
            error={summary.error}
            onRetry={() => summary.refetch()}
            isEmpty={offices.length === 0}
            emptyTitle="No offices yet"
            emptyDescription="Vehicles must belong to an office, so start here."
            emptyAction={
              <Button variant="contained" onClick={openCreate}>
                New office
              </Button>
            }
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>City</TableCell>
                    <TableCell align="right">Active vehicles</TableCell>
                    <TableCell align="right">Spend (12 mo)</TableCell>
                    <TableCell align="right">Last maintenance</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {offices.map((office) => (
                    <TableRow key={office.id} hover>
                      <TableCell>{office.name}</TableCell>
                      <TableCell>{office.city}</TableCell>
                      <TableCell align="right">
                        {office.active_vehicle_count > 0 ? (
                          <Link href={`/vehicles?office=${office.id}&is_active=true`}>
                            {office.active_vehicle_count}
                          </Link>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            0
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(office.maintenance_cost_last_year)}
                      </TableCell>
                      <TableCell align="right">{formatDate(office.last_maintenance)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button
                            size="small"
                            onClick={() => {
                              setEditing(office);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setPendingDelete(office)}
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

      <OfficeFormDialog open={formOpen} office={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this office?"
        description={
          pendingDelete
            ? `${pendingDelete.name} will be removed. Offices that still hold vehicles cannot be deleted.`
            : ''
        }
        isPending={deleteOffice.isPending}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
