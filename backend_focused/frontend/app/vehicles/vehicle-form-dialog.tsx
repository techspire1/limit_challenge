'use client';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useState } from 'react';

import { useFeedback } from '@/components/feedback-provider';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-field';
import { useFormErrors } from '@/lib/hooks/use-form-errors';
import { useOffices } from '@/lib/hooks/use-offices';
import { useDuplicateCheck, useSaveVehicle } from '@/lib/hooks/use-vehicles';
import type { Vehicle, VehicleDetail } from '@/lib/types';

type AnyVehicle = Vehicle | VehicleDetail;
type SaveVehicleMutation = ReturnType<typeof useSaveVehicle>;

interface FormState {
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: string;
  office: string;
  is_active: boolean;
}

function toFormState(vehicle: AnyVehicle | null): FormState {
  if (!vehicle) {
    return {
      vin: '',
      license_plate: '',
      make: '',
      model: '',
      year: String(new Date().getFullYear()),
      office: '',
      is_active: true,
    };
  }

  const officeId = typeof vehicle.office === 'number' ? vehicle.office : vehicle.office.id;

  return {
    vin: vehicle.vin,
    license_plate: vehicle.license_plate,
    make: vehicle.make,
    model: vehicle.model,
    year: String(vehicle.year),
    office: String(officeId),
    is_active: vehicle.is_active,
  };
}

interface Props {
  open: boolean;
  vehicle: AnyVehicle | null;
  onClose: () => void;
  onSaved?: (vehicle: Vehicle) => void;
}

export function VehicleFormDialog({ open, vehicle, onClose, onSaved }: Props) {
  const saveVehicle = useSaveVehicle();

  return (
    <Dialog
      open={open}
      onClose={saveVehicle.isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      {/* MUI unmounts dialog children on close, so the form starts fresh on each
          open without an effect that syncs state back from props. */}
      <VehicleForm vehicle={vehicle} save={saveVehicle} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

interface FormProps {
  vehicle: AnyVehicle | null;
  save: SaveVehicleMutation;
  onClose: () => void;
  onSaved?: (vehicle: Vehicle) => void;
}

function VehicleForm({ vehicle, save, onClose, onSaved }: FormProps) {
  const isEdit = vehicle !== null;
  const offices = useOffices();
  const { notify } = useFeedback();

  const [form, setForm] = useState<FormState>(() => toFormState(vehicle));
  const { fieldErrors, formError, showError, clearField, reset } = useFormErrors();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    clearField(key);
  };

  // Warn about clashes while typing rather than after a rejected submit.
  const debouncedVin = useDebouncedValue(form.vin.trim());
  const debouncedPlate = useDebouncedValue(form.license_plate.trim());
  const duplicates = useDuplicateCheck({
    vin: debouncedVin,
    license_plate: form.is_active ? debouncedPlate : '',
    exclude_id: vehicle?.id,
  });
  const conflicts = duplicates.data?.conflicts ?? [];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    reset();

    try {
      const saved = await save.mutateAsync({
        id: vehicle?.id,
        vin: form.vin.trim(),
        license_plate: form.license_plate.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        office: Number(form.office),
        is_active: form.is_active,
      });

      notify(isEdit ? 'Vehicle updated.' : 'Vehicle added to the fleet.');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogTitle>{isEdit ? 'Edit vehicle' : 'Add vehicle'}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}

          {conflicts.length > 0 ? (
            <Alert severity="warning">
              {conflicts.includes('vin') && conflicts.includes('license_plate')
                ? 'Both this VIN and this license plate already belong to another vehicle.'
                : conflicts.includes('vin')
                  ? 'Another vehicle already uses this VIN.'
                  : 'Another active vehicle already uses this license plate.'}
            </Alert>
          ) : null}

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            }}
          >
            <TextField
              label="VIN"
              required
              value={form.vin}
              onChange={(event) => update('vin', event.target.value)}
              error={Boolean(fieldErrors.vin) || conflicts.includes('vin')}
              helperText={fieldErrors.vin ?? '11–17 characters, no I, O or Q'}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />

            <TextField
              label="License plate"
              required
              value={form.license_plate}
              onChange={(event) => update('license_plate', event.target.value)}
              error={Boolean(fieldErrors.license_plate) || conflicts.includes('license_plate')}
              helperText={fieldErrors.license_plate ?? 'Unique among active vehicles'}
            />

            <TextField
              label="Year"
              type="number"
              required
              value={form.year}
              onChange={(event) => update('year', event.target.value)}
              error={Boolean(fieldErrors.year)}
              helperText={fieldErrors.year ?? ' '}
            />

            <TextField
              label="Make"
              required
              value={form.make}
              onChange={(event) => update('make', event.target.value)}
              error={Boolean(fieldErrors.make)}
              helperText={fieldErrors.make ?? ' '}
            />

            <TextField
              label="Model"
              required
              value={form.model}
              onChange={(event) => update('model', event.target.value)}
              error={Boolean(fieldErrors.model)}
              helperText={fieldErrors.model ?? ' '}
            />

            <TextField
              select
              label="Office"
              required
              value={form.office}
              onChange={(event) => update('office', event.target.value)}
              disabled={offices.isPending}
              error={Boolean(fieldErrors.office)}
              helperText={fieldErrors.office ?? ' '}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            >
              {(offices.data?.results ?? []).map((office) => (
                <MenuItem key={office.id} value={String(office.id)}>
                  {office.name} — {office.city}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={form.is_active}
                onChange={(event) => update('is_active', event.target.checked)}
              />
            }
            label={form.is_active ? 'Active' : 'Retired'}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={save.isPending}>
          {isEdit ? 'Save changes' : 'Add vehicle'}
        </Button>
      </DialogActions>
    </form>
  );
}
