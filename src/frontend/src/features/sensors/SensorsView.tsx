import { useEffect, useId, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import RouterRoundedIcon from '@mui/icons-material/RouterRounded';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useSensorHub, SensorReading, SensorDataPoint } from './useSensorHub';
import {
  createEncryptionKey,
  getDeviceByUniqueId,
  getDevices,
  getDevicesByLocation,
  getEncryptionKeyByDevice,
  getSensorForecast,
  getSensorGateways,
  getLocations,
  LocationDto,
  SensorGatewayDto,
  SensorListItemDto,
  updateEncryptionKey,
  updateExistingDevice,
} from '../../api/api';
import { buildLocationOptions } from '../locations/locationTree';
import { handleCoordinatePaste } from '../map/coordinatePaste';
import { calculateSensorStatistics } from './sensorStats';

interface SensorCardProps {
  sensorType: string;
  label: string;
  unit: string;
  decimals: number;
  icon: React.ReactNode;
  reading: SensorReading | undefined;
  history: SensorDataPoint[];
  color: string;
  hours: number;
  onOpenFullscreen: (sensorType: string) => void;
}

function formatTime(epoch: number) {
  return new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateTime(epoch: number) {
  return new Date(epoch).toLocaleDateString([], { day: 'numeric', month: 'short' })
    + ' ' + new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
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
    hour12: false,
  });
}

function formatValue(value: number, decimals: number) {
  return value.toFixed(decimals);
}

function formatUtcDateTimeFromUnixSeconds(value: number) {
  return `${new Date(value * 1000).toLocaleString([], {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })} UTC`;
}

function formatUtcTimeFromUnixSeconds(value: number) {
  return `${new Date(value * 1000).toLocaleTimeString([], {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} UTC`;
}

function formatSensorValue(sensorType: string, value: number, decimals: number) {
  if (sensorType === 'OnDate') {
    return formatUtcDateTimeFromUnixSeconds(value);
  }

  return formatValue(value, decimals);
}

function isDateTimeSensorType(sensorType: string) {
  return sensorType === 'OnDate';
}

function formatAverageRssi(value: number) {
  return value.toFixed(1);
}

const forecastColor = '#a855f7';

interface ChartDataPoint {
  time: number;
  value?: number;
  forecast?: number;
  forecastLower?: number;
  forecastUpper?: number;
}

function SensorHistoryChart({
  sensorType,
  label,
  unit,
  decimals,
  history,
  forecast,
  color,
  hours,
  height,
}: {
  sensorType: string;
  label: string;
  unit: string;
  decimals: number;
  history: SensorDataPoint[];
  forecast?: SensorDataPoint[];
  color: string;
  hours: number;
  height: number | string;
}) {
  const showDate = hours > 24 || (forecast && forecast.length > 0);
  const tickFormatter = showDate ? formatDateTime : formatTime;
  const gradientId = useId();
  const forecastGradientId = gradientId + '-forecast';
  const yAxisWidth = sensorType === 'OnDate' ? 88 : decimals >= 3 ? 64 : decimals >= 2 ? 56 : 48;

  const hasForecast = forecast && forecast.length > 0;

  const chartData: ChartDataPoint[] = [];

  for (const p of history) {
    chartData.push({ time: p.time, value: p.value });
  }

  if (hasForecast && history.length > 0) {
    const lastHistorical = history[history.length - 1];
    chartData.push({
      time: lastHistorical.time,
      value: lastHistorical.value,
      forecast: lastHistorical.value,
    });

    for (const p of forecast) {
      chartData.push({ time: p.time, forecast: p.value });
    }
  }

  chartData.sort((a, b) => a.time - b.time);

  return (
    <Box sx={{ width: '100%', height }}>
      {history.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={forecastGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={forecastColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={forecastColor} stopOpacity={0.02} />
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
              width={yAxisWidth}
              tickFormatter={(v: number) => sensorType === 'OnDate'
                ? formatUtcTimeFromUnixSeconds(v)
                : v.toFixed(decimals)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#20242c',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelFormatter={(v) => new Date(v as number).toLocaleString([], { hour12: false })}
              formatter={(v: number, name: string) => {
                const formatted = sensorType === 'OnDate'
                  ? formatSensorValue(sensorType, v, decimals)
                  : `${formatSensorValue(sensorType, v, decimals)} ${unit}`;
                return [formatted, name === 'forecast' ? 'Forecast' : label];
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
              connectNulls={false}
            />
            {hasForecast && (
              <Area
                type="monotone"
                dataKey="forecast"
                stroke={forecastColor}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                fill={`url(#${forecastGradientId})`}
                isAnimationActive={false}
                dot={false}
                connectNulls={false}
              />
            )}
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

function SensorCard({ sensorType, label, unit, decimals, icon, reading, history, color, hours, onOpenFullscreen }: SensorCardProps) {
  const isDateTimeValue = isDateTimeSensorType(sensorType);

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
          <Typography
            variant={isDateTimeValue ? 'h5' : 'h3'}
            sx={{
              fontWeight: 800,
              mb: 0.5,
              lineHeight: isDateTimeValue ? 1.25 : undefined,
              fontSize: isDateTimeValue ? { xs: '1.1rem', md: '1.25rem' } : undefined,
              wordBreak: isDateTimeValue ? 'break-word' : undefined,
            }}
          >
            {formatSensorValue(sensorType, reading.value, decimals)}
            {unit ? (
              <Box component="span" sx={{ color: 'text.secondary', ml: 0.5, fontSize: '1.5rem', fontWeight: 500 }}>
                {unit}
              </Box>
            ) : null}
          </Typography>
        </>
      ) : (
        <Typography variant="h5" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Waiting for data...
        </Typography>
      )}

      <SensorHistoryChart
        sensorType={sensorType}
        label={label}
        unit={unit}
        decimals={decimals}
        history={history}
        color={color}
        hours={hours}
        height={120}
      />
    </Paper>
  );
}

function StatisticPanel({ sensorType, label, value, unit, decimals }: { sensorType: string; label: string; value: number; unit: string; decimals: number }) {
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
        {formatSensorValue(sensorType, value, decimals)}{unit ? ` ${unit}` : ''}
      </Typography>
    </Paper>
  );
}

interface EditSensorLocationDialogProps {
  open: boolean;
  device: SensorListItemDto | null;
  locations: LocationDto[];
  onClose: () => void;
  onSaved: (updatedDevice: SensorListItemDto) => void;
}

interface EditSensorSettingsDialogProps {
  open: boolean;
  device: SensorListItemDto | null;
  locations: LocationDto[];
  onClose: () => void;
  onSaved: (updatedDevice: SensorListItemDto) => void;
}

function EditSensorSettingsDialog({
  open,
  device,
  locations,
  onClose,
  onSaved,
}: EditSensorSettingsDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [encryptionKeyId, setEncryptionKeyId] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState('');
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
    setLatitude(device.latitude != null ? String(device.latitude) : '');
    setLongitude(device.longitude != null ? String(device.longitude) : '');
    setEncryptionKey('');
    setEncryptionKeyId(null);
    setError('');
    setLoadingKey(true);

    getEncryptionKeyByDevice(device.uniqueId, device.manufacturer ?? undefined)
      .then((key) => {
        setEncryptionKeyId(key?.id ?? null);
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
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
      });

      if (encryptionKey.trim()) {
        if (encryptionKeyId) {
          await updateEncryptionKey(encryptionKeyId, {
            manufacturer: device.manufacturer ?? undefined,
            deviceUniqueId: device.uniqueId,
            keyValue: encryptionKey.trim(),
          });
        } else {
          const createdKey = await createEncryptionKey({
            manufacturer: device.manufacturer ?? undefined,
            deviceUniqueId: device.uniqueId,
            keyValue: encryptionKey.trim(),
          });
          setEncryptionKeyId(createdKey.id);
        }
      } else if (encryptionKeyId) {
        await updateEncryptionKey(encryptionKeyId, {
          manufacturer: device.manufacturer ?? undefined,
          deviceUniqueId: device.uniqueId,
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
        latitude: updated.latitude,
        longitude: updated.longitude,
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
              onPaste={(e) => handleCoordinatePaste(e, setLatitude, setLongitude)}
              type="number"
              inputProps={{ step: 'any' }}
              fullWidth
              size="small"
            />
            <TextField
              label="Longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              onPaste={(e) => handleCoordinatePaste(e, setLatitude, setLongitude)}
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
        latitude: updated.latitude,
        longitude: updated.longitude,
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

// Fullscreen dialog moved to SensorFullscreenPage (own route)

const enableForecast = import.meta.env.DEV || import.meta.env.VITE_ENABLE_FORECAST === 'true';

const forecastRanges = [
  { label: '+3d', hours: 72 },
  { label: '+1w', hours: 168 },
  { label: '+1m', hours: 720 },
] as const;

function _removedDialogPlaceholder(_props: never) {
  const [hours, setHours] = useState(3);
  const [forecastHours, setForecastHours] = useState<number | null>(null);
  const [forecastData, setForecastData] = useState<SensorDataPoint[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const { readings, history } = useSensorHub(sensorId, hours, open && sensorType !== null);

  useEffect(() => {
    if (open) {
      setHours(3);
      setForecastHours(null);
      setForecastData([]);
    }
  }, [open, sensorType]);

  useEffect(() => {
    if (!forecastHours || !sensorType || !sensorId) {
      setForecastData([]);
      return;
    }

    let cancelled = false;
    setForecastLoading(true);

    getSensorForecast(sensorId, sensorType, forecastHours)
      .then((points) => {
        if (cancelled) return;
        setForecastData(points.map((p) => ({
          time: new Date(p.timestamp).getTime(),
          value: p.value,
        })));
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to fetch forecast:', err);
      })
      .finally(() => {
        if (!cancelled) setForecastLoading(false);
      });

    return () => { cancelled = true; };
  }, [sensorId, sensorType, forecastHours]);

  if (!sensorType) {
    return null;
  }

  const reading = readings[sensorType];
  const sensorHistory = history[sensorType] ?? [];
  const statistics = calculateSensorStatistics(sensorHistory);
  const subtitle = sensorLocation ? `${label} - ${sensorLocation}` : label;
  const isDateTimeValue = isDateTimeSensorType(sensorType);

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
                  <Typography
                    variant={isDateTimeValue ? 'h4' : 'h2'}
                    sx={{
                      fontWeight: 800,
                      mb: 0.5,
                      lineHeight: isDateTimeValue ? 1.25 : undefined,
                      fontSize: isDateTimeValue ? { xs: '1.5rem', md: '1.9rem' } : undefined,
                      wordBreak: isDateTimeValue ? 'break-word' : undefined,
                    }}
                  >
                    {formatSensorValue(sensorType, reading.value, decimals)}
                    {unit ? (
                      <Box component="span" sx={{ color: 'text.secondary', ml: 1, fontSize: '2.125rem', fontWeight: 500 }}>
                        {unit}
                      </Box>
                    ) : null}
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
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
              {enableForecast && (
                <ButtonGroup size="small" variant="outlined">
                  {forecastRanges.map((range) => (
                    <Button
                      key={range.label}
                      onClick={() => setForecastHours(forecastHours === range.hours ? null : range.hours)}
                      variant={forecastHours === range.hours ? 'contained' : 'outlined'}
                      sx={{
                        borderColor: 'rgba(168, 85, 247, 0.4)',
                        color: forecastHours === range.hours ? '#fff' : 'rgba(168, 85, 247, 0.85)',
                        '&.MuiButton-contained': { backgroundColor: 'rgba(168, 85, 247, 0.7)' },
                        '&:hover': { borderColor: 'rgba(168, 85, 247, 0.6)', backgroundColor: 'rgba(168, 85, 247, 0.1)' },
                      }}
                      disabled={forecastLoading}
                    >
                      {range.label}
                    </Button>
                  ))}
                </ButtonGroup>
              )}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            {statistics ? (
              <>
                <StatisticPanel sensorType={sensorType} label="Lowest" value={statistics.min} unit={unit} decimals={decimals} />
                <StatisticPanel sensorType={sensorType} label="Highest" value={statistics.max} unit={unit} decimals={decimals} />
                <StatisticPanel sensorType={sensorType} label="Median" value={statistics.median} unit={unit} decimals={decimals} />
                <StatisticPanel sensorType={sensorType} label="Average" value={statistics.average} unit={unit} decimals={decimals} />
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
              position: 'relative',
            }}
          >
            {forecastData.length > 0 && (
              <Chip
                label="BETA"
                size="small"
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 1,
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  color: '#a855f7',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.05em',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  height: 22,
                }}
              />
            )}
            <SensorHistoryChart
              sensorType={sensorType}
              label={label}
              unit={unit}
              decimals={decimals}
              history={sensorHistory}
              forecast={forecastData.length > 0 ? forecastData : undefined}
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

const sensorTypeConfig: Record<string, { label: string; unit: string; decimals: number; icon: React.ReactNode; color: string }> = {
  CO2: { label: 'CO2', unit: 'ppm', decimals: 0, icon: <Co2RoundedIcon />, color: '#5c8dff' },
  CO2AverageLastHour: { label: 'CO2 avg 1h', unit: 'ppm', decimals: 0, icon: <Co2RoundedIcon />, color: '#4f7df3' },
  CO2AverageLast24Hours: { label: 'CO2 avg 24h', unit: 'ppm', decimals: 0, icon: <Co2RoundedIcon />, color: '#3d6be0' },
  CO2LastUsedCalibrationValue: { label: 'CO2 calibration', unit: 'ppm', decimals: 0, icon: <Co2RoundedIcon />, color: '#6d8fff' },
  CO2MinutesToNextCalibration: { label: 'Minutes to calibration', unit: 'min', decimals: 0, icon: <Co2RoundedIcon />, color: '#8aa4ff' },
  Temperature: { label: 'Temperature', unit: '\u00B0C', decimals: 2, icon: <ThermostatRoundedIcon />, color: '#ff6b6b' },
  TemperatureAverageLastHour: { label: 'Temperature avg 1h', unit: '\u00B0C', decimals: 2, icon: <ThermostatRoundedIcon />, color: '#ff8a7a' },
  TemperatureAverageLast24Hours: { label: 'Temperature avg 24h', unit: '\u00B0C', decimals: 2, icon: <ThermostatRoundedIcon />, color: '#ff9f8f' },
  Humidity: { label: 'Humidity', unit: '%', decimals: 1, icon: <WaterDropRoundedIcon />, color: '#38c7ff' },
  HumidityAverageLastHour: { label: 'Humidity avg 1h', unit: '%', decimals: 1, icon: <WaterDropRoundedIcon />, color: '#2bb7ed' },
  HumidityAverageLast24Hours: { label: 'Humidity avg 24h', unit: '%', decimals: 1, icon: <WaterDropRoundedIcon />, color: '#1fa8da' },
  Sound: { label: 'Sound level', unit: 'dB', decimals: 0, icon: <VolumeUpRoundedIcon />, color: '#f5c451' },
  SoundAverageLastHour: { label: 'Sound avg 1h', unit: 'dB', decimals: 0, icon: <VolumeUpRoundedIcon />, color: '#dca93f' },
  OnTimeInDays: { label: 'On time', unit: 'days', decimals: 0, icon: <SpeedRoundedIcon />, color: '#7dd3fc' },
  OperatingTimeInDays: { label: 'Operating time', unit: 'days', decimals: 0, icon: <SpeedRoundedIcon />, color: '#38bdf8' },
  ProductVersion: { label: 'Product version', unit: '', decimals: 0, icon: <SpeedRoundedIcon />, color: '#94a3b8' },
  Flow: { label: 'Flow', unit: 'l/h', decimals: 0, icon: <SpeedRoundedIcon />, color: '#a78bfa' },
  RSSI: { label: 'Signal strength', unit: 'dBm', decimals: 0, icon: <RouterRoundedIcon />, color: '#22c55e' },
  Volume: { label: 'Volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#34d399' },
  TotalVolume: { label: 'Total volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#34d399' },
  PositiveVolume: { label: 'Forward volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#2dd4bf' },
  NegativeVolume: { label: 'Reverse volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#f97316' },
  LastMonthVolume: { label: 'Last month volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#10b981' },
  LastMonthPositiveVolume: { label: 'Last month forward', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#14b8a6' },
  LastMonthNegativeVolume: { label: 'Last month reverse', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#fb7185' },
  OnDate: { label: 'Sensor time', unit: '', decimals: 0, icon: <SpeedRoundedIcon />, color: '#818cf8' },
  OnTime: { label: 'On time', unit: '', decimals: 0, icon: <SpeedRoundedIcon />, color: '#6366f1' },
  RemainingBattery: { label: 'Battery remaining', unit: '%', decimals: 0, icon: <SpeedRoundedIcon />, color: '#f59e0b' },
  AlarmCode: { label: 'Alarm code', unit: '', decimals: 0, icon: <SpeedRoundedIcon />, color: '#ef4444' },
  HasAlarm: { label: 'Alarm active', unit: '', decimals: 0, icon: <SpeedRoundedIcon />, color: '#dc2626' },
  ErrorFreeTimeSeconds: { label: 'Error-free time', unit: 's', decimals: 0, icon: <SpeedRoundedIcon />, color: '#60a5fa' },
};

const defaultConfig = { label: 'Unknown', unit: '', decimals: 3, icon: <SpeedRoundedIcon />, color: '#999' };

const timeRanges = [
  { label: '3h', hours: 3 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '3d', hours: 24 * 3 },
  { label: '1w', hours: 24 * 7 },
  { label: '1m', hours: 24 * 30 },
] as const;

interface SensorsViewProps {
  initialSensorId?: string;
  locationId?: string;
  locationName?: string;
  onBack?: () => void;
  onNavigateToGateway?: (gatewayId: string) => void;
}

function SensorsView({ initialSensorId, locationId, locationName, onBack, onNavigateToGateway }: SensorsViewProps) {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [devices, setDevices] = useState<SensorListItemDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [gatewayStats, setGatewayStats] = useState<SensorGatewayDto[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState(initialSensorId ?? '');
  const [hours, setHours] = useState(3);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [editSettingsOpen, setEditSettingsOpen] = useState(false);
  const [lastReadingHighlightUntil, setLastReadingHighlightUntil] = useState(0);
  const { readings, history, connected } = useSensorHub(selectedSensorId, hours);

  const openFullscreen = useCallback((sensorType: string) => {
    navigate(`/sensors/${encodeURIComponent(selectedSensorId)}/${encodeURIComponent(sensorType)}`, {
      state: { from: routerLocation.pathname },
    });
  }, [navigate, selectedSensorId, routerLocation.pathname]);

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

  useEffect(() => {
    if (!selectedSensorId) {
      setGatewayStats([]);
      return;
    }

    getSensorGateways(selectedSensorId)
      .then(setGatewayStats)
      .catch((err: unknown) => {
        console.error('Failed to fetch sensor gateways:', err);
        setGatewayStats([]);
      });
  }, [selectedSensorId]);

  const selectedDevice = devices.find((d) => d.uniqueId === selectedSensorId);
  const activeSensorTypes = Object.keys(readings);
  const deviceSelectValue = devices.some((device) => device.uniqueId === selectedSensorId)
    ? selectedSensorId
    : '';
  const latestReadingTimestamp = Object.values(readings).reduce<string | null>((latest, reading) => {
    if (!latest) {
      return reading.timestamp;
    }

    return new Date(reading.timestamp).getTime() > new Date(latest).getTime()
      ? reading.timestamp
      : latest;
  }, null);
  const displayedLastReading = latestReadingTimestamp ?? selectedDevice?.lastContact ?? null;
  const handleDeviceUpdated = (updatedDevice: SensorListItemDto) => {
    setDevices((prev) => prev.map((device) => device.id === updatedDevice.id ? updatedDevice : device));
  };

  useEffect(() => {
    if (!selectedSensorId || !latestReadingTimestamp) {
      return;
    }

    setDevices((previous) => previous.map((device) => {
      if (device.uniqueId !== selectedSensorId) {
        return device;
      }

      if (new Date(device.lastContact).getTime() >= new Date(latestReadingTimestamp).getTime()) {
        return device;
      }

      return {
        ...device,
        lastContact: latestReadingTimestamp,
      };
    }));

    if (selectedDevice && new Date(latestReadingTimestamp).getTime() > new Date(selectedDevice.lastContact).getTime()) {
      setLastReadingHighlightUntil(Date.now() + 2500);
    }
  }, [latestReadingTimestamp, selectedDevice, selectedSensorId]);

  useEffect(() => {
    if (lastReadingHighlightUntil <= Date.now()) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setLastReadingHighlightUntil(0);
    }, Math.max(0, lastReadingHighlightUntil - Date.now()));

    return () => window.clearTimeout(timeout);
  }, [lastReadingHighlightUntil]);

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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                <Chip
                  label={`First reading: ${formatDateLabel(selectedDevice.installationDate)}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    color: 'text.secondary',
                    borderColor: 'rgba(255,255,255,0.12)',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  }}
                />
                <Chip
                  label={`Last reading: ${displayedLastReading ? formatDateLabel(displayedLastReading) : '-'}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    color: Date.now() < lastReadingHighlightUntil ? 'primary.light' : 'text.secondary',
                    borderColor: Date.now() < lastReadingHighlightUntil ? 'rgba(92, 141, 255, 0.45)' : 'rgba(255,255,255,0.12)',
                    backgroundColor: Date.now() < lastReadingHighlightUntil ? 'rgba(92, 141, 255, 0.12)' : 'rgba(255,255,255,0.03)',
                    boxShadow: Date.now() < lastReadingHighlightUntil ? '0 0 12px rgba(92, 141, 255, 0.25)' : 'none',
                    transition: 'color 200ms ease, background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
                  }}
                />
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
                decimals={config.decimals}
                icon={config.icon}
                reading={readings[sensorType]}
                history={history[sensorType] ?? []}
                color={config.color}
                hours={hours}
                onOpenFullscreen={openFullscreen}
              />
            );
          })}
        </Stack>
      </Paper>

      <Paper
        sx={{
          mt: 2,
          p: { xs: 2.5, md: 3 },
          borderRadius: '6px',
          backgroundColor: 'rgba(36, 42, 51, 0.82)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
        }}
      >
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Gateways
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Gateways that have reported this sensor, with average RSSI across stored readings.
        </Typography>

        {gatewayStats.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No gateway data recorded for this sensor yet.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {gatewayStats.map((gateway) => (
              <Paper
                key={gateway.gatewayId}
                variant="outlined"
                sx={{
                  p: 2,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Box>
                    {onNavigateToGateway ? (
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => onNavigateToGateway(gateway.gatewayId)}
                        sx={{ minWidth: 0, px: 0, fontWeight: 700, textTransform: 'none' }}
                      >
                        {gateway.gatewayId}
                      </Button>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {gateway.gatewayId}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Last seen: {formatDateLabel(gateway.lastSeenAt)}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Readings: {gateway.readingCount}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Avg RSSI: {formatAverageRssi(gateway.averageRssi)}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <EditSensorLocationDialog
        open={editLocationOpen}
        device={selectedDevice ?? null}
        locations={locations}
        onClose={() => setEditLocationOpen(false)}
        onSaved={handleDeviceUpdated}
      />

      <EditSensorSettingsDialog
        open={editSettingsOpen}
        device={selectedDevice ?? null}
        locations={locations}
        onClose={() => setEditSettingsOpen(false)}
        onSaved={handleDeviceUpdated}
      />
    </>
  );
}

export default SensorsView;
