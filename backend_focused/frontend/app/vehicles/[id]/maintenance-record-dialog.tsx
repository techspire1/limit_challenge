'use client';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';

import { useFeedback } from '@/components/feedback-provider';
import { todayAsInputValue } from '@/lib/format';
import { useFormErrors } from '@/lib/hooks/use-form-errors';
import { useMechanics } from '@/lib/hooks/use-mechanics';
import { useSaveMaintenanceRecord } from '@/lib/hooks/use-vehicles';
import { MAINTENANCE_TYPES, type MaintenanceHistoryEntry, type MaintenanceType } from '@/lib/types';

type SaveRecordMutation = ReturnType<typeof useSaveMaintenanceRecord>;

interface FormState {
  mechanic: string;
  maintenance_date: string;
  maintenance_type: MaintenanceType;
  cost: string;
  notes: string;
}

function toFormState(record: MaintenanceHistoryEntry | null): FormState {
  if (!record) {
    return {
      mechanic: '',
      maintenance_date: todayAsInputValue(),
      maintenance_type: 'oil_change',
      cost: '',
      notes: '',
    };
  }

  return {
    mechanic: String(record.mechanic.id),
    maintenance_date: record.maintenance_date,
    maintenance_type: record.maintenance_type,
    cost: String(record.cost),
    notes: record.notes,
  };
}

interface Props {
  open: boolean;
  vehicleId: number;
  record: MaintenanceHistoryEntry | null;
  onClose: () => void;
}

export function MaintenanceRecordDialog({ open, vehicleId, record, onClose }: Props) {
  const saveRecord = useSaveMaintenanceRecord();

  return (
    <Dialog
      open={open}
      onClose={saveRecord.isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <MaintenanceRecordForm
        vehicleId={vehicleId}
        record={record}
        save={saveRecord}
        onClose={onClose}
      />
    </Dialog>
  );
}

interface FormProps {
  vehicleId: number;
  record: MaintenanceHistoryEntry | null;
  save: SaveRecordMutation;
  onClose: () => void;
}

function MaintenanceRecordForm({ vehicleId, record, save, onClose }: FormProps) {
  const isEdit = record !== null;
  // Retired mechanics keep their history but cannot be given new work, so the
  // picker only offers active ones.
  const mechanics = useMechanics({ is_active: 'true' });
  const { notify } = useFeedback();

  const [form, setForm] = useState<FormState>(() => toFormState(record));
  const { fieldErrors, formError, showError, clearField, reset } = useFormErrors();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    clearField(key);
  };

  // An unselected mechanic would post as pk 0 and come back as a raw "Invalid
  // pk" message, so the submit waits until there is something to send.
  const isComplete = form.mechanic !== '' && form.cost !== '';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    reset();

    try {
      await save.mutateAsync({
        id: record?.id,
        vehicle: vehicleId,
        mechanic: Number(form.mechanic),
        maintenance_date: form.maintenance_date,
        maintenance_type: form.maintenance_type,
        cost: form.cost,
        notes: form.notes,
      });

      notify(isEdit ? 'Maintenance record updated.' : 'Maintenance logged.');
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogTitle>{isEdit ? 'Edit maintenance record' : 'Log maintenance'}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            }}
          >
            <TextField
              select
              label="Mechanic"
              required
              value={form.mechanic}
              onChange={(event) => update('mechanic', event.target.value)}
              disabled={mechanics.isPending}
              error={Boolean(fieldErrors.mechanic)}
              helperText={fieldErrors.mechanic ?? 'Active mechanics only'}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            >
              {(mechanics.data?.results ?? []).map((mechanic) => (
                <MenuItem key={mechanic.id} value={String(mechanic.id)}>
                  {mechanic.name} — {mechanic.certification_number}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="date"
              label="Date"
              required
              value={form.maintenance_date}
              onChange={(event) => update('maintenance_date', event.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayAsInputValue() } }}
              error={Boolean(fieldErrors.maintenance_date)}
              helperText={fieldErrors.maintenance_date ?? 'Cannot be in the future'}
            />

            <TextField
              label="Cost"
              required
              type="number"
              value={form.cost}
              onChange={(event) => update('cost', event.target.value)}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                },
                htmlInput: { min: 0, step: '0.01' },
              }}
              error={Boolean(fieldErrors.cost)}
              helperText={fieldErrors.cost ?? ' '}
            />

            <TextField
              select
              label="Type"
              required
              value={form.maintenance_type}
              onChange={(event) =>
                update('maintenance_type', event.target.value as MaintenanceType)
              }
              error={Boolean(fieldErrors.maintenance_type)}
              helperText={fieldErrors.maintenance_type ?? ' '}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            >
              {MAINTENANCE_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <TextField
            label="Notes"
            multiline
            minRows={3}
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            error={Boolean(fieldErrors.notes)}
            helperText={fieldErrors.notes ?? 'Optional'}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={save.isPending} disabled={!isComplete}>
          {isEdit ? 'Save changes' : 'Log maintenance'}
        </Button>
      </DialogActions>
    </form>
  );
}
