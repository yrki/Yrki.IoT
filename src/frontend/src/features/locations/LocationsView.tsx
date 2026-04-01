import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import {
  createLocation,
  deleteLocation,
  getDevices,
  getDevicesByLocation,
  getLocations,
  LocationDto,
  SensorListItemDto,
  updateLocation,
} from '../../api/api';

import { LocationNode, buildTree, buildLocationOptions, accumulatedDeviceCount } from './locationTree';


function filterTree(nodes: LocationNode[], term: string): LocationNode[] {
  if (!term) return nodes;
  return nodes.reduce<LocationNode[]>((acc, node) => {
    const matches = [node.location.name, node.location.description]
      .some((v) => v?.toLowerCase().includes(term));
    const filteredChildren = filterTree(node.children, term);
    if (matches || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}

function countNodes(nodes: LocationNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

function sortSensorsByName(sensors: SensorListItemDto[]): SensorListItemDto[] {
  return [...sensors].sort((left, right) => {
    const leftName = left.name?.trim() || left.uniqueId;
    const rightName = right.name?.trim() || right.uniqueId;
    return leftName.localeCompare(rightName, 'nb-NO', { sensitivity: 'base' });
  });
}

interface LocationsViewProps {
  onNavigateToLiveView: (locationId: string, locationName: string) => void;
  onNavigateToSensor: (sensorId: string) => void;
}

function LocationsView({ onNavigateToLiveView, onNavigateToSensor }: LocationsViewProps) {
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [locationSensors, setLocationSensors] = useState<Record<string, SensorListItemDto[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sensorExpandedIds, setSensorExpandedIds] = useState<Set<string>>(new Set());
  const [loadingLocationId, setLoadingLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationDto | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');

  const loadLocations = () => {
    getLocations()
      .then(setLocations)
      .catch((err) => console.error('Failed to fetch locations:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLocations(); }, []);

  const tree = useMemo(() => buildTree(locations), [locations]);
  const term = searchTerm.trim().toLowerCase();
  const filteredTree = useMemo(() => filterTree(tree, term), [tree, term]);
  const visibleCount = useMemo(() => countNodes(filteredTree), [filteredTree]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSensors = useCallback(async (locationId: string) => {
    setSensorExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
        return next;
      }
      next.add(locationId);
      return next;
    });

    if (locationSensors[locationId]) return;

    setLoadingLocationId(locationId);
    try {
      let sensors = await getDevicesByLocation(locationId);
      if (sensors.length === 0) {
        const location = locations.find((item) => item.id === locationId);
        if (location && location.deviceCount > 0) {
          const allDevices = await getDevices();
          sensors = allDevices.filter((device) => device.locationId === locationId);
        }
      }
      setLocationSensors((current) => ({ ...current, [locationId]: sortSensorsByName(sensors) }));
    } catch (err) {
      console.error('Failed to fetch sensors for location:', err);
      setLocationSensors((current) => ({ ...current, [locationId]: [] }));
    } finally {
      setLoadingLocationId((current) => current === locationId ? null : current);
    }
  }, [locationSensors, locations]);

  const openCreateDialog = (parentId?: string) => {
    setEditingLocation(null);
    setFormName('');
    setFormDescription('');
    setFormParentId(parentId ?? '');
    setDialogOpen(true);
  };

  const openEditDialog = (location: LocationDto) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormDescription(location.description);
    setFormParentId(location.parentLocationId ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const parentId = formParentId || undefined;

    if (editingLocation) {
      await updateLocation(editingLocation.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        parentLocationId: formParentId || null,
      });
    } else {
      await createLocation(formName.trim(), formDescription.trim() || undefined, parentId);
    }

    setDialogOpen(false);
    loadLocations();
  };

  const handleDelete = async (id: string) => {
    await deleteLocation(id);
    loadLocations();
  };

  const canExpand = (node: LocationNode) =>
    node.children.length > 0 || node.location.deviceCount > 0;

  const renderLocationRows = (nodes: LocationNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const { location } = node;
      const isExpanded = expandedIds.has(location.id);
      const sensorsOpen = sensorExpandedIds.has(location.id);
      const totalDevices = accumulatedDeviceCount(node);
      const sensorContentPaddingLeft = 7 + depth * 3;

      return (
        <Fragment key={location.id}>
          <TableRow
            hover
            sx={{
              '& .MuiTableCell-root': { borderBottomColor: 'rgba(255,255,255,0.06)' },
            }}
          >
            <TableCell>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: depth * 3 }}>
                <IconButton
                  size="small"
                  onClick={() => {
                    toggleExpanded(location.id);
                    if (location.deviceCount > 0) {
                      toggleSensors(location.id);
                    }
                  }}
                  disabled={!canExpand(node)}
                  aria-label={isExpanded ? `Collapse ${location.name}` : `Expand ${location.name}`}
                >
                  {isExpanded
                    ? <KeyboardArrowUpRoundedIcon fontSize="small" />
                    : <KeyboardArrowDownRoundedIcon fontSize="small" />}
                </IconButton>
                <Typography>{location.name}</Typography>
              </Stack>
            </TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>{location.description || '-'}</TableCell>
            <TableCell>
              <Chip label={totalDevices} size="small" variant="outlined" />
            </TableCell>
            <TableCell>
              <Stack direction="row" spacing={0.5}>
                {location.deviceCount > 0 && node.children.length > 0 && (
                  <Tooltip title={sensorsOpen ? 'Hide sensors' : 'Show sensors'}>
                    <IconButton
                      size="small"
                      color={sensorsOpen ? 'primary' : 'default'}
                      onClick={() => toggleSensors(location.id)}
                    >
                      <BarChartRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {(node.children.length === 0 || location.deviceCount === 0) && (
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
                )}
                <Tooltip title="Add sub-location">
                  <IconButton size="small" onClick={() => openCreateDialog(location.id)}>
                    <AddRoundedIcon fontSize="small" />
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
                    disabled={totalDevices > 0 || node.children.length > 0}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </TableCell>
          </TableRow>

          {/* Sensor details row */}
          {(sensorsOpen || (isExpanded && node.children.length === 0 && location.deviceCount > 0)) && (
            <TableRow>
              <TableCell
                colSpan={4}
                sx={{
                  p: 0,
                  borderBottomColor: 'rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <Collapse in timeout="auto">
                  <Box sx={{ p: 2.5, pl: sensorContentPaddingLeft }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                      {`Sensors at ${location.name}`}
                    </Typography>
                    {loadingLocationId === location.id ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Loading sensors...
                      </Typography>
                    ) : (locationSensors[location.id] ?? []).length > 0 ? (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {['Unique ID', 'Name', 'Type', 'Last Received'].map((header) => (
                              <TableCell
                                key={header}
                                sx={{
                                  backgroundColor: 'rgba(255,255,255,0.03)',
                                  borderBottomColor: 'rgba(255,255,255,0.08)',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                }}
                              >
                                {header}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {locationSensors[location.id].map((sensor) => (
                            <TableRow
                              key={sensor.id}
                              hover
                              onClick={() => onNavigateToSensor(sensor.uniqueId)}
                              sx={{
                                cursor: 'pointer',
                                '& .MuiTableCell-root': {
                                  borderBottomColor: 'rgba(255,255,255,0.04)',
                                  fontSize: '0.85rem',
                                  py: 1,
                                },
                              }}
                            >
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem !important' }}>
                                {sensor.uniqueId}
                              </TableCell>
                              <TableCell>{sensor.name ?? '-'}</TableCell>
                              <TableCell>{sensor.type}</TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>
                                {sensor.lastContact
                                  ? new Date(sensor.lastContact).toLocaleString()
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No sensors found for this location.
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              </TableCell>
            </TableRow>
          )}

          {/* Recursively render children when expanded */}
          {isExpanded && node.children.length > 0 && renderLocationRows(node.children, depth + 1)}
        </Fragment>
      );
    });

  const parentOptions = buildLocationOptions(
    locations.filter((l) => l.id !== editingLocation?.id),
  );

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
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreateDialog()}>
              Add location
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
          <Chip label={`${visibleCount} location${visibleCount === 1 ? '' : 's'}`} />
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
                {['Name', 'Description', 'Sensors'].map((label) => (
                  <TableCell
                    key={label}
                    sx={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      borderBottomColor: 'rgba(255,255,255,0.06)',
                      color: 'text.primary',
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </TableCell>
                ))}
                <TableCell
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                    width: 180,
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {renderLocationRows(filteredTree, 0)}
              {!loading && filteredTree.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
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
          <TextField
            label="Parent location"
            select
            value={formParentId}
            onChange={(e) => setFormParentId(e.target.value)}
          >
            <MenuItem value="">None (top-level)</MenuItem>
            {parentOptions.map(({ location, depth }) => (
              <MenuItem key={location.id} value={location.id} sx={{ pl: 2 + depth * 2 }}>
                {location.name}
              </MenuItem>
            ))}
          </TextField>
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
