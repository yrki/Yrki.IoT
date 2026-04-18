import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import Co2RoundedIcon from '@mui/icons-material/Co2Rounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import WaterRoundedIcon from '@mui/icons-material/WaterRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import RouterRoundedIcon from '@mui/icons-material/RouterRounded';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useSensorHub, SensorDataPoint } from './useSensorHub';
import { getSensorForecast, getDeviceByUniqueId, SensorListItemDto } from '../../api/api';
import { calculateSensorStatistics } from './sensorStats';

const enableForecast = import.meta.env.DEV || import.meta.env.VITE_ENABLE_FORECAST === 'true';

const forecastColor = '#a855f7';

const timeRanges = [
  { label: '-1m', hours: 24 * 30 },
  { label: '-1w', hours: 24 * 7 },
  { label: '-3d', hours: 24 * 3 },
  { label: '-1d', hours: 24 },
] as const;

const forecastRanges = [
  { label: '+1d', hours: 24 },
  { label: '+3d', hours: 72 },
  { label: '+1w', hours: 168 },
  { label: '+1m', hours: 720 },
] as const;

const sensorTypeConfig: Record<string, { label: string; unit: string; decimals: number; icon: React.ReactNode; color: string }> = {
  CO2: { label: 'CO2', unit: 'ppm', decimals: 0, icon: <Co2RoundedIcon />, color: '#5c8dff' },
  CO2AverageLastHour: { label: 'CO2 avg 1h', unit: 'ppm', decimals: 0, icon: <Co2RoundedIcon />, color: '#4f7df3' },
  CO2AverageLast24Hours: { label: 'CO2 avg 24h', unit: 'ppm', decimals: 0, icon: <Co2RoundedIcon />, color: '#3d6be0' },
  Temperature: { label: 'Temperature', unit: '\u00B0C', decimals: 2, icon: <ThermostatRoundedIcon />, color: '#ff6b6b' },
  TemperatureAverageLastHour: { label: 'Temperature avg 1h', unit: '\u00B0C', decimals: 2, icon: <ThermostatRoundedIcon />, color: '#ff8a7a' },
  TemperatureAverageLast24Hours: { label: 'Temperature avg 24h', unit: '\u00B0C', decimals: 2, icon: <ThermostatRoundedIcon />, color: '#ff9f8f' },
  Humidity: { label: 'Humidity', unit: '%', decimals: 1, icon: <WaterDropRoundedIcon />, color: '#38c7ff' },
  HumidityAverageLastHour: { label: 'Humidity avg 1h', unit: '%', decimals: 1, icon: <WaterDropRoundedIcon />, color: '#2bb7ed' },
  HumidityAverageLast24Hours: { label: 'Humidity avg 24h', unit: '%', decimals: 1, icon: <WaterDropRoundedIcon />, color: '#1fa8da' },
  Sound: { label: 'Sound level', unit: 'dB', decimals: 0, icon: <VolumeUpRoundedIcon />, color: '#f5c451' },
  SoundAverageLastHour: { label: 'Sound avg 1h', unit: 'dB', decimals: 0, icon: <VolumeUpRoundedIcon />, color: '#dca93f' },
  Flow: { label: 'Flow', unit: 'l/h', decimals: 0, icon: <SpeedRoundedIcon />, color: '#a78bfa' },
  RSSI: { label: 'Signal strength', unit: 'dBm', decimals: 0, icon: <RouterRoundedIcon />, color: '#22c55e' },
  Volume: { label: 'Volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#34d399' },
  TotalVolume: { label: 'Total volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#34d399' },
  PositiveVolume: { label: 'Forward volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#2dd4bf' },
  NegativeVolume: { label: 'Reverse volume', unit: 'm\u00B3', decimals: 3, icon: <WaterRoundedIcon />, color: '#f97316' },
  RemainingBattery: { label: 'Battery remaining', unit: '%', decimals: 0, icon: <SpeedRoundedIcon />, color: '#f59e0b' },
  OnTimeInDays: { label: 'On time', unit: 'days', decimals: 0, icon: <SpeedRoundedIcon />, color: '#7dd3fc' },
  OperatingTimeInDays: { label: 'Operating time', unit: 'days', decimals: 0, icon: <SpeedRoundedIcon />, color: '#38bdf8' },
};

const defaultConfig = { label: 'Unknown', unit: '', decimals: 3, icon: <SpeedRoundedIcon />, color: '#999' };

function formatTime(epoch: number) {
  return new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateTime(epoch: number) {
  return new Date(epoch).toLocaleDateString([], { day: 'numeric', month: 'short' })
    + ' ' + new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatValue(value: number, decimals: number) {
  return value.toFixed(decimals);
}

function formatUtcDateTimeFromUnixSeconds(value: number) {
  return `${new Date(value * 1000).toLocaleString([], {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })} UTC`;
}

function formatUtcTimeFromUnixSeconds(value: number) {
  return `${new Date(value * 1000).toLocaleTimeString([], { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false })} UTC`;
}

function formatSensorValue(sensorType: string, value: number, decimals: number) {
  return sensorType === 'OnDate' ? formatUtcDateTimeFromUnixSeconds(value) : formatValue(value, decimals);
}

function toLocalDateTimeString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface ChartDataPoint {
  time: number;
  value?: number;
  forecast?: number;
}

function StatisticPanel({ label, value, unit, decimals, sensorType }: {
  label: string; value: number; unit: string; decimals: number; sensorType: string;
}) {
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5, minWidth: 120, backgroundColor: 'rgba(23, 26, 32, 0.44)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {formatSensorValue(sensorType, value, decimals)}
        {unit && <Box component="span" sx={{ color: 'text.secondary', ml: 0.5, fontSize: '0.85rem', fontWeight: 400 }}>{unit}</Box>}
      </Typography>
    </Paper>
  );
}

interface SensorFullscreenPageProps {
  sensorId: string;
  sensorType: string;
  onBack: () => void;
}

function SensorFullscreenPage({ sensorId, sensorType, onBack }: SensorFullscreenPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [device, setDevice] = useState<SensorListItemDto | null>(null);
  const [forecastData, setForecastData] = useState<SensorDataPoint[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);

  const fromParam = searchParams.get('from') || undefined;
  const toParam = searchParams.get('to') || undefined;
  const hoursParam = searchParams.get('hours') ? parseInt(searchParams.get('hours')!, 10) : (fromParam && toParam ? null : 24);
  const forecastHoursParam = searchParams.get('forecast') ? parseInt(searchParams.get('forecast')!, 10) : null;

  const hours = fromParam && toParam ? 0 : (hoursParam ?? 24);

  const [customFrom, setCustomFrom] = useState(fromParam ? toLocalDateTimeString(new Date(fromParam)) : '');
  const [customTo, setCustomTo] = useState(toParam ? toLocalDateTimeString(new Date(toParam)) : '');

  const { readings, history } = useSensorHub(sensorId, hours, true, fromParam, toParam);

  const config = sensorTypeConfig[sensorType] ?? { ...defaultConfig, label: sensorType };
  const { label, unit, decimals, icon, color } = config;
  const reading = readings[sensorType];
  const sensorHistory = history[sensorType] ?? [];
  const statistics = calculateSensorStatistics(sensorHistory);

  useEffect(() => {
    getDeviceByUniqueId(sensorId)
      .then(setDevice)
      .catch(() => setDevice(null));
  }, [sensorId]);

  useEffect(() => {
    if (!forecastHoursParam) {
      setForecastData([]);
      return;
    }

    let cancelled = false;
    setForecastLoading(true);

    getSensorForecast(sensorId, sensorType, forecastHoursParam)
      .then((points) => {
        if (cancelled) return;
        setForecastData(points.map((p) => ({ time: new Date(p.timestamp).getTime(), value: p.value })));
      })
      .catch((err) => { if (!cancelled) console.error('Failed to fetch forecast:', err); })
      .finally(() => { if (!cancelled) setForecastLoading(false); });

    return () => { cancelled = true; };
  }, [sensorId, sensorType, forecastHoursParam]);

  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  };

  const selectPresetRange = (h: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - h * 60 * 60 * 1000);
    setCustomFrom(toLocalDateTimeString(from));
    setCustomTo(toLocalDateTimeString(to));
    updateParams({
      from: from.toISOString(),
      to: to.toISOString(),
      hours: String(h),
    });
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    updateParams({
      from: new Date(customFrom).toISOString(),
      to: new Date(customTo).toISOString(),
      hours: null,
    });
  };

  const toggleForecast = (fh: number) => {
    updateParams({ forecast: forecastHoursParam === fh ? null : String(fh) });
  };

  // Chart
  const showDate = hours > 24 || (fromParam && toParam) || forecastData.length > 0;
  const tickFormatter = showDate ? formatDateTime : formatTime;
  const gradientId = useId();
  const forecastGradientId = gradientId + '-fc';
  const yAxisWidth = sensorType === 'OnDate' ? 88 : decimals >= 3 ? 64 : decimals >= 2 ? 56 : 48;

  const chartData: ChartDataPoint[] = [];
  for (const p of sensorHistory) {
    chartData.push({ time: p.time, value: p.value });
  }
  if (forecastData.length > 0 && sensorHistory.length > 0) {
    const last = sensorHistory[sensorHistory.length - 1];
    chartData.push({ time: last.time, value: last.value, forecast: last.value });
    for (const p of forecastData) {
      chartData.push({ time: p.time, forecast: p.value });
    }
  }
  chartData.sort((a, b) => a.time - b.time);

  const sensorName = device?.name ?? sensorId;
  const sensorLocation = device?.locationName ?? '';
  const subtitle = sensorLocation ? `${label} - ${sensorLocation}` : label;

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton onClick={onBack}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Box sx={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: '8px', backgroundColor: `${color}20`, color }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="h4">{sensorName}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>
          </Box>
        </Stack>

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
                  {formatSensorValue(sensorType, reading.value, decimals)}
                  {unit && <Box component="span" sx={{ color: 'text.secondary', ml: 1, fontSize: '2.125rem', fontWeight: 500 }}>{unit}</Box>}
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  Latest reading: {new Date(reading.timestamp).toLocaleString()}
                </Typography>
              </>
            ) : (
              <Typography variant="h4" sx={{ color: 'text.secondary' }}>Waiting for data...</Typography>
            )}
          </Box>
          <Stack spacing={1} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <ButtonGroup size="small" variant="outlined">
                {timeRanges.map((range) => (
                  <Button
                    key={range.label}
                    onClick={() => selectPresetRange(range.hours)}
                    variant={hoursParam === range.hours ? 'contained' : 'outlined'}
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
                      onClick={() => toggleForecast(range.hours)}
                      variant={forecastHoursParam === range.hours ? 'contained' : 'outlined'}
                      sx={{
                        borderColor: 'rgba(168, 85, 247, 0.4)',
                        color: forecastHoursParam === range.hours ? '#fff' : 'rgba(168, 85, 247, 0.85)',
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
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="From"
                type="datetime-local"
                size="small"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                onBlur={applyCustomRange}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 200 }}
              />
              <TextField
                label="To"
                type="datetime-local"
                size="small"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                onBlur={applyCustomRange}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 200 }}
              />
            </Stack>
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
            height: { xs: 360, md: 'calc(100vh - 420px)' },
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
                position: 'absolute', top: 12, right: 12, zIndex: 1,
                backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#a855f7',
                fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.05em',
                border: '1px solid rgba(168, 85, 247, 0.3)', height: 22,
              }}
            />
          )}
          <Box sx={{ width: '100%', height: '100%' }}>
            {sensorHistory.length > 1 ? (
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
                  <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={tickFormatter} tick={{ fill: '#a0a8b8', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={60} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#a0a8b8', fontSize: 11 }} axisLine={false} tickLine={false} width={yAxisWidth}
                    tickFormatter={(v: number) => sensorType === 'OnDate' ? formatUtcTimeFromUnixSeconds(v) : v.toFixed(decimals)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#20242c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12 }}
                    labelFormatter={(v) => new Date(v as number).toLocaleString([], { hour12: false })}
                    formatter={(v: number, name: string) => {
                      const formatted = sensorType === 'OnDate' ? formatSensorValue(sensorType, v, decimals) : `${formatSensorValue(sensorType, v, decimals)} ${unit}`;
                      return [formatted, name === 'forecast' ? 'Forecast' : label];
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} dot={false} connectNulls={false} />
                  {forecastData.length > 0 && (
                    <Area type="monotone" dataKey="forecast" stroke={forecastColor} strokeWidth={1.5} strokeDasharray="6 3" fill={`url(#${forecastGradientId})`} isAnimationActive={false} dot={false} connectNulls={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Collecting data...</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}

export default SensorFullscreenPage;
