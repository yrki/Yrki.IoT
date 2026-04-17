import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
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
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from 'recharts';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  GatewayActivityBucketDto,
  GatewayPositionDto,
  GatewaySensorDto,
  LocationDto,
  SensorListItemDto,
  getGatewayActivity,
  getGatewayDriveByPositions,
  getGatewayLatestPosition,
  getGatewaySensors,
  getGateways,
  getLocations,
  updateExistingDevice,
} from '../../api/api';
import { buildLocationOptions } from '../locations/locationTree';
import { handleCoordinatePaste } from '../map/coordinatePaste';

interface GatewayViewProps {
  gatewayId: string;
  onBack: () => void;
  onNavigateToSensor: (sensorId: string) => void;
}

type SortableField = 'sensorId' | 'readingCount' | 'averageRssi' | 'lastSeenAt';
type SortDirection = 'asc' | 'desc';

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
}

function formatAverageRssi(value: number) {
  return value.toFixed(1);
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

interface EditGatewayDialogProps {
  gateway: SensorListItemDto | null;
  locations: LocationDto[];
  open: boolean;
  onClose: () => void;
  onSaved: (gateway: SensorListItemDto) => void;
}

function EditGatewayDialog({ gateway, locations, open, onClose, onSaved }: EditGatewayDialogProps) {
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const locationOptions = buildLocationOptions(locations);

  useEffect(() => {
    setName(gateway?.name ?? '');
    setLocationId(gateway?.locationId ?? '');
    setLatitude(gateway?.latitude != null ? String(gateway.latitude) : '');
    setLongitude(gateway?.longitude != null ? String(gateway.longitude) : '');
  }, [gateway]);

  const handleSave = async () => {
    if (!gateway) {
      return;
    }

    setSaving(true);
    try {
      await updateExistingDevice(gateway.id, {
        name: name.trim() || undefined,
        locationId: locationId || undefined,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
      });

      const selectedLocation = locations.find((location) => location.id === locationId);
      onSaved({
        ...gateway,
        name: name.trim() || null,
        locationId: locationId || null,
        locationName: selectedLocation?.name ?? null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Gateway</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <Stack spacing={2}>
          <TextField label="Gateway ID" value={gateway?.uniqueId ?? ''} disabled size="small" fullWidth />
          <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} size="small" fullWidth />
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
          <FormControl fullWidth size="small">
            <InputLabel>Location</InputLabel>
            <Select value={locationId} label="Location" onChange={(event) => setLocationId(event.target.value)}>
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const activityTimeRanges = [
  { label: '3h', hours: 3 },
  { label: '24h', hours: 24 },
  { label: '1w', hours: 24 * 7 },
  { label: '1m', hours: 24 * 30 },
] as const;

type DriveByRange = '3h' | '12h' | '24h' | '3d' | '7d';

const driveByRangeHours: Record<DriveByRange, number> = {
  '3h': 3,
  '12h': 12,
  '24h': 24,
  '3d': 72,
  '7d': 168,
};

interface ActivityDataPoint {
  time: number;
  count: number;
}

function formatActivityTime(ms: number, showDate: boolean) {
  const d = new Date(ms);
  if (showDate) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function ActivityTimeline({ data, hours }: { data: ActivityDataPoint[]; hours: number }) {
  const showDate = hours > 24;

  const now = Date.now();
  const since = now - hours * 60 * 60 * 1000;

  const allBuckets: ActivityDataPoint[] = [];
  const bucketStart = new Date(since);
  bucketStart.setMinutes(0, 0, 0);

  for (let t = bucketStart.getTime(); t <= now; t += 60 * 60 * 1000) {
    const matchingPoint = data.find((d) => d.time === t);
    allBuckets.push({ time: t, count: matchingPoint ? matchingPoint.count : 0 });
  }

  const maxCount = Math.max(1, ...allBuckets.map((b) => b.count));

  if (allBuckets.every((b) => b.count === 0)) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: 80 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No activity in this time range.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 80 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={allBuckets} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="time"
            type="number"
            domain={[since, now]}
            tickFormatter={(v) => formatActivityTime(v, showDate)}
            tick={{ fill: '#a0a8b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={60}
          />
          <YAxis hide domain={[0, maxCount]} />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: '#20242c',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelFormatter={(v) => new Date(v as number).toLocaleString([], { hour12: false })}
            formatter={(v: number) => [`${v} contact${v === 1 ? '' : 's'}`, 'Activity']}
          />
          <Bar dataKey="count" isAnimationActive={false} maxBarSize={8} radius={[2, 2, 0, 0]}>
            {allBuckets.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.count > 0 ? 'rgba(34, 197, 94, 0.85)' : 'rgba(148, 163, 184, 0.15)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

function GatewayView({ gatewayId, onBack, onNavigateToSensor }: GatewayViewProps) {
  const [sensors, setSensors] = useState<GatewaySensorDto[]>([]);
  const [gateway, setGateway] = useState<SensorListItemDto | null>(null);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('lastSeenAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [latestPosition, setLatestPosition] = useState<GatewayPositionDto | null>(null);
  const [driveByPositions, setDriveByPositions] = useState<GatewayPositionDto[]>([]);
  const [driveByRange, setDriveByRange] = useState<DriveByRange>('24h');
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  const [activityHours, setActivityHours] = useState(24);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!gatewayId) {
      setSensors([]);
      return;
    }

    getGatewaySensors(gatewayId)
      .then(setSensors)
      .catch((err) => {
        console.error('Failed to fetch gateway sensors:', err);
        setSensors([]);
      });
  }, [gatewayId]);

  useEffect(() => {
    getGateways()
      .then((gateways) => setGateway(gateways.find((item) => item.uniqueId === gatewayId) ?? null))
      .catch((err) => {
        console.error('Failed to fetch gateway details:', err);
        setGateway(null);
      });

    getLocations()
      .then((result) => setLocations(result.sort((left, right) => left.name.localeCompare(right.name))))
      .catch((err) => console.error('Failed to fetch locations:', err));
  }, [gatewayId]);

  useEffect(() => {
    if (!gatewayId) return;

    getGatewayLatestPosition(gatewayId)
      .then(setLatestPosition)
      .catch((err) => console.error('Failed to fetch latest gateway position:', err));
  }, [gatewayId]);

  useEffect(() => {
    if (!gatewayId) return;

    getGatewayDriveByPositions(gatewayId, driveByRangeHours[driveByRange])
      .then(setDriveByPositions)
      .catch((err) => console.error('Failed to fetch drive-by positions:', err));
  }, [gatewayId, driveByRange]);

  useEffect(() => {
    if (!gatewayId) return;

    getGatewayActivity(gatewayId, activityHours)
      .then((buckets) => {
        setActivityData(
          buckets.map((b) => ({
            time: new Date(b.hour).getTime(),
            count: b.contactCount,
          })),
        );
      })
      .catch((err) => console.error('Failed to fetch gateway activity:', err));
  }, [gatewayId, activityHours]);

  const driveByWithCoords = useMemo(
    () => driveByPositions.filter((p) => p.latitude != null && p.longitude != null),
    [driveByPositions],
  );

  useEffect(() => {
    if (!mapContainerRef.current || driveByWithCoords.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const p of driveByWithCoords) {
      bounds.extend([p.longitude!, p.latitude!]);
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      bounds,
      fitBoundsOptions: { padding: 50, maxZoom: 16 },
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      const coordinates = driveByWithCoords.map((p) => [p.longitude!, p.latitude!]);

      map.addSource('driveby-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      });

      map.addLayer({
        id: 'driveby-route-line',
        type: 'line',
        source: 'driveby-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.8,
        },
      });

      const pointFeatures = driveByWithCoords.map((p) => ({
        type: 'Feature' as const,
        properties: {
          timestamp: formatDateTime(p.timestamp),
          heading: p.heading != null ? `${p.heading.toFixed(0)}°` : '-',
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.longitude!, p.latitude!],
        },
      }));

      map.addSource('driveby-points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pointFeatures,
        },
      });

      map.addLayer({
        id: 'driveby-points-circle',
        type: 'circle',
        source: 'driveby-points',
        paint: {
          'circle-radius': 5,
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

      map.on('mouseenter', 'driveby-points-circle', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') return;

        const coords = feature.geometry.coordinates.slice() as [number, number];
        const props = feature.properties;

        popup
          .setLngLat(coords)
          .setHTML(`<strong>${props.timestamp}</strong><br/>Heading: ${props.heading}`)
          .addTo(map);
      });

      map.on('mouseleave', 'driveby-points-circle', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [driveByWithCoords]);

  const filteredSensors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const normalizedTerm = normalizeSearchValue(searchTerm.trim());

    return [...sensors]
      .filter((sensor) => {
        if (!term) {
          return true;
        }

        return [sensor.sensorId]
          .filter(Boolean)
          .some((value) => {
            const rawValue = String(value).toLowerCase();
            return rawValue.includes(term) || normalizeSearchValue(String(value)).includes(normalizedTerm);
          });
      })
      .sort((left, right) => {
        switch (sortBy) {
          case 'readingCount':
            return sortDirection === 'asc'
              ? left.readingCount - right.readingCount
              : right.readingCount - left.readingCount;
          case 'averageRssi':
            return sortDirection === 'asc'
              ? left.averageRssi - right.averageRssi
              : right.averageRssi - left.averageRssi;
          case 'lastSeenAt': {
            const leftValue = new Date(left.lastSeenAt).getTime();
            const rightValue = new Date(right.lastSeenAt).getTime();
            return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
          }
          case 'sensorId':
          default:
            return sortDirection === 'asc'
              ? left.sensorId.localeCompare(right.sensorId)
              : right.sensorId.localeCompare(left.sensorId);
        }
      });
  }, [searchTerm, sensors, sortBy, sortDirection]);

  const handleSort = (column: SortableField) => {
    if (sortBy === column) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortBy(column);
    setSortDirection(column === 'sensorId' ? 'asc' : 'desc');
  };

  const columns: Array<{ id: SortableField; label: string }> = [
    { id: 'sensorId', label: 'Sensor ID' },
    { id: 'readingCount', label: 'Readings' },
    { id: 'averageRssi', label: 'Avg RSSI' },
    { id: 'lastSeenAt', label: 'Last Seen' },
  ];

  return (
    <Stack spacing={3}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: '6px',
          backgroundColor: 'rgba(36, 42, 51, 0.82)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
          <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>
            Back
          </Button>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ mb: 0.75 }}>
              {gateway?.name?.trim() || gatewayId}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {gateway?.locationName
                ? `Gateway ${gatewayId} at ${gateway.locationName}. Sensors seen by this gateway, with average RSSI and last contact time.`
                : `Gateway ${gatewayId}. Sensors seen by this gateway, with average RSSI and last contact time.`}
            </Typography>
          </Box>
          <Button startIcon={<EditRoundedIcon />} onClick={() => setEditOpen(true)} disabled={!gateway}>
            Edit gateway
          </Button>
          <TextField
            placeholder="Search sensors"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            sx={{ minWidth: { sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        {latestPosition && latestPosition.latitude != null && latestPosition.longitude != null && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 2.5,
              backgroundColor: 'rgba(23, 26, 32, 0.44)',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Last known position
            </Typography>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Typography variant="body2">
                Lat: <strong>{latestPosition.latitude.toFixed(6)}</strong>
              </Typography>
              <Typography variant="body2">
                Lon: <strong>{latestPosition.longitude.toFixed(6)}</strong>
              </Typography>
              {latestPosition.heading != null && (
                <Typography variant="body2">
                  Heading: <strong>{latestPosition.heading.toFixed(0)}°</strong>
                </Typography>
              )}
              <Typography variant="body2">
                At: <strong>{formatDateTime(latestPosition.timestamp)}</strong>
              </Typography>
            </Stack>
          </Paper>
        )}

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2.5,
            backgroundColor: 'rgba(23, 26, 32, 0.44)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              Activity timeline
            </Typography>
            <ButtonGroup size="small" variant="outlined">
              {activityTimeRanges.map((range) => (
                <Button
                  key={range.label}
                  onClick={() => setActivityHours(range.hours)}
                  variant={activityHours === range.hours ? 'contained' : 'outlined'}
                >
                  {range.label}
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
          <ActivityTimeline data={activityData} hours={activityHours} />
        </Paper>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
          <Chip label={`${filteredSensors.length} sensor${filteredSensors.length === 1 ? '' : 's'}`} />
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
              {filteredSensors.map((sensor) => (
                <TableRow
                  key={sensor.sensorId}
                  hover
                  sx={{
                    cursor: 'pointer',
                    '&:last-child td': { borderBottom: 0 },
                    '& .MuiTableCell-root': { borderBottomColor: 'rgba(255,255,255,0.06)' },
                  }}
                  onClick={() => onNavigateToSensor(sensor.sensorId)}
                >
                  <TableCell sx={{ fontFamily: 'monospace' }}>{sensor.sensorId}</TableCell>
                  <TableCell>{sensor.readingCount}</TableCell>
                  <TableCell>{formatAverageRssi(sensor.averageRssi)}</TableCell>
                  <TableCell>{new Date(sensor.lastSeenAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredSensors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                    {sensors.length === 0
                      ? 'No sensor contacts recorded for this gateway yet.'
                      : 'No sensors match the search.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <EditGatewayDialog
          gateway={gateway}
          locations={locations}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={setGateway}
        />
      </Paper>

      {driveByPositions.length > 0 && (
        <Paper
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: '6px',
            backgroundColor: 'rgba(36, 42, 51, 0.82)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ mb: 0.5 }}>
                Drive-by route
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {driveByWithCoords.length} position{driveByWithCoords.length === 1 ? '' : 's'} with coordinates
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={driveByRange}
              exclusive
              onChange={(_e, value) => { if (value) setDriveByRange(value); }}
              size="small"
            >
              {(Object.keys(driveByRangeHours) as DriveByRange[]).map((range) => (
                <ToggleButton key={range} value={range}>
                  {range}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>

          {driveByWithCoords.length > 0 ? (
            <Box
              ref={mapContainerRef}
              sx={{
                width: '100%',
                height: 420,
                borderRadius: '6px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
              No drive-by positions with coordinates in this time range.
            </Typography>
          )}
        </Paper>
      )}
    </Stack>
  );
}

export default GatewayView;
