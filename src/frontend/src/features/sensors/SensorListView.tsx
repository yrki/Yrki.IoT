import { useEffect, useMemo, useState } from 'react';
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

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
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

  const loadSensors = () => {
    getDevices()
      .then(setSensors)
      .catch((err) => console.error('Failed to fetch sensors:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSensors(); }, []);

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
                <TableCell sx={{ fontFamily: 'monospace' }}>{sensor.uniqueId}</TableCell>
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
