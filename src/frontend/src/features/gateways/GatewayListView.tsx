import { useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import {
  Box,
  Chip,
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
import { getGateways, SensorListItemDto } from '../../api/api';

type SortableField = 'uniqueId' | 'name' | 'locationName' | 'lastContact';
type SortDirection = 'asc' | 'desc';

const activityFadeDurationMs = 6 * 60 * 60 * 1000;
const activityBlinkDurationMs = 2500;
const gatewayRefreshIntervalMs = 5 * 60 * 1000;
const HUB_URL = import.meta.env.VITE_SIGNALR_URL ?? '/hubs/sensors';

interface GatewayListViewProps {
  onNavigateToGateway: (gatewayId: string) => void;
}

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
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

function GatewayListView({ onNavigateToGateway }: GatewayListViewProps) {
  const [gateways, setGateways] = useState<SensorListItemDto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('lastContact');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [recentlyUpdated, setRecentlyUpdated] = useState<Record<string, number>>({});
  const previousContactsRef = useRef<Record<string, string>>({});

  const loadGateways = () => {
    getGateways()
      .then((nextGateways) => {
        const now = Date.now();
        const nextContacts: Record<string, string> = {};

        for (const gw of nextGateways) {
          nextContacts[gw.uniqueId] = gw.lastContact;
        }

        setRecentlyUpdated((previous) => {
          const next = { ...previous };

          for (const gw of nextGateways) {
            const previousContact = previousContactsRef.current[gw.uniqueId];
            if (previousContact && previousContact !== gw.lastContact) {
              next[gw.uniqueId] = now + activityBlinkDurationMs;
            }
          }

          for (const [id, expiresAt] of Object.entries(next)) {
            if (expiresAt <= now) {
              delete next[id];
            }
          }

          return next;
        });

        previousContactsRef.current = nextContacts;
        setGateways(nextGateways);
      })
      .catch((err) => console.error('Failed to fetch gateways:', err));
  };

  useEffect(() => {
    loadGateways();

    const refreshInterval = window.setInterval(loadGateways, gatewayRefreshIntervalMs);

    const clockInterval = window.setInterval(() => {
      setCurrentTime(Date.now());
      setRecentlyUpdated((previous) => {
        const now = Date.now();
        const next = { ...previous };

        for (const [id, expiresAt] of Object.entries(next)) {
          if (expiresAt <= now) {
            delete next[id];
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
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('GatewayPositionReceived', (position: { gatewayId: string; timestamp: string }) => {
      const now = Date.now();

      setGateways((previous) => previous.map((gw) => {
        if (gw.uniqueId !== position.gatewayId) {
          return gw;
        }

        if (new Date(gw.lastContact).getTime() >= new Date(position.timestamp).getTime()) {
          return gw;
        }

        return { ...gw, lastContact: position.timestamp };
      }));

      setCurrentTime(now);
      setRecentlyUpdated((previous) => ({
        ...previous,
        [position.gatewayId]: now + activityBlinkDurationMs,
      }));
      previousContactsRef.current[position.gatewayId] = position.timestamp;
    });

    connection.on('SensorReadingReceived', (reading: { sensorId: string; timestamp: string; gatewayId?: string }) => {
      if (!reading.gatewayId) return;

      const now = Date.now();

      setGateways((previous) => previous.map((gw) => {
        if (gw.uniqueId !== reading.gatewayId) {
          return gw;
        }

        if (new Date(gw.lastContact).getTime() >= new Date(reading.timestamp).getTime()) {
          return gw;
        }

        return { ...gw, lastContact: reading.timestamp };
      }));

      setCurrentTime(now);
      setRecentlyUpdated((previous) => ({
        ...previous,
        [reading.gatewayId!]: now + activityBlinkDurationMs,
      }));
      previousContactsRef.current[reading.gatewayId] = reading.timestamp;
    });

    connection.start().catch((err) => console.error('SignalR connect failed:', err));

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.stop();
      }
    };
  }, []);

  const filteredGateways = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const normalizedTerm = normalizeSearchValue(searchTerm.trim());

    return [...gateways]
      .filter((gateway) => {
        if (!term) {
          return true;
        }

        return [gateway.uniqueId, gateway.name, gateway.type, gateway.locationName]
          .filter(Boolean)
          .some((value) => {
            const rawValue = String(value).toLowerCase();
            return rawValue.includes(term) || normalizeSearchValue(String(value)).includes(normalizedTerm);
          });
      })
      .sort((left, right) => {
        const leftValue = String(left[sortBy] ?? '');
        const rightValue = String(right[sortBy] ?? '');
        return sortDirection === 'asc'
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      });
  }, [gateways, searchTerm, sortBy, sortDirection]);

  const handleSort = (column: SortableField) => {
    if (sortBy === column) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortBy(column);
    setSortDirection('asc');
  };

  const columns: Array<{ id: SortableField; label: string }> = [
    { id: 'uniqueId', label: 'Gateway ID' },
    { id: 'name', label: 'Name' },
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
            Gateways
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Registered gateways. Click a gateway to inspect sensor contacts.
          </Typography>
        </Box>
        <TextField
          placeholder="Search gateways"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
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
        <Chip label={`${filteredGateways.length} gateway${filteredGateways.length === 1 ? '' : 's'}`} />
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
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <TableSortLabel
                    active={sortBy === column.id}
                    direction={sortBy === column.id ? sortDirection : 'asc'}
                    onClick={() => handleSort(column.id)}
                    sx={{
                      color: 'text.primary',
                      '&.Mui-active': { color: 'text.primary' },
                      '& .MuiTableSortLabel-icon': { color: 'text.secondary !important' },
                    }}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGateways.map((gateway) => (
              <TableRow
                key={gateway.id}
                hover
                sx={{
                  cursor: 'pointer',
                  '&:last-child td': { borderBottom: 0 },
                  '& .MuiTableCell-root': { borderBottomColor: 'rgba(255,255,255,0.06)' },
                }}
                onClick={() => onNavigateToGateway(gateway.uniqueId)}
              >
                <TableCell>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Tooltip title={getActivityLabel(gateway.lastContact, currentTime)}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '999px',
                          flexShrink: 0,
                          backgroundColor: (() => {
                            const progress = getActivityProgress(gateway.lastContact, currentTime);
                            if (progress <= 0) {
                              return 'rgba(148, 163, 184, 0.55)';
                            }

                            const green = Math.round(120 + progress * 90);
                            const red = Math.round(148 - progress * 88);
                            return `rgba(${red}, ${green}, 105, ${0.35 + progress * 0.65})`;
                          })(),
                          boxShadow: (() => {
                            const progress = getActivityProgress(gateway.lastContact, currentTime);
                            if (progress <= 0) {
                              return '0 0 0 1px rgba(148, 163, 184, 0.2)';
                            }

                            return `0 0 ${6 + progress * 10}px rgba(34, 197, 94, ${0.2 + progress * 0.5})`;
                          })(),
                          animation: recentlyUpdated[gateway.uniqueId]
                            ? 'gatewayActivityPulse 0.9s ease-in-out 2'
                            : 'none',
                          '@keyframes gatewayActivityPulse': {
                            '0%': { transform: 'scale(1)', opacity: 0.75 },
                            '45%': { transform: 'scale(1.8)', opacity: 1 },
                            '100%': { transform: 'scale(1)', opacity: 0.8 },
                          },
                        }}
                      />
                    </Tooltip>
                    <Typography sx={{ fontFamily: 'monospace' }}>{gateway.uniqueId}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{gateway.name ?? '-'}</TableCell>
                <TableCell>{gateway.locationName ?? '-'}</TableCell>
                <TableCell>{formatDateTime(gateway.lastContact)}</TableCell>
              </TableRow>
            ))}
            {filteredGateways.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  {gateways.length === 0 ? 'No gateways registered yet.' : 'No gateways match the search.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default GatewayListView;
