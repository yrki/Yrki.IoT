import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { LocationDto } from '../../api/api';
import { buildLocationOptions } from '../locations/locationTree';

export type AssignBoundaryMode = 'create' | 'existing';

export interface AssignBoundarySubmitPayload {
  mode: AssignBoundaryMode;
  newLocationName?: string;
  newLocationParentId?: string | null;
  existingLocationId?: string;
}

interface AssignBoundaryDialogProps {
  open: boolean;
  enclosedDeviceCount: number;
  locations: LocationDto[];
  onCancel: () => void;
  onSubmit: (payload: AssignBoundarySubmitPayload) => Promise<void> | void;
}

function AssignBoundaryDialog({
  open,
  enclosedDeviceCount,
  locations,
  onCancel,
  onSubmit,
}: AssignBoundaryDialogProps) {
  const [mode, setMode] = useState<AssignBoundaryMode>('create');
  const [newName, setNewName] = useState('');
  const [parentLocationId, setParentLocationId] = useState<string>('');
  const [existingLocationId, setExistingLocationId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationOptions = useMemo(() => buildLocationOptions(locations), [locations]);

  useEffect(() => {
    if (open) {
      setMode('create');
      setNewName('');
      setParentLocationId('');
      setExistingLocationId('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);

    if (mode === 'create' && !newName.trim()) {
      setError('Please enter a name for the new location.');
      return;
    }

    if (mode === 'existing' && !existingLocationId) {
      setError('Please pick an existing location.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        mode,
        newLocationName: mode === 'create' ? newName.trim() : undefined,
        newLocationParentId: mode === 'create' ? (parentLocationId || null) : undefined,
        existingLocationId: mode === 'existing' ? existingLocationId : undefined,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save the boundary.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Assign drawn area to location</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {enclosedDeviceCount === 1
              ? '1 sensor inside the drawn area will be assigned to the chosen location.'
              : `${enclosedDeviceCount} sensors inside the drawn area will be assigned to the chosen location.`}
          </Typography>

          <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={(_, nextValue: AssignBoundaryMode | null) => {
              if (nextValue) {
                setMode(nextValue);
              }
            }}
            size="small"
            color="primary"
          >
            <ToggleButton value="create">Create new location</ToggleButton>
            <ToggleButton value="existing">Use existing location</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'create' ? (
            <Stack spacing={2}>
              <TextField
                label="Location name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                autoFocus
                fullWidth
              />
              <TextField
                label="Parent location (optional)"
                select
                value={parentLocationId}
                onChange={(event) => setParentLocationId(event.target.value)}
                fullWidth
              >
                <MenuItem value="">None (top-level)</MenuItem>
                {locationOptions.map(({ location, depth }) => (
                  <MenuItem key={location.id} value={location.id} sx={{ pl: 2 + depth * 2 }}>
                    {location.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          ) : (
            <TextField
              label="Existing location"
              select
              value={existingLocationId}
              onChange={(event) => setExistingLocationId(event.target.value)}
              autoFocus
              fullWidth
            >
              <MenuItem value="" disabled>
                Pick a location
              </MenuItem>
              {locationOptions.map(({ location, depth }) => (
                <MenuItem key={location.id} value={location.id} sx={{ pl: 2 + depth * 2 }}>
                  {location.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          {error && (
            <Typography variant="body2" color="error">{error}</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AssignBoundaryDialog;
