import { useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { deleteDevice, getDevices, SensorListItemDto } from '../../api/api';

type SortableField = 'uniqueId' | 'name' | 'manufacturer' | 'type' | 'locationName' | 'lastContact';
type SortDirection = 'asc' | 'desc';

interface SensorListViewProps {
  onNavigateToLiveView: (sensorId: string) => void;
}

const activityFadeDurationMs = 6 * 60 * 60 * 1000;
const activityBlinkDurationMs = 2500;
const sensorRefreshIntervalMs = 5 * 60 * 1000;
const HUB_URL = import.meta.env.VITE_SIGNALR_URL ?? '/hubs/sensors';

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
}

function getActivityProgress(lastContact: string, now: number) {
  const ageMs = Math.max(0, now - new Date(lastContact).getTime());
  return Math.max(0, 1 - ageMs / activityFadeDurationMs);
}

function getActivityLabel(lastContact: string, now: number) {
  const ageMs = Math.max(0, now - new Date(lastContact).getTime());
  if (ageMs < 60_000) {
    return 'Receiving now';
  }

  if (ageMs >= activityFadeDurationMs) {
    return 'No signal in the last 6 hours';
  }

  const ageMinutes = Math.round(ageMs / 60_000);
  if (ageMinutes < 60) {
    return `Seen ${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `Seen ${ageHours} hour${ageHours === 1 ? '' : 's'} ago`;
}

function buildConnection() {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}

function SensorListView({ onNavigateToLiveView }: SensorListViewProps) {
  const [sensors, setSensors] = useState<SensorListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('uniqueId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterManufacturer, setFilterManufacturer] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SensorListItemDto | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [recentlyUpdatedSensors, setRecentlyUpdatedSensors] = useState<Record<string, number>>({});
  const previousContactsRef = useRef<Record<string, string>>({});

  const loadSensors = () => {
    getDevices()
      .then((nextSensors) => {
        const now = Date.now();
        const nextContacts: Record<string, string> = {};

        for (const sensor of nextSensors) {
          nextContacts[sensor.uniqueId] = sensor.lastContact;
        }

        setRecentlyUpdatedSensors((previous) => {
          const next = { ...previous };

          for (const sensor of nextSensors) {
            const previousContact = previousContactsRef.current[sensor.uniqueId];
            if (previousContact && previousContact !== sensor.lastContact) {
              next[sensor.uniqueId] = now + activityBlinkDurationMs;
            }
          }

          for (const [sensorId, expiresAt] of Object.entries(next)) {
            if (expiresAt <= now) {
              delete next[sensorId];
            }
          }

          return next;
        });

        previousContactsRef.current = nextContacts;
        setSensors(nextSensors);
      })
      .catch((err) => console.error('Failed to fetch sensors:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSensors();

    const refreshInterval = window.setInterval(() => {
      loadSensors();
    }, sensorRefreshIntervalMs);

    const clockInterval = window.setInterval(() => {
      setCurrentTime(Date.now());
      setRecentlyUpdatedSensors((previous) => {
        const now = Date.now();
        const next = { ...previous };

        for (const [sensorId, expiresAt] of Object.entries(next)) {
          if (expiresAt <= now) {
            delete next[sensorId];
          }
        }

        return next;
      });
    }, 60_000);

    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(clockInterval);
    };
  }, []);

  useEffect(() => {
    const connection = buildConnection();

    connection.on('SensorReadingReceived', (reading: { sensorId: string; timestamp: string }) => {
      const now = Date.now();

      setSensors((previous) => previous.map((sensor) => {
        if (sensor.uniqueId !== reading.sensorId) {
          return sensor;
        }

        if (new Date(sensor.lastContact).getTime() >= new Date(reading.timestamp).getTime()) {
          return sensor;
        }

        return {
          ...sensor,
          lastContact: reading.timestamp,
        };
      }));

      setCurrentTime(now);
      setRecentlyUpdatedSensors((previous) => ({
        ...previous,
        [reading.sensorId]: now + activityBlinkDurationMs,
      }));
      previousContactsRef.current[reading.sensorId] = reading.timestamp;
    });

    connection.start().catch((err) => console.error('SignalR connect failed:', err));

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.stop();
      }
    };
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDevice(deleteTarget.id);
    setDeleteTarget(null);
    loadSensors();
  };

  const manufacturers = useMemo(() => [...new Set(sensors.map((s) => s.manufacturer).filter(Boolean))] as string[], [sensors]);
  const types = useMemo(() => [...new Set(sensors.map((s) => s.type).filter(Boolean))] as string[], [sensors]);

  const filteredSensors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const normalizedTerm = normalizeSearchValue(searchTerm.trim());

    return [...sensors]
      .filter((s) => {
        if (filterManufacturer && s.manufacturer !== filterManufacturer) return false;
        if (filterType && s.type !== filterType) return false;
        if (!term) return true;

        const fields = [s.id, s.uniqueId, s.name, s.manufacturer, s.type, s.locationName];

        return fields.some((value) => {
          if (!value) return false;

          const rawValue = value.toLowerCase();
          return rawValue.includes(term) || normalizeSearchValue(value).includes(normalizedTerm);
        });
      })
      .sort((a, b) => {
        const av = String(a[sortBy] ?? '');
        const bv = String(b[sortBy] ?? '');
        return sortDirection === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [sensors, searchTerm, sortBy, sortDirection, filterManufacturer, filterType]);

  const handleSort = (column: SortableField) => {
    if (sortBy === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const columns: Array<{ id: SortableField; label: string }> = [
    { id: 'uniqueId', label: 'Sensor ID' },
    { id: 'name', label: 'Name' },
    { id: 'manufacturer', label: 'Manufacturer' },
    { id: 'type', label: 'Type' },
    { id: 'locationName', label: 'Location' },
    { id: 'lastContact', label: 'Last Contact' },
  ];

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
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', lg: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ mb: 0.75 }}>
            Sensors
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Registered sensors. Click a sensor to view live data.
          </Typography>
        </Box>
        <TextField
          placeholder="Search sensors by name, uniqueId or location"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: { sm: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
        <Chip label={`${filteredSensors.length} sensor${filteredSensors.length === 1 ? '' : 's'}`} />
        {manufacturers.map((m) => (
          <Chip
            key={`m-${m}`}
            label={m}
            size="small"
            variant={filterManufacturer === m ? 'filled' : 'outlined'}
            color={filterManufacturer === m ? 'primary' : 'default'}
            onClick={() => setFilterManufacturer(filterManufacturer === m ? null : m)}
          />
        ))}
        {types.map((t) => (
          <Chip
            key={`t-${t}`}
            label={t}
            size="small"
            variant={filterType === t ? 'filled' : 'outlined'}
            color={filterType === t ? 'secondary' : 'default'}
            onClick={() => setFilterType(filterType === t ? null : t)}
          />
        ))}
      </Stack>

      <TableContainer
        sx={{
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(23, 26, 32, 0.44)',
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <TableSortLabel
                    active={sortBy === col.id}
                    direction={sortBy === col.id ? sortDirection : 'asc'}
                    onClick={() => handleSort(col.id)}
                    sx={{
                      color: 'text.primary',
                      '&.Mui-active': { color: 'text.primary' },
                      '& .MuiTableSortLabel-icon': { color: 'text.secondary !important' },
                    }}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderBottomColor: 'rgba(255,255,255,0.06)',
                  width: 100,
                }}
              />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSensors.map((sensor) => (
              <TableRow
                key={sensor.id}
                hover
                sx={{
                  cursor: 'pointer',
                  '&:last-child td': { borderBottom: 0 },
                  '& .MuiTableCell-root': { borderBottomColor: 'rgba(255,255,255,0.06)' },
                }}
                onClick={() => onNavigateToLiveView(sensor.uniqueId)}
              >
                <TableCell>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Tooltip title={getActivityLabel(sensor.lastContact, currentTime)}>
                      <Box
                        data-testid={`sensor-activity-${sensor.id}`}
                        aria-label={getActivityLabel(sensor.lastContact, currentTime)}
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '999px',
                          flexShrink: 0,
                          backgroundColor: (() => {
                            const progress = getActivityProgress(sensor.lastContact, currentTime);
                            if (progress <= 0) {
                              return 'rgba(148, 163, 184, 0.55)';
                            }

                            const green = Math.round(120 + progress * 90);
                            const red = Math.round(148 - progress * 88);
                            return `rgba(${red}, ${green}, 105, ${0.35 + progress * 0.65})`;
                          })(),
                          boxShadow: (() => {
                            const progress = getActivityProgress(sensor.lastContact, currentTime);
                            if (progress <= 0) {
                              return '0 0 0 1px rgba(148, 163, 184, 0.2)';
                            }

                            return `0 0 ${6 + progress * 10}px rgba(34, 197, 94, ${0.2 + progress * 0.5})`;
                          })(),
                          animation: recentlyUpdatedSensors[sensor.uniqueId]
                            ? 'sensorActivityPulse 0.9s ease-in-out 2'
                            : 'none',
                          '@keyframes sensorActivityPulse': {
                            '0%': { transform: 'scale(1)', opacity: 0.75 },
                            '45%': { transform: 'scale(1.8)', opacity: 1 },
                            '100%': { transform: 'scale(1)', opacity: 0.8 },
                          },
                        }}
                      />
                    </Tooltip>
                    <Typography component="span" sx={{ fontFamily: 'monospace' }}>
                      {sensor.uniqueId}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>{sensor.name ?? '-'}</TableCell>
                <TableCell>{sensor.manufacturer ?? '-'}</TableCell>
                <TableCell>{sensor.type}</TableCell>
                <TableCell>{sensor.locationName ?? '-'}</TableCell>
                <TableCell>{new Date(sensor.lastContact).toLocaleString()}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="View live data">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToLiveView(sensor.uniqueId);
                        }}
                      >
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete sensor">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(sensor);
                        }}
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredSensors.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  {sensors.length === 0 ? 'No sensors registered yet.' : 'No sensors match the search.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete sensor</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Do you really want to delete {deleteTarget?.name ?? deleteTarget?.uniqueId}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default SensorListView;
