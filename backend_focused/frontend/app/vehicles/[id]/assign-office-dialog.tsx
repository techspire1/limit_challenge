'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';

import { useFeedback } from '@/components/feedback-provider';
import { useFormErrors } from '@/lib/hooks/use-form-errors';
import { useOffices } from '@/lib/hooks/use-offices';
import { useAssignOffice } from '@/lib/hooks/use-vehicles';
import type { Office } from '@/lib/types';

type AssignOfficeMutation = ReturnType<typeof useAssignOffice>;

interface Props {
  open: boolean;
  vehicleId: number;
  currentOffice: Office;
  onClose: () => void;
}

export function AssignOfficeDialog({ open, vehicleId, currentOffice, onClose }: Props) {
  const assignOffice = useAssignOffice(vehicleId);

  return (
    <Dialog
      open={open}
      onClose={assignOffice.isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <AssignOfficeForm currentOffice={currentOffice} assign={assignOffice} onClose={onClose} />
    </Dialog>
  );
}

interface FormProps {
  currentOffice: Office;
  assign: AssignOfficeMutation;
  onClose: () => void;
}

function AssignOfficeForm({ currentOffice, assign, onClose }: FormProps) {
  const offices = useOffices();
  const { notify } = useFeedback();

  const [office, setOffice] = useState('');
  const [note, setNote] = useState('');
  const { fieldErrors, formError, showError, clearField, reset } = useFormErrors();

  // The API rejects a move to the office the vehicle already occupies, so it is
  // not offered in the first place.
  const destinations = (offices.data?.results ?? []).filter(
    (candidate) => candidate.id !== currentOffice.id,
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    reset();

    try {
      await assign.mutateAsync({ office: Number(office), note });
      notify('Vehicle reassigned.');
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogTitle>Move to another office</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}

          <TextField
            label="Currently at"
            value={`${currentOffice.name} — ${currentOffice.city}`}
            disabled
          />

          <TextField
            select
            label="Move to"
            required
            value={office}
            onChange={(event) => {
              setOffice(event.target.value);
              clearField('office');
            }}
            disabled={offices.isPending}
            error={Boolean(fieldErrors.office)}
            helperText={
              fieldErrors.office ??
              (!offices.isPending && destinations.length === 0
                ? 'There is no other office to move to.'
                : ' ')
            }
          >
            {destinations.map((candidate) => (
              <MenuItem key={candidate.id} value={String(candidate.id)}>
                {candidate.name} — {candidate.city}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Reason"
            multiline
            minRows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            helperText="Optional, kept in the assignment history"
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={assign.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          loading={assign.isPending}
          disabled={office === ''}
        >
          Move vehicle
        </Button>
      </DialogActions>
    </form>
  );
}
