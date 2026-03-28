import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import Co2RoundedIcon from '@mui/icons-material/Co2Rounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { useSensorHub, SensorReading } from './useSensorHub';

interface SensorCardProps {
  label: string;
  unit: string;
  icon: React.ReactNode;
  reading: SensorReading | undefined;
  color: string;
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function SensorCard({ label, unit, icon, reading, color }: SensorCardProps) {
  return (
    <Paper
      sx={{
        p: 3,
        flex: '1 1 220px',
        minWidth: 220,
        backgroundColor: 'rgba(36, 42, 51, 0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
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
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Last reading: {formatTimestamp(reading.timestamp)}
          </Typography>
        </>
      ) : (
        <Typography variant="h5" sx={{ color: 'text.secondary' }}>
          Waiting for data...
        </Typography>
      )}
    </Paper>
  );
}

function formatValue(value: number, unit: string) {
  if (unit === 'ppm' || unit === 'dB') return Math.round(value);
  return value.toFixed(1);
}

const sensorCards = [
  { sensorType: 'CO2', label: 'CO2', unit: 'ppm', icon: <Co2RoundedIcon />, color: '#5c8dff' },
  { sensorType: 'Temperature', label: 'Temperature', unit: '\u00B0C', icon: <ThermostatRoundedIcon />, color: '#ff6b6b' },
  { sensorType: 'Humidity', label: 'Humidity', unit: '%', icon: <WaterDropRoundedIcon />, color: '#38c7ff' },
  { sensorType: 'Sound', label: 'Sound level', unit: 'dB', icon: <VolumeUpRoundedIcon />, color: '#f5c451' },
] as const;

function SensorsView() {
  const { readings, connected } = useSensorHub();

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
        <Chip
          label={connected ? 'Connected' : 'Disconnected'}
          color={connected ? 'success' : 'error'}
          size="small"
          variant="outlined"
        />
      </Stack>

      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
        {sensorCards.map((card) => (
          <SensorCard
            key={card.sensorType}
            label={card.label}
            unit={card.unit}
            icon={card.icon}
            reading={readings[card.sensorType]}
            color={card.color}
          />
        ))}
      </Stack>
    </Paper>
  );
}

export default SensorsView;
