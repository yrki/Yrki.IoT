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
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import {
  getNewDevices,
  updateDevice,
  getLocations,
  createEncryptionKey,
  NewDeviceDto,
  UpdateDeviceRequest,
  LocationDto,
} from '../../api/api';
import { buildLocationOptions } from '../locations/locationTree';

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface EditDialogProps {
  device: NewDeviceDto | null;
  open: boolean;
  locations: LocationDto[];
  onClose: () => void;
  onSave: (id: string, request: UpdateDeviceRequest) => Promise<void>;
}

function EditDialog({ device, open, locations, onClose, onSave }: EditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [saving, setSaving] = useState(false);
  const locationOptions = buildLocationOptions(locations);

  useEffect(() => {
    if (device) {
      setName(device.name ?? '');
      setDescription(device.description ?? '');
      setLocationId(device.locationId ?? '');
      setLatitude(device.latitude != null ? String(device.latitude) : '');
      setLongitude(device.longitude != null ? String(device.longitude) : '');
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
          manufacturer: device.manufacturer ?? undefined,
          deviceUniqueId: device.uniqueId,
          keyValue: encryptionKey.trim(),
          description: undefined,
        });
      }

      await onSave(device.id, {
        name: name || undefined,
        description: description || undefined,
        locationId: locationId || undefined,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
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
              {locationOptions.map(({ location, depth }) => (
                <MenuItem key={location.id} value={location.id} sx={{ pl: 2 + depth * 2 }}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              type="number"
              inputProps={{ step: 'any' }}
              fullWidth
              size="small"
            />
            <TextField
              label="Longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              type="number"
              inputProps={{ step: 'any' }}
              fullWidth
              size="small"
            />
          </Stack>

          <TextField
            label="Encryption Key (AES-128 hex)"
            type="text"
            value={encryptionKey}
            onChange={(e) => setEncryptionKey(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. 0102030405060708090A0B0C0D0E0F10"
            helperText="Optional. Leave blank if the sensor is not encrypted."
            slotProps={{
              htmlInput: {
                autoComplete: 'off',
                spellCheck: 'false',
              },
              input: { style: { fontFamily: 'monospace' } }
            }}
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
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshRoundedIcon />}
          onClick={fetchDevices}
          disabled={loading}
        >
          Refresh
        </Button>
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
      />
    </Paper>
  );
}

export default NewSensorsView;
