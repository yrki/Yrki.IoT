import { useEffect, useId, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import Co2RoundedIcon from '@mui/icons-material/Co2Rounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import WaterRoundedIcon from '@mui/icons-material/WaterRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditLocationAltRoundedIcon from '@mui/icons-material/EditLocationAltRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useSensorHub, SensorReading, SensorDataPoint } from './useSensorHub';
import {
  createLocation,
  createEncryptionKey,
  getDeviceByUniqueId,
  getDevices,
  getDevicesByLocation,
  getEncryptionKeyByDevice,
  getLocations,
  LocationDto,
  SensorListItemDto,
  updateEncryptionKey,
  updateExistingDevice,
} from '../../api/api';
import { buildLocationOptions } from '../locations/locationTree';
import { calculateSensorStatistics } from './sensorStats';

interface SensorCardProps {
  sensorType: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  reading: SensorReading | undefined;
  history: SensorDataPoint[];
  color: string;
  hours: number;
  onOpenFullscreen: (sensorType: string) => void;
}

function formatTime(epoch: number) {
  return new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(epoch: number) {
  return new Date(epoch).toLocaleDateString([], { day: 'numeric', month: 'short' })
    + ' ' + new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatSensorHeading(name: string | null | undefined, sensorId: string) {
  if (!name || name === sensorId) {
    return sensorId || 'Live Sensors';
  }

  return `${name} (${sensorId})`;
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatValue(value: number, unit: string) {
  if (unit === 'ppm' || unit === 'dB') return Math.round(value);
  return value.toFixed(1);
}

function SensorHistoryChart({
  label,
  unit,
  history,
  color,
  hours,
  height,
}: {
  label: string;
  unit: string;
  history: SensorDataPoint[];
  color: string;
  hours: number;
  height: number | string;
}) {
  const showDate = hours > 24;
  const tickFormatter = showDate ? formatDateTime : formatTime;
  const gradientId = useId();

  return (
    <Box sx={{ width: '100%', height }}>
      {history.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tickFormatter}
              tick={{ fill: '#a0a8b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={60}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#a0a8b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v: number) => unit === 'ppm' || unit === 'dB' ? String(Math.round(v)) : v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#20242c',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelFormatter={(v) => new Date(v as number).toLocaleString()}
              formatter={(v) => [`${formatValue(v as number, unit)} ${unit}`, label]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Collecting data...
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function SensorCard({ sensorType, label, unit, icon, reading, history, color, hours, onOpenFullscreen }: SensorCardProps) {
  return (
    <Paper
      sx={{
        p: 3,
        flex: '1 1 280px',
        minWidth: 280,
        backgroundColor: 'rgba(36, 42, 51, 0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            borderRadius: '6px',
            backgroundColor: `${color}20`,
            color,
          }}
        >
          {icon}
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          {label}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          aria-label={`Open ${label} in fullscreen`}
          onClick={() => onOpenFullscreen(sensorType)}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <OpenInFullRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>

      {reading ? (
        <>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>
            {formatValue(reading.value, unit)}
            <Box component="span" sx={{ color: 'text.secondary', ml: 0.5, fontSize: '1.5rem', fontWeight: 500 }}>
              {unit}
            </Box>
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            {formatTimestamp(reading.timestamp)}
          </Typography>
        </>
      ) : (
        <Typography variant="h5" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Waiting for data...
        </Typography>
      )}

      <SensorHistoryChart
        label={label}
        unit={unit}
        history={history}
        color={color}
        hours={hours}
        height={120}
      />
    </Paper>
  );
}

function StatisticPanel({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        minWidth: 160,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {formatValue(value, unit)} {unit}
      </Typography>
    </Paper>
  );
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
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      const location = await createLocation(name.trim(), description.trim() || undefined);
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

interface EditSensorLocationDialogProps {
  open: boolean;
  device: SensorListItemDto | null;
  locations: LocationDto[];
  onClose: () => void;
  onAddLocation: () => void;
  onSaved: (updatedDevice: SensorListItemDto) => void;
}

interface EditSensorSettingsDialogProps {
  open: boolean;
  device: SensorListItemDto | null;
  locations: LocationDto[];
  onClose: () => void;
  onAddLocation: () => void;
  onSaved: (updatedDevice: SensorListItemDto) => void;
}

function EditSensorSettingsDialog({
  open,
  device,
  locations,
  onClose,
  onAddLocation,
  onSaved,
}: EditSensorSettingsDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState('');
  const [encryptionKeyId, setEncryptionKeyId] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [encryptionKeyDescription, setEncryptionKeyDescription] = useState('');
  const [loadingKey, setLoadingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const locationOptions = buildLocationOptions(locations);

  useEffect(() => {
    if (!open || !device) {
      return;
    }

    setName(device.name ?? '');
    setDescription('');
    setLocationId(device.locationId ?? '');
    setEncryptionKey('');
    setEncryptionKeyId(null);
    setEncryptionKeyDescription('');
    setError('');
    setLoadingKey(true);

    getEncryptionKeyByDevice(device.uniqueId, device.manufacturer ?? undefined)
      .then((key) => {
        setEncryptionKeyId(key?.id ?? null);
        setEncryptionKeyDescription(key?.description ?? '');
        setEncryptionKey(key?.keyValue ?? '');
      })
      .catch((err) => {
        console.error('Failed to fetch encryption key:', err);
        setError('Failed to load encryption key details.');
      })
      .finally(() => setLoadingKey(false));
  }, [device, open]);

  const handleSave = async () => {
    if (!device) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await updateExistingDevice(device.id, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        locationId: locationId || undefined,
      });

      const keyDescription = encryptionKeyDescription.trim();
      if (encryptionKey.trim()) {
        if (encryptionKeyId) {
          await updateEncryptionKey(encryptionKeyId, {
            manufacturer: device.manufacturer ?? undefined,
            deviceUniqueId: device.uniqueId,
            keyValue: encryptionKey.trim(),
            description: keyDescription,
          });
        } else {
          const createdKey = await createEncryptionKey({
            manufacturer: device.manufacturer ?? undefined,
            deviceUniqueId: device.uniqueId,
            keyValue: encryptionKey.trim(),
            description: keyDescription || undefined,
          });
          setEncryptionKeyId(createdKey.id);
        }
      } else if (encryptionKeyId) {
        await updateEncryptionKey(encryptionKeyId, {
          manufacturer: device.manufacturer ?? undefined,
          deviceUniqueId: device.uniqueId,
          description: keyDescription,
        });
      }

      const selectedLocation = locations.find((location) => location.id === updated.locationId);
      onSaved({
        id: updated.id,
        uniqueId: updated.uniqueId,
        name: updated.name,
        manufacturer: updated.manufacturer,
        type: updated.type,
        locationId: updated.locationId,
        locationName: selectedLocation?.name ?? null,
        lastContact: updated.lastContact,
        installationDate: updated.installationDate,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update sensor settings:', err);
      setError('Failed to save sensor settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Sensor</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Sensor ID"
            value={device?.uniqueId ?? ''}
            fullWidth
            size="small"
            disabled
          />
          <TextField
            label="Manufacturer"
            value={device?.manufacturer ?? 'Unknown'}
            fullWidth
            size="small"
            disabled
          />
          <TextField
            label="Type"
            value={device?.type ?? ''}
            fullWidth
            size="small"
            disabled
          />
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
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
                {locationOptions.map(({ location, depth }) => (
                  <MenuItem key={location.id} value={location.id} sx={{ pl: 2 + depth * 2 }}>
                    {location.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" onClick={onAddLocation} sx={{ minWidth: 40, px: 1 }}>
              <AddRoundedIcon fontSize="small" />
            </Button>
          </Stack>
          <TextField
            label="Encryption Key (AES-128 hex)"
            type="text"
            value={encryptionKey}
            onChange={(e) => setEncryptionKey(e.target.value)}
            fullWidth
            size="small"
            placeholder="Enter key if this sensor is encrypted"
            helperText={
              loadingKey
                ? 'Loading key metadata...'
                : encryptionKeyId
                  ? 'Stored key loaded. You can edit it directly.'
                  : 'No key stored for this sensor yet.'
            }
            slotProps={{
              htmlInput: {
                autoComplete: 'off',
                spellCheck: 'false',
              },
              input: { style: { fontFamily: 'monospace' } },
            }}
          />
          <TextField
            label="Encryption Key Description"
            value={encryptionKeyDescription}
            onChange={(e) => setEncryptionKeyDescription(e.target.value)}
            fullWidth
            size="small"
            placeholder="Optional note for the stored key"
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loadingKey}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditSensorLocationDialog({
  open,
  device,
  locations,
  onClose,
  onAddLocation,
  onSaved,
}: EditSensorLocationDialogProps) {
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const locationOptions = buildLocationOptions(locations);

  useEffect(() => {
    if (device) {
      setLocationId(device.locationId ?? '');
      setError('');
    }
  }, [device]);

  const handleSave = async () => {
    if (!device) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await updateExistingDevice(device.id, {
        name: device.name ?? undefined,
        description: undefined,
        locationId: locationId || undefined,
      });

      const selectedLocation = locations.find((location) => location.id === updated.locationId);
      onSaved({
        id: updated.id,
        uniqueId: updated.uniqueId,
        name: updated.name,
        manufacturer: updated.manufacturer,
        type: updated.type,
        locationId: updated.locationId,
        locationName: selectedLocation?.name ?? null,
        lastContact: updated.lastContact,
        installationDate: updated.installationDate,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update device location:', err);
      setError('Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Sensor Location</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Sensor"
            value={device?.name ?? device?.uniqueId ?? ''}
            fullWidth
            size="small"
            disabled
          />
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <FormControl fullWidth size="small">
              <InputLabel>Location</InputLabel>
              <Select
                value={locationId}
                label="Location"
                onChange={(e) => setLocationId(e.target.value)}
              >
                {locationOptions.map(({ location, depth }) => (
                  <MenuItem key={location.id} value={location.id} sx={{ pl: 2 + depth * 2 }}>
                    {location.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" onClick={onAddLocation} sx={{ minWidth: 40, px: 1 }}>
              <AddRoundedIcon fontSize="small" />
            </Button>
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !locationId}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface SensorFullscreenDialogProps {
  open: boolean;
  sensorId: string;
  sensorType: string | null;
  sensorName: string;
  sensorLocation: string;
  firstReadingAt: string;
  lastReadingAt: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  onClose: () => void;
}

function SensorFullscreenDialog({
  open,
  sensorId,
  sensorType,
  sensorName,
  sensorLocation,
  firstReadingAt,
  lastReadingAt,
  label,
  unit,
  icon,
  color,
  onClose,
}: SensorFullscreenDialogProps) {
  const [hours, setHours] = useState(3);
  const { readings, history } = useSensorHub(sensorId, hours, open && sensorType !== null);

  useEffect(() => {
    if (open) {
      setHours(3);
    }
  }, [open, sensorType]);

  if (!sensorType) {
    return null;
  }

  const reading = readings[sensorType];
  const sensorHistory = history[sensorType] ?? [];
  const statistics = calculateSensorStatistics(sensorHistory);
  const subtitle = sensorLocation ? `${label} - ${sensorLocation}` : label;

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle sx={{ px: { xs: 2, md: 4 }, pt: { xs: 2, md: 3 }, pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 48,
              height: 48,
              borderRadius: '8px',
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h4">{sensorName}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton aria-label="Close fullscreen dialog" onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, md: 4 }, pb: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              {reading ? (
                <>
                  <Typography variant="h2" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {formatValue(reading.value, unit)}
                    <Box component="span" sx={{ color: 'text.secondary', ml: 1, fontSize: '2.125rem', fontWeight: 500 }}>
                      {unit}
                    </Box>
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    Latest reading: {new Date(reading.timestamp).toLocaleString()}
                  </Typography>
                </>
              ) : (
                <Typography variant="h4" sx={{ color: 'text.secondary' }}>
                  Waiting for data...
                </Typography>
              )}
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                First reading: {formatDateLabel(firstReadingAt)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Last reading: {formatDateLabel(lastReadingAt)}
              </Typography>
            </Box>
            <ButtonGroup size="small" variant="outlined">
              {timeRanges.map((range) => (
                <Button
                  key={range.label}
                  onClick={() => setHours(range.hours)}
                  variant={hours === range.hours ? 'contained' : 'outlined'}
                >
                  {range.label}
                </Button>
              ))}
            </ButtonGroup>
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            {statistics ? (
              <>
                <StatisticPanel label="Lowest" value={statistics.min} unit={unit} />
                <StatisticPanel label="Highest" value={statistics.max} unit={unit} />
                <StatisticPanel label="Median" value={statistics.median} unit={unit} />
                <StatisticPanel label="Average" value={statistics.average} unit={unit} />
              </>
            ) : (
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                Statistics will appear when enough history is available.
              </Typography>
            )}
          </Stack>

          <Paper
            sx={{
              p: { xs: 2, md: 3 },
              height: { xs: 360, md: 'calc(100vh - 320px)' },
              minHeight: 360,
              backgroundColor: 'rgba(36, 42, 51, 0.82)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
            }}
          >
            <SensorHistoryChart
              label={label}
              unit={unit}
              history={sensorHistory}
              color={color}
              hours={hours}
              height="100%"
            />
          </Paper>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

const sensorTypeConfig: Record<string, { label: string; unit: string; icon: React.ReactNode; color: string }> = {
  CO2: { label: 'CO2', unit: 'ppm', icon: <Co2RoundedIcon />, color: '#5c8dff' },
  Temperature: { label: 'Temperature', unit: '\u00B0C', icon: <ThermostatRoundedIcon />, color: '#ff6b6b' },
  Humidity: { label: 'Humidity', unit: '%', icon: <WaterDropRoundedIcon />, color: '#38c7ff' },
  Sound: { label: 'Sound level', unit: 'dB', icon: <VolumeUpRoundedIcon />, color: '#f5c451' },
  Flow: { label: 'Flow', unit: 'l/h', icon: <SpeedRoundedIcon />, color: '#a78bfa' },
  Volume: { label: 'Volume', unit: 'm\u00B3', icon: <WaterRoundedIcon />, color: '#34d399' },
  TotalVolume: { label: 'Total volume', unit: 'm\u00B3', icon: <WaterRoundedIcon />, color: '#34d399' },
  PositiveVolume: { label: 'Forward volume', unit: 'm\u00B3', icon: <WaterRoundedIcon />, color: '#2dd4bf' },
  NegativeVolume: { label: 'Reverse volume', unit: 'm\u00B3', icon: <WaterRoundedIcon />, color: '#f97316' },
  LastMonthVolume: { label: 'Last month volume', unit: 'm\u00B3', icon: <WaterRoundedIcon />, color: '#10b981' },
  LastMonthPositiveVolume: { label: 'Last month forward', unit: 'm\u00B3', icon: <WaterRoundedIcon />, color: '#14b8a6' },
  LastMonthNegativeVolume: { label: 'Last month reverse', unit: 'm\u00B3', icon: <WaterRoundedIcon />, color: '#fb7185' },
  RemainingBattery: { label: 'Battery remaining', unit: '%', icon: <SpeedRoundedIcon />, color: '#f59e0b' },
  AlarmCode: { label: 'Alarm code', unit: '', icon: <SpeedRoundedIcon />, color: '#ef4444' },
  HasAlarm: { label: 'Alarm active', unit: '', icon: <SpeedRoundedIcon />, color: '#dc2626' },
  ErrorFreeTimeSeconds: { label: 'Error-free time', unit: 's', icon: <SpeedRoundedIcon />, color: '#60a5fa' },
};

const defaultConfig = { label: 'Unknown', unit: '', icon: <SpeedRoundedIcon />, color: '#999' };

const timeRanges = [
  { label: '3h', hours: 3 },
  { label: '12h', hours: 12 },
  { label: '1w', hours: 24 * 7 },
  { label: '1m', hours: 24 * 30 },
] as const;

interface SensorsViewProps {
  initialSensorId?: string;
  locationId?: string;
  locationName?: string;
  onBack?: () => void;
}

function SensorsView({ initialSensorId, locationId, locationName, onBack }: SensorsViewProps) {
  const [devices, setDevices] = useState<SensorListItemDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState(initialSensorId ?? '');
  const [hours, setHours] = useState(3);
  const [fullscreenSensorType, setFullscreenSensorType] = useState<string | null>(null);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [editSettingsOpen, setEditSettingsOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const { readings, history, connected } = useSensorHub(selectedSensorId, hours);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        if (locationId) {
          return await getDevicesByLocation(locationId);
        }

        if (initialSensorId) {
          try {
            const selectedDevice = await getDeviceByUniqueId(initialSensorId);
            if (!selectedDevice.locationId) {
              return [selectedDevice];
            }

            const sameLocationDevices = await getDevicesByLocation(selectedDevice.locationId);
            if (sameLocationDevices.length > 0) {
              return sameLocationDevices;
            }

            const allDevices = await getDevices();
            const fallbackDevices = allDevices.filter((device) => device.locationId === selectedDevice.locationId);
            return fallbackDevices.length > 0 ? fallbackDevices : [selectedDevice];
          } catch (err) {
            console.error('Failed to fetch selected device metadata:', err);
          }
        }

        return await getDevices();
      } catch (err) {
        console.error('Failed to fetch devices:', err);
        return [];
      }
    };

    loadDevices().then((result) => {
      setDevices(result);
      const ids = result.map((d) => d.uniqueId);
      if (initialSensorId && ids.includes(initialSensorId)) {
        setSelectedSensorId(initialSensorId);
      } else if (ids.length > 0 && !ids.includes(selectedSensorId)) {
        setSelectedSensorId(ids[0]);
      }
    });
  }, [initialSensorId, locationId]);

  useEffect(() => {
    setSelectedSensorId(initialSensorId ?? '');
  }, [initialSensorId]);

  useEffect(() => {
    getLocations()
      .then((result) => setLocations(result.sort((left, right) => left.name.localeCompare(right.name))))
      .catch((err: unknown) => console.error('Failed to fetch locations:', err));
  }, []);

  const selectedDevice = devices.find((d) => d.uniqueId === selectedSensorId);
  const activeSensorTypes = Object.keys(readings);
  const deviceSelectValue = devices.some((device) => device.uniqueId === selectedSensorId)
    ? selectedSensorId
    : '';
  const fullscreenConfig = fullscreenSensorType
    ? sensorTypeConfig[fullscreenSensorType] ?? { ...defaultConfig, label: fullscreenSensorType }
    : defaultConfig;

  const handleLocationCreated = (location: LocationDto) => {
    setLocations((prev) => [...prev, location].sort((left, right) => left.name.localeCompare(right.name)));
  };

  const handleDeviceUpdated = (updatedDevice: SensorListItemDto) => {
    setDevices((prev) => prev.map((device) => device.id === updatedDevice.id ? updatedDevice : device));
  };

  return (
    <>
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
          {onBack ? (
            <IconButton aria-label="Back" onClick={onBack} sx={{ alignSelf: 'flex-start', mt: 0.25 }}>
              <ArrowBackRoundedIcon />
            </IconButton>
          ) : null}
          <Box>
            <Typography variant="h4" sx={{ mb: 0.75 }}>
              {formatSensorHeading(selectedDevice?.name, selectedSensorId)}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                {selectedDevice?.locationName ?? locationName ?? 'No location set'}
              </Typography>
              {selectedDevice ? (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<EditLocationAltRoundedIcon fontSize="small" />}
                    onClick={() => setEditLocationOpen(true)}
                    sx={{ minWidth: 0, px: 0 }}
                  >
                    Edit location
                  </Button>
                  <IconButton
                    aria-label="Edit sensor settings"
                    onClick={() => setEditSettingsOpen(true)}
                    size="small"
                    sx={{ color: 'text.secondary' }}
                  >
                    <SettingsRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ) : null}
            </Stack>
            {selectedDevice ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  First reading: {formatDateLabel(selectedDevice.installationDate)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Last reading: {formatDateLabel(selectedDevice.lastContact)}
                </Typography>
              </Stack>
            ) : null}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Device</InputLabel>
            <Select
              value={deviceSelectValue}
              label="Device"
              onChange={(e) => setSelectedSensorId(e.target.value)}
            >
              {devices.map((d) => (
                <MenuItem key={d.uniqueId} value={d.uniqueId}>
                  {d.name ?? d.uniqueId}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ButtonGroup size="small" variant="outlined">
            {timeRanges.map((range) => (
              <Button
                key={range.label}
                onClick={() => setHours(range.hours)}
                variant={hours === range.hours ? 'contained' : 'outlined'}
              >
                {range.label}
              </Button>
            ))}
          </ButtonGroup>
          <Chip
            label={connected ? 'Connected' : 'Disconnected'}
            color={connected ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
        </Stack>

        <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
          {activeSensorTypes.map((sensorType) => {
            const config = sensorTypeConfig[sensorType] ?? { ...defaultConfig, label: sensorType };
            return (
              <SensorCard
                key={sensorType}
                sensorType={sensorType}
                label={config.label}
                unit={config.unit}
                icon={config.icon}
                reading={readings[sensorType]}
                history={history[sensorType] ?? []}
                color={config.color}
                hours={hours}
                onOpenFullscreen={setFullscreenSensorType}
              />
            );
          })}
        </Stack>
      </Paper>

      <SensorFullscreenDialog
        open={fullscreenSensorType !== null}
        sensorId={selectedSensorId}
        sensorType={fullscreenSensorType}
        sensorName={selectedDevice?.name ?? selectedSensorId}
        sensorLocation={selectedDevice?.locationName ?? locationName ?? ''}
        firstReadingAt={selectedDevice?.installationDate ?? new Date().toISOString()}
        lastReadingAt={selectedDevice?.lastContact ?? new Date().toISOString()}
        label={fullscreenConfig.label}
        unit={fullscreenConfig.unit}
        icon={fullscreenConfig.icon}
        color={fullscreenConfig.color}
        onClose={() => setFullscreenSensorType(null)}
      />

      <EditSensorLocationDialog
        open={editLocationOpen}
        device={selectedDevice ?? null}
        locations={locations}
        onClose={() => setEditLocationOpen(false)}
        onAddLocation={() => setAddLocationOpen(true)}
        onSaved={handleDeviceUpdated}
      />

      <EditSensorSettingsDialog
        open={editSettingsOpen}
        device={selectedDevice ?? null}
        locations={locations}
        onClose={() => setEditSettingsOpen(false)}
        onAddLocation={() => setAddLocationOpen(true)}
        onSaved={handleDeviceUpdated}
      />

      <AddLocationDialog
        open={addLocationOpen}
        onClose={() => setAddLocationOpen(false)}
        onCreated={handleLocationCreated}
      />
    </>
  );
}

export default SensorsView;
