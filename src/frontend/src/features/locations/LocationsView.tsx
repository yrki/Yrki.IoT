import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import {
  createLocation,
  deleteLocation,
  getLocations,
  LocationDto,
  updateLocation,
} from '../../api/api';

import { LocationNode, buildTree, buildLocationOptions, accumulatedDeviceCount } from './locationTree';
import { handleCoordinatePaste } from '../map/coordinatePaste';


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

interface LocationsViewProps {
  onNavigateToLiveView: (locationId: string, locationName: string) => void;
  onNavigateToSensorList: (locationId: string) => void;
}

function LocationsView({ onNavigateToLiveView, onNavigateToSensorList }: LocationsViewProps) {
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationDto | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formLatitude, setFormLatitude] = useState<string>('');
  const [formLongitude, setFormLongitude] = useState<string>('');
  const [formColor, setFormColor] = useState<string>('');


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

  const openCreateDialog = (parentId?: string) => {
    setEditingLocation(null);
    setFormName('');
    setFormDescription('');
    setFormParentId(parentId ?? '');
    setFormLatitude('');
    setFormLongitude('');
    setFormColor('');
    setDialogOpen(true);
  };

  const openEditDialog = (location: LocationDto) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormDescription(location.description);
    setFormParentId(location.parentLocationId ?? '');
    setFormLatitude(location.latitude != null ? String(location.latitude) : '');
    setFormLongitude(location.longitude != null ? String(location.longitude) : '');
    setFormColor(location.color ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const parentId = formParentId || undefined;
    const latitude = formLatitude.trim() ? Number(formLatitude) : undefined;
    const longitude = formLongitude.trim() ? Number(formLongitude) : undefined;
    const color = formColor.trim() ? formColor.trim() : null;

    if (editingLocation) {
      await updateLocation(editingLocation.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        parentLocationId: formParentId || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        color,
      });
    } else {
      await createLocation(
        formName.trim(),
        formDescription.trim() || undefined,
        parentId,
        latitude,
        longitude,
        undefined,
        color,
      );
    }

    setDialogOpen(false);
    loadLocations();
  };

  const handleDelete = async (id: string) => {
    await deleteLocation(id);
    loadLocations();
  };

  const renderLocationRows = (nodes: LocationNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const { location } = node;
      const isExpanded = expandedIds.has(location.id);
      const totalDevices = accumulatedDeviceCount(node);
      const hasChildren = node.children.length > 0;

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
                  onClick={() => toggleExpanded(location.id)}
                  disabled={!hasChildren}
                  aria-label={isExpanded ? `Collapse ${location.name}` : `Expand ${location.name}`}
                  sx={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                >
                  {isExpanded
                    ? <KeyboardArrowUpRoundedIcon fontSize="small" />
                    : <KeyboardArrowDownRoundedIcon fontSize="small" />}
                </IconButton>
                {location.color && (
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: location.color,
                      border: '1px solid rgba(15, 23, 42, 0.25)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <Typography>{location.name}</Typography>
              </Stack>
            </TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>{location.description || '-'}</TableCell>
            <TableCell>
              <Chip label={totalDevices} size="small" variant="outlined" />
            </TableCell>
            <TableCell>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title={totalDevices > 0 ? 'Show sensors in this location' : 'No sensors at this location'}>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SensorsRoundedIcon fontSize="small" />}
                      onClick={() => onNavigateToSensorList(location.id)}
                      disabled={totalDevices === 0}
                    >
                      Sensors
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Show live data">
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => onNavigateToLiveView(location.id, location.name)}
                      disabled={location.deviceCount === 0}
                    >
                      <BarChartRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
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
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(location.id)}
                      disabled={totalDevices > 0 || hasChildren}
                    >
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </TableCell>
          </TableRow>

          {/* Recursively render children when expanded */}
          {isExpanded && hasChildren && renderLocationRows(node.children, depth + 1)}
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
              Manage device locations. Click "Show data" to view live readings.
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
                {['Name', 'Description', 'Devices'].map((label) => (
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
          <Stack direction="row" spacing={2}>
            <TextField
              label="Latitude"
              value={formLatitude}
              onChange={(e) => setFormLatitude(e.target.value)}
              onPaste={(e) => handleCoordinatePaste(e, setFormLatitude, setFormLongitude)}
              type="number"
              inputProps={{ step: 'any' }}
              fullWidth
            />
            <TextField
              label="Longitude"
              value={formLongitude}
              onChange={(e) => setFormLongitude(e.target.value)}
              onPaste={(e) => handleCoordinatePaste(e, setFormLatitude, setFormLongitude)}
              type="number"
              inputProps={{ step: 'any' }}
              fullWidth
            />
          </Stack>
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
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="Color"
              type="color"
              value={formColor || '#3b82f6'}
              onChange={(e) => setFormColor(e.target.value)}
              sx={{ width: 120, '& input[type=color]': { p: 0.5, height: 36, cursor: 'pointer' } }}
              InputLabelProps={{ shrink: true }}
            />
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '1px solid rgba(148, 163, 184, 0.45)',
                  background: formColor || 'transparent',
                  backgroundImage: formColor
                    ? 'none'
                    : 'repeating-conic-gradient(rgba(148,163,184,0.35) 0% 25%, transparent 0% 50%)',
                  backgroundSize: '10px 10px',
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {formColor ? formColor : 'Auto color from location id'}
              </Typography>
              {formColor && (
                <Button size="small" onClick={() => setFormColor('')}>
                  Clear
                </Button>
              )}
            </Stack>
          </Stack>
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
