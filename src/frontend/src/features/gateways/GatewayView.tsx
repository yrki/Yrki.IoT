import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  GatewaySensorDto,
  LocationDto,
  SensorListItemDto,
  getGatewaySensors,
  getGateways,
  getLocations,
  updateExistingDevice,
} from '../../api/api';
import { buildLocationOptions } from '../locations/locationTree';

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

function GatewayView({ gatewayId, onBack, onNavigateToSensor }: GatewayViewProps) {
  const [sensors, setSensors] = useState<GatewaySensorDto[]>([]);
  const [gateway, setGateway] = useState<SensorListItemDto | null>(null);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('lastSeenAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
  );
}

export default GatewayView;
