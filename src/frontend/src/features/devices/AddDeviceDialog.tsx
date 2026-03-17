import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { DeviceListItem, DeviceType } from './types';

interface AddDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  onAddDevice: (device: DeviceListItem) => void;
}

interface DeviceFormState {
  id: string;
  name: string;
  uniqueId: string;
  type: DeviceType;
  locationId: string;
  description: string;
  lastContact: string;
  installationDate: string;
}

const defaultFormState: DeviceFormState = {
  id: '',
  name: '',
  uniqueId: '',
  type: 'CO2',
  locationId: '',
  description: '',
  lastContact: '',
  installationDate: '',
};

const deviceTypes: DeviceType[] = ['CO2', 'WATER', 'PassiveIR'];

function AddDeviceDialog({ open, onClose, onAddDevice }: AddDeviceDialogProps) {
  const [formState, setFormState] = useState<DeviceFormState>(defaultFormState);

  useEffect(() => {
    if (!open) {
      setFormState(defaultFormState);
    }
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAddDevice({
      ...formState,
      id: formState.id.trim(),
      name: formState.name.trim() || null,
      uniqueId: formState.uniqueId.trim(),
      locationId: formState.locationId.trim(),
      description: formState.description.trim(),
      lastContact: new Date(formState.lastContact).toISOString(),
      installationDate: new Date(formState.installationDate).toISOString(),
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          borderRadius: '6px',
        },
      }}
    >
      <Stack component="form" onSubmit={handleSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h4">Add device</Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <TextField
            autoFocus
            required
            label="Id"
            value={formState.id}
            onChange={(event) => setFormState((current) => ({ ...current, id: event.target.value }))}
          />
          <TextField
            label="Name"
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
          />
          <TextField
            required
            label="UniqueId"
            value={formState.uniqueId}
            onChange={(event) => setFormState((current) => ({ ...current, uniqueId: event.target.value }))}
          />
          <TextField
            select
            required
            label="Type"
            value={formState.type}
            onChange={(event) =>
              setFormState((current) => ({ ...current, type: event.target.value as DeviceType }))
            }
          >
            {deviceTypes.map((deviceType) => (
              <MenuItem key={deviceType} value={deviceType}>
                {deviceType === 'PassiveIR' ? 'Passive IR' : deviceType}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            label="LocationId"
            value={formState.locationId}
            onChange={(event) => setFormState((current) => ({ ...current, locationId: event.target.value }))}
          />
          <TextField
            required
            label="LastContact"
            type="datetime-local"
            value={formState.lastContact}
            onChange={(event) => setFormState((current) => ({ ...current, lastContact: event.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            required
            label="InstallationDate"
            type="datetime-local"
            value={formState.installationDate}
            onChange={(event) =>
              setFormState((current) => ({ ...current, installationDate: event.target.value }))
            }
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Description"
            value={formState.description}
            multiline
            minRows={3}
            onChange={(event) =>
              setFormState((current) => ({ ...current, description: event.target.value }))
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Add device
          </Button>
        </DialogActions>
      </Stack>
    </Dialog>
  );
}

export default AddDeviceDialog;
