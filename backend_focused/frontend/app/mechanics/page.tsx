'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
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
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/app-shell';
import { AsyncSection } from '@/components/async-section';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useFeedback } from '@/components/feedback-provider';
import { errorMessage } from '@/lib/errors';
import { useFormErrors } from '@/lib/hooks/use-form-errors';
import { formatCurrency } from '@/lib/format';
import { useDeleteMechanic, useMechanicWorkload, useSaveMechanic } from '@/lib/hooks/use-mechanics';
import type { Mechanic, MechanicWorkload } from '@/lib/types';

interface FormDialogProps {
  open: boolean;
  mechanic: Mechanic | null;
  onClose: () => void;
}

function MechanicFormDialog({ open, mechanic, onClose }: FormDialogProps) {
  const saveMechanic = useSaveMechanic();

  return (
    <Dialog
      open={open}
      onClose={saveMechanic.isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      {/* MUI unmounts dialog children on close, so the form starts fresh on each
          open without an effect that syncs state back from props. */}
      <MechanicForm mechanic={mechanic} save={saveMechanic} onClose={onClose} />
    </Dialog>
  );
}

interface MechanicFormProps {
  mechanic: Mechanic | null;
  save: ReturnType<typeof useSaveMechanic>;
  onClose: () => void;
}

function MechanicForm({ mechanic, save, onClose }: MechanicFormProps) {
  const isEdit = mechanic !== null;
  const { notify } = useFeedback();

  const [name, setName] = useState(mechanic?.name ?? '');
  const [certification, setCertification] = useState(mechanic?.certification_number ?? '');
  const [isActive, setIsActive] = useState(mechanic?.is_active ?? true);
  const { fieldErrors, formError, showError, clearField, reset } = useFormErrors();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    reset();

    try {
      await save.mutateAsync({
        id: mechanic?.id,
        name: name.trim(),
        certification_number: certification.trim(),
        is_active: isActive,
      });
      notify(isEdit ? 'Mechanic updated.' : 'Mechanic added.');
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogTitle>{isEdit ? 'Edit mechanic' : 'New mechanic'}</DialogTitle>
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
            label="Certification number"
            required
            value={certification}
            onChange={(event) => {
              setCertification(event.target.value);
              clearField('certification_number');
            }}
            error={Boolean(fieldErrors.certification_number)}
            helperText={fieldErrors.certification_number ?? 'Must be unique'}
          />
          <FormControlLabel
            control={
              <Switch checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            }
            label={isActive ? 'Active' : 'Inactive'}
          />
          {!isActive ? (
            <Alert severity="info">
              Inactive mechanics keep their history but cannot be assigned new work.
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={save.isPending}>
          {isEdit ? 'Save changes' : 'Add mechanic'}
        </Button>
      </DialogActions>
    </form>
  );
}

export default function MechanicsPage() {
  const workload = useMechanicWorkload();
  const deleteMechanic = useDeleteMechanic();
  const { notify } = useFeedback();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MechanicWorkload | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  const mechanics = useMemo(
    () => (workload.data ?? []).filter((mechanic) => showInactive || mechanic.is_active),
    [workload.data, showInactive],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMechanic.mutateAsync(pendingDelete.id);
      notify(`${pendingDelete.name} deleted.`);
      setPendingDelete(null);
    } catch (error) {
      // Mechanics with maintenance history answer 409.
      notify(errorMessage(error), 'error');
      setPendingDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Mechanics"
        description="Workload is counted for the current calendar year, busiest first."
        actions={
          <Button
            variant="contained"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New mechanic
          </Button>
        }
      />

      <Card>
        <Stack direction="row" justifyContent="flex-end" sx={{ px: 2, pt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
            }
            label={<Typography variant="body2">Show inactive</Typography>}
          />
        </Stack>

        <Box sx={{ p: 2, pt: 0 }}>
          <AsyncSection
            isPending={workload.isPending}
            isError={workload.isError}
            error={workload.error}
            onRetry={() => workload.refetch()}
            isEmpty={mechanics.length === 0}
            emptyTitle="No mechanics to show"
            emptyDescription={
              showInactive
                ? 'Add a mechanic to start logging maintenance.'
                : 'All mechanics are inactive.'
            }
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Certification</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Jobs this year</TableCell>
                    <TableCell align="right">Value this year</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mechanics.map((mechanic) => (
                    <TableRow key={mechanic.id} hover>
                      <TableCell>{mechanic.name}</TableCell>
                      <TableCell>
                        <Link
                          href={`/vehicles?mechanic_certification_number=${mechanic.certification_number}`}
                        >
                          {mechanic.certification_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={mechanic.is_active ? 'Active' : 'Inactive'}
                          color={mechanic.is_active ? 'success' : 'default'}
                          variant={mechanic.is_active ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right">{mechanic.maintenance_count_current_year}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(mechanic.maintenance_cost_current_year)}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button
                            size="small"
                            onClick={() => {
                              setEditing(mechanic);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setPendingDelete(mechanic)}
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

      <MechanicFormDialog open={formOpen} mechanic={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this mechanic?"
        description={
          pendingDelete
            ? `${pendingDelete.name} will be removed. Mechanics with maintenance history cannot be deleted — mark them inactive instead.`
            : ''
        }
        isPending={deleteMechanic.isPending}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
