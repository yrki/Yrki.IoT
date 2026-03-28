import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import Co2RoundedIcon from '@mui/icons-material/Co2Rounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import WaterRoundedIcon from '@mui/icons-material/WaterRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useSensorHub, SensorReading, SensorDataPoint } from './useSensorHub';
import { getSensorIds } from '../../api/api';

interface SensorCardProps {
  label: string;
  unit: string;
  icon: React.ReactNode;
  reading: SensorReading | undefined;
  history: SensorDataPoint[];
  color: string;
  hours: number;
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

function formatValue(value: number, unit: string) {
  if (unit === 'ppm' || unit === 'dB') return Math.round(value);
  return value.toFixed(1);
}

function SensorCard({ label, unit, icon, reading, history, color, hours }: SensorCardProps) {
  const showDate = hours > 24;
  const tickFormatter = showDate ? formatDateTime : formatTime;

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
      </Stack>

      {reading ? (
        <>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>
            {formatValue(reading.value, unit)}
            <Typography component="span" variant="h5" sx={{ color: 'text.secondary', ml: 0.5 }}>
              {unit}
            </Typography>
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

      <Box sx={{ width: '100%', height: 120 }}>
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
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
                fill={`url(#grad-${label})`}
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
    </Paper>
  );
}

const sensorTypeConfig: Record<string, { label: string; unit: string; icon: React.ReactNode; color: string }> = {
  CO2: { label: 'CO2', unit: 'ppm', icon: <Co2RoundedIcon />, color: '#5c8dff' },
  Temperature: { label: 'Temperature', unit: '\u00B0C', icon: <ThermostatRoundedIcon />, color: '#ff6b6b' },
  Humidity: { label: 'Humidity', unit: '%', icon: <WaterDropRoundedIcon />, color: '#38c7ff' },
  Sound: { label: 'Sound level', unit: 'dB', icon: <VolumeUpRoundedIcon />, color: '#f5c451' },
  Flow: { label: 'Flow', unit: 'l/h', icon: <SpeedRoundedIcon />, color: '#a78bfa' },
  Volume: { label: 'Volume', unit: 'm\u00B3', icon: <WaterRoundedIcon />, color: '#34d399' },
};

const defaultConfig = { label: 'Unknown', unit: '', icon: <SpeedRoundedIcon />, color: '#999' };

const timeRanges = [
  { label: '3h', hours: 3 },
  { label: '12h', hours: 12 },
  { label: '1w', hours: 24 * 7 },
  { label: '1m', hours: 24 * 30 },
] as const;

const DEFAULT_SENSOR_ID = 'LSN-67000205';

function SensorsView() {
  const [sensorIds, setSensorIds] = useState<string[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState(DEFAULT_SENSOR_ID);
  const [hours, setHours] = useState(3);
  const { readings, history, connected } = useSensorHub(selectedSensorId, hours);

  useEffect(() => {
    getSensorIds()
      .then((ids) => {
        setSensorIds(ids);
        if (ids.length > 0 && !ids.includes(selectedSensorId)) {
          setSelectedSensorId(ids[0]);
        }
      })
      .catch((err) => console.error('Failed to fetch sensor IDs:', err));
  }, []);

  const activeSensorTypes = Object.keys(readings);

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
            Live Sensors
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Real-time sensor readings via SignalR.
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Device</InputLabel>
          <Select
            value={selectedSensorId}
            label="Device"
            onChange={(e) => setSelectedSensorId(e.target.value)}
          >
            {sensorIds.map((id) => (
              <MenuItem key={id} value={id}>
                {id}
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
              label={config.label}
              unit={config.unit}
              icon={config.icon}
              reading={readings[sensorType]}
              history={history[sensorType] ?? []}
              color={config.color}
              hours={hours}
            />
          );
        })}
      </Stack>
    </Paper>
  );
}

export default SensorsView;
