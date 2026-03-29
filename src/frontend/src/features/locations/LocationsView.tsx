import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import {
  createLocation,
  deleteLocation,
  getLocations,
  LocationDto,
  updateLocation,
} from '../../api/api';

type SortableField = 'name' | 'description' | 'deviceCount';
type SortDirection = 'asc' | 'desc';

interface LocationsViewProps {
  onNavigateToLiveView: (locationId: string, locationName: string) => void;
}

function LocationsView({ onNavigateToLiveView }: LocationsViewProps) {
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationDto | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const loadLocations = () => {
    getLocations()
      .then(setLocations)
      .catch((err) => console.error('Failed to fetch locations:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLocations(); }, []);

  const filteredLocations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return [...locations]
      .filter((l) => {
        if (!term) return true;
        return [l.name, l.description].some((v) => v?.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        if (sortBy === 'deviceCount') {
          return sortDirection === 'asc'
            ? a.deviceCount - b.deviceCount
            : b.deviceCount - a.deviceCount;
        }
        const av = String(a[sortBy] ?? '');
        const bv = String(b[sortBy] ?? '');
        return sortDirection === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [locations, searchTerm, sortBy, sortDirection]);

  const handleSort = (column: SortableField) => {
    if (sortBy === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const openCreateDialog = () => {
    setEditingLocation(null);
    setFormName('');
    setFormDescription('');
    setDialogOpen(true);
  };

  const openEditDialog = (location: LocationDto) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormDescription(location.description);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    if (editingLocation) {
      await updateLocation(editingLocation.id, {
        name: formName.trim(),
        description: formDescription.trim(),
      });
    } else {
      await createLocation(formName.trim(), formDescription.trim() || undefined);
    }

    setDialogOpen(false);
    loadLocations();
  };

  const handleDelete = async (id: string) => {
    await deleteLocation(id);
    loadLocations();
  };

  const columns: Array<{ id: SortableField; label: string }> = [
    { id: 'name', label: 'Name' },
    { id: 'description', label: 'Description' },
    { id: 'deviceCount', label: 'Sensors' },
  ];

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
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ mb: 0.75 }}>
              Locations
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Manage sensor locations. Click "Show data" to view live readings.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              placeholder="Search locations"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ minWidth: { sm: 280 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateDialog}>
              Add location
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
          <Chip label={`${filteredLocations.length} location${filteredLocations.length === 1 ? '' : 's'}`} />
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
                    width: 140,
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLocations.map((location) => (
                <TableRow
                  key={location.id}
                  hover
                  sx={{
                    '&:last-child td': { borderBottom: 0 },
                    '& .MuiTableCell-root': { borderBottomColor: 'rgba(255,255,255,0.06)' },
                  }}
                >
                  <TableCell>{location.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{location.description || '-'}</TableCell>
                  <TableCell>
                    <Chip label={location.deviceCount} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Show live data">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onNavigateToLiveView(location.id, location.name)}
                          disabled={location.deviceCount === 0}
                        >
                          <BarChartRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditDialog(location)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(location.id)}
                          disabled={location.deviceCount > 0}
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredLocations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                    {locations.length === 0 ? 'No locations yet.' : 'No locations match the search.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="Description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!formName.trim()}>
            {editingLocation ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default LocationsView;
