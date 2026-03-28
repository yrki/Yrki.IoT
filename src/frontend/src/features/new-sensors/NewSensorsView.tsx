import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  getNewDevices,
  updateDevice,
  getLocations,
  createLocation,
  createEncryptionKey,
  NewDeviceDto,
  UpdateDeviceRequest,
  LocationDto,
} from '../../api/api';

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AddLocationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (location: LocationDto) => void;
}

function AddLocationDialog({ open, onClose, onCreated }: AddLocationDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const location = await createLocation(name, description || undefined);
      onCreated(location);
      setName('');
      setDescription('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Location</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            autoFocus
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            size="small"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface EditDialogProps {
  device: NewDeviceDto | null;
  open: boolean;
  locations: LocationDto[];
  onClose: () => void;
  onSave: (id: string, request: UpdateDeviceRequest) => Promise<void>;
  onAddLocation: () => void;
}

function EditDialog({ device, open, locations, onClose, onSave, onAddLocation }: EditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (device) {
      setName(device.name ?? '');
      setDescription(device.description ?? '');
      setLocationId(device.locationId ?? '');
      setEncryptionKey('');
    }
  }, [device]);

  const handleSave = async () => {
    if (!device) return;
    setSaving(true);
    try {
      // Save encryption key if provided
      if (encryptionKey.trim()) {
        await createEncryptionKey({
          deviceUniqueId: device.uniqueId,
          keyValue: encryptionKey.trim(),
          description: `Key for ${name || device.uniqueId}`,
        });
      }

      await onSave(device.id, {
        name: name || undefined,
        description: description || undefined,
        locationId: locationId || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Configure Sensor</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Sensor ID"
            value={device?.uniqueId ?? ''}
            disabled
            fullWidth
            size="small"
          />
          <TextField
            label="Manufacturer"
            value={device?.manufacturer ?? 'Unknown'}
            disabled
            fullWidth
            size="small"
          />
          <TextField
            label="Type"
            value={device?.type ?? ''}
            disabled
            fullWidth
            size="small"
          />
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            placeholder="Give this sensor a friendly name"
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
            placeholder="Where is this sensor located? What does it measure?"
          />

          <Stack direction="row" spacing={1} alignItems="flex-end">
            <FormControl fullWidth size="small">
              <InputLabel>Location</InputLabel>
              <Select
                value={locationId}
                label="Location"
                onChange={(e) => setLocationId(e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {locations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              onClick={onAddLocation}
              sx={{ minWidth: 40, px: 1 }}
            >
              <AddRoundedIcon fontSize="small" />
            </Button>
          </Stack>

          <TextField
            label="Encryption Key (AES-128 hex)"
            value={encryptionKey}
            onChange={(e) => setEncryptionKey(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. 0102030405060708090A0B0C0D0E0F10"
            helperText="Optional. Leave blank if the sensor is not encrypted."
            slotProps={{ input: { style: { fontFamily: 'monospace' } } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Approve'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function NewSensorsView() {
  const [devices, setDevices] = useState<NewDeviceDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDevice, setEditDevice] = useState<NewDeviceDto | null>(null);
  const [addLocationOpen, setAddLocationOpen] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await getNewDevices();
      setDevices(data);
    } catch (err) {
      console.error('Failed to fetch new devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await getLocations();
      setLocations(data);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchLocations();
  }, []);

  const handleSave = async (id: string, request: UpdateDeviceRequest) => {
    await updateDevice(id, request);
    await fetchDevices();
  };

  const handleLocationCreated = (location: LocationDto) => {
    setLocations((prev) => [...prev, location].sort((a, b) => a.name.localeCompare(b.name)));
  };

  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 3.5 },
        borderRadius: '6px',
        backgroundColor: 'rgba(36, 42, 51, 0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.75 }}>
            New Sensors
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Sensors discovered automatically. Configure and approve them here.
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          icon={<FiberNewRoundedIcon />}
          label={`${devices.length} pending`}
          color={devices.length > 0 ? 'warning' : 'default'}
          size="small"
          variant="outlined"
        />
      </Stack>

      {loading ? (
        <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
          Loading...
        </Typography>
      ) : devices.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
          No new sensors to configure.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sensor ID</TableCell>
                <TableCell>Manufacturer</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>First seen</TableCell>
                <TableCell>Last contact</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {device.uniqueId}
                    </Typography>
                  </TableCell>
                  <TableCell>{device.manufacturer ?? 'Unknown'}</TableCell>
                  <TableCell>{device.type}</TableCell>
                  <TableCell>{formatTimestamp(device.installationDate)}</TableCell>
                  <TableCell>{formatTimestamp(device.lastContact)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setEditDevice(device)}
                    >
                      Configure
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EditDialog
        device={editDevice}
        open={editDevice !== null}
        locations={locations}
        onClose={() => setEditDevice(null)}
        onSave={handleSave}
        onAddLocation={() => setAddLocationOpen(true)}
      />

      <AddLocationDialog
        open={addLocationOpen}
        onClose={() => setAddLocationOpen(false)}
        onCreated={handleLocationCreated}
      />
    </Paper>
  );
}

export default NewSensorsView;
