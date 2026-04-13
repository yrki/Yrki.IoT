import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import BimSidePanel, { RoomInfo, StoreyInfo } from './BimSidePanel';
import {
  assignDeviceToRoom,
  createDevice,
  createFloor,
  createRoom,
  deleteFloor,
  deleteRoom,
  FloorDto,
  getBuilding,
  getBuildingDevices,
  getBuildingFloors,
  getDevices,
  BuildingDeviceDto,
  SensorListItemDto,
  updateFloor,
  updateRoom,
} from '../../api/api';

interface BuildingStructureViewProps {
  buildingId: string;
  onBack: () => void;
  onSwitchToBim?: () => void;
}

// Stable numeric IDs for BimSidePanel (which uses number-based IDs)
let nextSyntheticId = 1000;
function makeSyntheticId() { return nextSyntheticId++; }

function BuildingStructureView({ buildingId, onBack, onSwitchToBim }: BuildingStructureViewProps) {
  const [buildingName, setBuildingName] = useState(buildingId);
  const [floors, setFloors] = useState<FloorDto[]>([]);
  const [buildingDevices, setBuildingDevices] = useState<BuildingDeviceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStorey, setActiveStorey] = useState<number | null>(null);
  const [selectedRoomApiId, setSelectedRoomApiId] = useState<string | null>(null);

  // Stable ID maps (floor.id -> number, room.id -> number)
  const [floorIdMap] = useState<Map<string, number>>(() => new Map());
  const [roomIdMap] = useState<Map<string, number>>(() => new Map());

  const getFloorNumericId = (floorId: string) => {
    if (!floorIdMap.has(floorId)) floorIdMap.set(floorId, makeSyntheticId());
    return floorIdMap.get(floorId)!;
  };
  const getRoomNumericId = (roomId: string) => {
    if (!roomIdMap.has(roomId)) roomIdMap.set(roomId, makeSyntheticId());
    return roomIdMap.get(roomId)!;
  };

  const loadData = useCallback(async () => {
    try {
      const [building, floorData, devData] = await Promise.all([
        getBuilding(buildingId),
        getBuildingFloors(buildingId),
        getBuildingDevices(buildingId),
      ]);
      setBuildingName(building.name);
      setFloors(floorData);
      setBuildingDevices(devData);
    } catch {
      // empty state handles errors
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Map to BimSidePanel format
  const storeys: StoreyInfo[] = floors.map((f) => ({
    id: getFloorNumericId(f.id),
    name: f.name,
    apiId: f.id,
  }));

  const panelRooms: RoomInfo[] = floors.flatMap((f) =>
    f.rooms.map((r) => ({
      expressId: getRoomNumericId(r.id),
      name: r.number ? `${r.number} — ${r.name}` : r.name,
      storeyId: getFloorNumericId(f.id),
      apiId: r.id,
    })),
  );

  const placedDevices = buildingDevices.map((d) => ({
    deviceId: d.id,
    uniqueId: d.uniqueId,
    name: d.name,
    type: d.type,
    lastContact: d.lastContact,
    roomExpressId: d.roomId ? getRoomNumericId(d.roomId) : undefined,
  }));

  // Device assignment
  const [allDevices, setAllDevices] = useState<SensorListItemDto[]>([]);
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [deviceDialogRoomApiId, setDeviceDialogRoomApiId] = useState<string | null>(null);
  const [deviceDialogRoomName, setDeviceDialogRoomName] = useState('');
  const [deviceDialogMode, setDeviceDialogMode] = useState<'existing' | 'new'>('existing');
  const [searchDevice, setSearchDevice] = useState<SensorListItemDto | null>(null);
  const [newUniqueId, setNewUniqueId] = useState('');
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newName, setNewName] = useState('');
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [deviceDialogError, setDeviceDialogError] = useState<string | null>(null);

  useEffect(() => {
    getDevices().then(setAllDevices).catch(() => {});
  }, []);

  const deviceOptions = useMemo(() =>
    allDevices.filter((d) => d.kind !== 'Gateway'),
    [allDevices],
  );

  const openAddDeviceDialog = (room: RoomInfo) => {
    setDeviceDialogRoomApiId(room.apiId ?? null);
    setDeviceDialogRoomName(room.name);
    setDeviceDialogMode('existing');
    setSearchDevice(null);
    setNewUniqueId('');
    setNewManufacturer('');
    setNewName('');
    setDeviceDialogError(null);
    setDeviceDialogOpen(true);
  };

  const handleAddDeviceToRoom = async () => {
    if (!deviceDialogRoomApiId) return;
    setDeviceSaving(true);
    setDeviceDialogError(null);

    try {
      let device: SensorListItemDto;

      if (deviceDialogMode === 'existing') {
        if (!searchDevice) return;
        device = searchDevice;
      } else {
        if (!newUniqueId.trim() || !newManufacturer.trim()) return;
        try {
          device = await createDevice(
            newUniqueId.trim(),
            newManufacturer.trim(),
            newName.trim() || undefined,
          );
          setAllDevices((prev) => [...prev, device]);
        } catch {
          setDeviceDialogError('A device with this unique ID already exists. Use "Find existing" instead.');
          setDeviceSaving(false);
          return;
        }
      }

      await assignDeviceToRoom(buildingId, device.id, deviceDialogRoomApiId);
      setDeviceDialogOpen(false);
      await loadData();
    } catch {
      setDeviceDialogError('Failed to assign device to room.');
    } finally {
      setDeviceSaving(false);
    }
  };

  // Structure editing callbacks
  const handleAddFloor = async (name: string) => {
    await createFloor(buildingId, name);
    await loadData();
  };

  const handleEditFloor = async (storey: StoreyInfo, name: string) => {
    if (!storey.apiId) return;
    const floor = floors.find((f) => f.id === storey.apiId);
    await updateFloor(buildingId, storey.apiId, name, floor?.elevation ?? 0);
    await loadData();
  };

  const handleDeleteFloor = async (storey: StoreyInfo) => {
    if (!storey.apiId) return;
    await deleteFloor(buildingId, storey.apiId);
    await loadData();
  };

  const handleAddRoom = async (storey: StoreyInfo, name: string, number?: string) => {
    if (!storey.apiId) return;
    await createRoom(buildingId, storey.apiId, name, number);
    await loadData();
  };

  const handleEditRoom = async (room: RoomInfo, name: string, number?: string) => {
    if (!room.apiId) return;
    const floorId = floors.find((f) => f.rooms.some((r) => r.id === room.apiId))?.id;
    if (!floorId) return;
    await updateRoom(buildingId, floorId, room.apiId, name, number ?? null);
    await loadData();
  };

  const handleDeleteRoom = async (room: RoomInfo) => {
    if (!room.apiId) return;
    const floorId = floors.find((f) => f.rooms.some((r) => r.id === room.apiId))?.id;
    if (!floorId) return;
    await deleteRoom(buildingId, floorId, room.apiId);
    if (selectedRoomApiId === room.apiId) setSelectedRoomApiId(null);
    await loadData();
  };

  // Color palette for floors
  const floorColors = [
    'rgba(59,130,246,0.10)', // blue
    'rgba(139,92,246,0.10)', // purple
    'rgba(16,185,129,0.10)', // green
    'rgba(245,158,11,0.10)', // amber
    'rgba(239,68,68,0.10)',  // red
    'rgba(14,165,233,0.10)', // sky
  ];
  const floorBorderColors = [
    'rgba(59,130,246,0.35)',
    'rgba(139,92,246,0.35)',
    'rgba(16,185,129,0.35)',
    'rgba(245,158,11,0.35)',
    'rgba(239,68,68,0.35)',
    'rgba(14,165,233,0.35)',
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  // Determine which floor to highlight based on activeStorey
  const activeFloorApiId = activeStorey != null
    ? floors.find((f) => getFloorNumericId(f.id) === activeStorey)?.id
    : null;

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <IconButton size="small" onClick={onBack}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{buildingName}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {onSwitchToBim && (
          <Button size="small" variant="outlined" startIcon={<ViewInArRoundedIcon />} onClick={onSwitchToBim}>
            3D Model
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Left: Visual floor plan */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            p: 3,
            display: 'flex',
            flexDirection: 'column-reverse', // bottom floor first (like a building)
            gap: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {floors.length === 0 ? (
            <Typography color="text.secondary">
              Add floors and rooms using the panel on the right.
            </Typography>
          ) : (
            floors.map((floor, floorIdx) => {
              const isActiveFloor = activeFloorApiId === null || activeFloorApiId === floor.id;
              const colorIdx = floorIdx % floorColors.length;

              return (
                <Box
                  key={floor.id}
                  sx={{
                    width: '100%',
                    maxWidth: 700,
                    opacity: isActiveFloor ? 1 : 0.3,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {/* Floor label */}
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'text.secondary',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      letterSpacing: 0.5,
                      mb: 0.5,
                      mt: floorIdx > 0 ? 0 : 0,
                    }}
                  >
                    {floor.name}
                  </Typography>

                  {/* Floor box */}
                  <Box
                    sx={{
                      border: '2px solid',
                      borderColor: floorBorderColors[colorIdx],
                      borderRadius: '6px',
                      bgcolor: floorColors[colorIdx],
                      p: 1.5,
                      mb: 0.5,
                      minHeight: 60,
                    }}
                  >
                    {floor.rooms.length === 0 ? (
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled', fontStyle: 'italic', display: 'block', textAlign: 'center', py: 1 }}
                      >
                        No rooms
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {floor.rooms.map((room) => {
                          const isSelected = selectedRoomApiId === room.id;
                          const deviceCount = buildingDevices.filter((d) => d.roomId === room.id).length;

                          return (
                            <Box
                              key={room.id}
                              onClick={() => setSelectedRoomApiId(isSelected ? null : room.id)}
                              sx={{
                                flex: '1 1 auto',
                                minWidth: 100,
                                maxWidth: 200,
                                px: 1.5,
                                py: 1,
                                borderRadius: '4px',
                                border: '1.5px solid',
                                borderColor: isSelected
                                  ? 'primary.main'
                                  : 'rgba(255,255,255,0.12)',
                                bgcolor: isSelected
                                  ? 'rgba(59,130,246,0.18)'
                                  : 'rgba(255,255,255,0.04)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                '&:hover': {
                                  borderColor: isSelected ? 'primary.light' : 'rgba(255,255,255,0.25)',
                                  bgcolor: isSelected ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.07)',
                                },
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '0.78rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {room.name}
                              </Typography>
                              {room.number && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block' }}>
                                  {room.number}
                                </Typography>
                              )}
                              {deviceCount > 0 && (
                                <Typography variant="caption" sx={{ color: 'success.light', fontSize: '0.65rem' }}>
                                  {deviceCount} device{deviceCount === 1 ? '' : 's'}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {/* Right: Side panel */}
        <BimSidePanel
          storeys={storeys}
          rooms={panelRooms}
          placedDevices={placedDevices}
          activeStorey={activeStorey}
          onSelectStorey={setActiveStorey}
          onSelectRoom={(room) => {
            setSelectedRoomApiId(room.apiId ?? null);
          }}
          onLocateDevice={() => {}}
          onRemoveDevice={() => {}}
          onAddDeviceToRoom={openAddDeviceDialog}
          onShowSensorData={(uniqueId) => {
            window.open(`/sensors/${encodeURIComponent(uniqueId)}`, '_blank');
          }}
          onAddFloor={handleAddFloor}
          onEditFloor={handleEditFloor}
          onDeleteFloor={handleDeleteFloor}
          onAddRoom={handleAddRoom}
          onEditRoom={handleEditRoom}
          onDeleteRoom={handleDeleteRoom}
        />
      </Box>

      {/* Add device to room dialog */}
      <Dialog open={deviceDialogOpen} onClose={() => setDeviceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add sensor to {deviceDialogRoomName}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <ButtonGroup size="small" fullWidth>
            <Button
              variant={deviceDialogMode === 'existing' ? 'contained' : 'outlined'}
              onClick={() => { setDeviceDialogMode('existing'); setDeviceDialogError(null); }}
            >
              Find existing
            </Button>
            <Button
              variant={deviceDialogMode === 'new' ? 'contained' : 'outlined'}
              onClick={() => { setDeviceDialogMode('new'); setDeviceDialogError(null); }}
            >
              Create new
            </Button>
          </ButtonGroup>

          {deviceDialogMode === 'existing' ? (
            <Autocomplete
              options={deviceOptions}
              value={searchDevice}
              onChange={(_, v) => setSearchDevice(v)}
              getOptionLabel={(opt) => `${opt.uniqueId}${opt.name ? ` — ${opt.name}` : ''}`}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              renderInput={(params) => (
                <TextField {...params} label="Search device" placeholder="Type to search..." autoFocus />
              )}
              renderOption={(props, opt) => (
                <li {...props} key={opt.id}>
                  <Stack>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{opt.uniqueId}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[opt.name, opt.manufacturer, opt.type].filter(Boolean).join(' · ')}
                    </Typography>
                  </Stack>
                </li>
              )}
            />
          ) : (
            <>
              <TextField
                label="Unique ID"
                value={newUniqueId}
                onChange={(e) => setNewUniqueId(e.target.value)}
                required
                autoFocus
                placeholder="e.g. 00148032"
              />
              <TextField
                label="Manufacturer"
                value={newManufacturer}
                onChange={(e) => setNewManufacturer(e.target.value)}
                required
                placeholder="e.g. ABB"
              />
              <TextField
                label="Name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Office water meter"
              />
            </>
          )}

          {deviceDialogError && (
            <Typography variant="body2" color="error">{deviceDialogError}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeviceDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddDeviceToRoom}
            disabled={
              deviceSaving ||
              !deviceDialogRoomApiId ||
              (deviceDialogMode === 'existing' && !searchDevice) ||
              (deviceDialogMode === 'new' && (!newUniqueId.trim() || !newManufacturer.trim()))
            }
          >
            {deviceSaving ? 'Adding...' : 'Add to room'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default BuildingStructureView;
