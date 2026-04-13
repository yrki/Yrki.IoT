import { Fragment, useState } from 'react';
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
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { getSensorActivityColor } from '../sensors/sensorActivity';

export interface StoreyInfo {
  id: number;
  name: string;
  apiId?: string;
}

export interface RoomInfo {
  expressId: number;
  name: string;
  storeyId: number | null;
  apiId?: string;
}

export interface PlacedDevice {
  deviceId: string;
  uniqueId: string;
  name: string | null;
  type: string;
  lastContact: string;
  roomExpressId?: number;
}

interface BimSidePanelProps {
  storeys: StoreyInfo[];
  rooms: RoomInfo[];
  placedDevices: PlacedDevice[];
  activeStorey: number | null;
  onSelectStorey: (storeyId: number | null) => void;
  onSelectRoom: (room: RoomInfo) => void;
  onLocateDevice: (device: PlacedDevice) => void;
  onRemoveDevice: (device: PlacedDevice) => void;
  onAddDeviceToRoom: (room: RoomInfo) => void;
  onShowSensorData: (uniqueId: string) => void;
  // Structure editing (optional — enabled when provided)
  onAddFloor?: (name: string) => Promise<void>;
  onEditFloor?: (storey: StoreyInfo, name: string) => Promise<void>;
  onDeleteFloor?: (storey: StoreyInfo) => Promise<void>;
  onAddRoom?: (storey: StoreyInfo, name: string, number?: string) => Promise<void>;
  onEditRoom?: (room: RoomInfo, name: string, number?: string) => Promise<void>;
  onDeleteRoom?: (room: RoomInfo) => Promise<void>;
}

type DialogState =
  | { type: 'addFloor'; name: string }
  | { type: 'editFloor'; storey: StoreyInfo; name: string }
  | { type: 'deleteFloor'; storey: StoreyInfo }
  | { type: 'addRoom'; storey: StoreyInfo; name: string; number: string }
  | { type: 'editRoom'; room: RoomInfo; name: string; number: string }
  | { type: 'deleteRoom'; room: RoomInfo };

function BimSidePanel({
  storeys,
  rooms,
  placedDevices,
  activeStorey,
  onSelectStorey,
  onSelectRoom,
  onLocateDevice,
  onRemoveDevice,
  onAddDeviceToRoom,
  onShowSensorData,
  onAddFloor,
  onEditFloor,
  onDeleteFloor,
  onAddRoom,
  onEditRoom,
  onDeleteRoom,
}: BimSidePanelProps) {
  const [expandedStoreys, setExpandedStoreys] = useState<Set<number>>(new Set());
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);

  const canEditStructure = !!(onAddFloor || onEditFloor || onDeleteFloor || onAddRoom || onEditRoom || onDeleteRoom);

  const toggleStorey = (id: number) => {
    setExpandedStoreys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRoom = (id: number) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const devicesInRoom = (_roomExpressId: number) =>
    placedDevices.filter((d) => d.roomExpressId === _roomExpressId);

  const unassignedDevices = placedDevices.filter((d) => !d.roomExpressId);

  const handleSave = async () => {
    if (!dialog) return;
    setSaving(true);
    try {
      switch (dialog.type) {
        case 'addFloor':
          await onAddFloor?.(dialog.name);
          break;
        case 'editFloor':
          await onEditFloor?.(dialog.storey, dialog.name);
          break;
        case 'deleteFloor':
          await onDeleteFloor?.(dialog.storey);
          break;
        case 'addRoom':
          await onAddRoom?.(dialog.storey, dialog.name, dialog.number || undefined);
          break;
        case 'editRoom':
          await onEditRoom?.(dialog.room, dialog.name, dialog.number || undefined);
          break;
        case 'deleteRoom':
          await onDeleteRoom?.(dialog.room);
          break;
      }
      setDialog(null);
    } finally {
      setSaving(false);
    }
  };

  const dialogTitle = dialog
    ? {
        addFloor: 'Add floor',
        editFloor: 'Edit floor',
        deleteFloor: 'Delete floor',
        addRoom: 'Add room',
        editRoom: 'Edit room',
        deleteRoom: 'Delete room',
      }[dialog.type]
    : '';

  const isDeleteDialog = dialog?.type === 'deleteFloor' || dialog?.type === 'deleteRoom';
  const deleteTarget = dialog?.type === 'deleteFloor' ? dialog.storey.name : dialog?.type === 'deleteRoom' ? dialog.room.name : '';

  return (
    <Box
      sx={{
        width: 280,
        minWidth: 280,
        height: '100%',
        overflowY: 'auto',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ fontSize: '0.8rem', color: 'text.secondary', letterSpacing: 1, flex: 1 }}>
          BUILDING STRUCTURE
        </Typography>
        {onAddFloor && (
          <Tooltip title="Add floor">
            <IconButton
              size="small"
              onClick={() => setDialog({ type: 'addFloor', name: '' })}
              sx={{ p: 0.25 }}
            >
              <AddRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <List dense disablePadding sx={{ flex: 1, overflowY: 'auto' }}>
        {storeys.map((storey) => {
          const storeyRooms = rooms.filter((r) => r.storeyId === storey.id);
          const isExpanded = expandedStoreys.has(storey.id);
          const isActive = activeStorey === storey.id;
          const storeyDeviceCount = storeyRooms.reduce(
            (sum, room) => sum + devicesInRoom(room.expressId).length,
            0,
          );

          return (
            <Fragment key={storey.id}>
              <ListItemButton
                onClick={() => {
                  toggleStorey(storey.id);
                  onSelectStorey(storey.id);
                }}
                selected={isActive}
                sx={{
                  py: 0.5,
                  '&.Mui-selected': { backgroundColor: 'rgba(59,130,246,0.12)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {isExpanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText
                  primary={storey.name}
                  primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}
                />
                {storeyDeviceCount > 0 && (
                  <Chip label={storeyDeviceCount} size="small" sx={{ height: 18, fontSize: '0.7rem' }} />
                )}
                {onAddRoom && (
                  <Tooltip title="Add room">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); setDialog({ type: 'addRoom', storey, name: '', number: '' }); }}
                      sx={{ p: 0.25, ml: 0.5 }}
                    >
                      <AddCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canEditStructure && (
                  <Stack direction="row" spacing={0} sx={{ ml: 0.5 }}>
                    {onEditFloor && (
                      <Tooltip title="Edit floor">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setDialog({ type: 'editFloor', storey, name: storey.name }); }}
                          sx={{ p: 0.25 }}
                        >
                          <EditRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onDeleteFloor && (
                      <Tooltip title="Delete floor">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => { e.stopPropagation(); setDialog({ type: 'deleteFloor', storey }); }}
                          sx={{ p: 0.25 }}
                        >
                          <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                )}
              </ListItemButton>

              <Collapse in={isExpanded}>
                {storeyRooms.map((room) => {
                  const roomDevices = devicesInRoom(room.expressId);
                  const hasDevices = roomDevices.length > 0;
                  const isRoomExpanded = expandedRooms.has(room.expressId);

                  return (
                    <Fragment key={room.expressId}>
                      <ListItemButton
                        sx={{ pl: 4, py: 0.25 }}
                        onClick={() => {
                          onSelectRoom(room);
                          toggleRoom(room.expressId);
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          {hasDevices ? (
                            <SensorsRoundedIcon sx={{ fontSize: 16, color: 'success.light' }} />
                          ) : (
                            <MeetingRoomRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={room.name}
                          primaryTypographyProps={{
                            fontSize: '0.78rem',
                            color: hasDevices ? 'text.primary' : 'text.secondary',
                            noWrap: true,
                          }}
                        />
                        {hasDevices && (
                          <Chip label={roomDevices.length} size="small" sx={{ height: 16, fontSize: '0.65rem' }} color="success" variant="outlined" />
                        )}
                        <Tooltip title="Add sensor to room">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onAddDeviceToRoom(room); }}
                            sx={{ p: 0.25, ml: 0.5 }}
                            data-testid={`add-device-room-${room.expressId}`}
                          >
                            <AddCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        {canEditStructure && (
                          <Stack direction="row" spacing={0} sx={{ ml: 0.25 }}>
                            {onEditRoom && (
                              <Tooltip title="Edit room">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nameParts = room.name.split(' — ');
                                    setDialog({
                                      type: 'editRoom',
                                      room,
                                      name: nameParts.length > 1 ? nameParts[1] : room.name,
                                      number: nameParts.length > 1 ? nameParts[0] : '',
                                    });
                                  }}
                                  sx={{ p: 0.25 }}
                                >
                                  <EditRoundedIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {onDeleteRoom && (
                              <Tooltip title="Delete room">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => { e.stopPropagation(); setDialog({ type: 'deleteRoom', room }); }}
                                  sx={{ p: 0.25 }}
                                >
                                  <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        )}
                      </ListItemButton>

                      <Collapse in={isRoomExpanded}>
                          {roomDevices.map((device) => (
                            <Box
                              key={device.deviceId}
                              sx={{
                                pl: 7,
                                pr: 1,
                                py: 0.25,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                              }}
                            >
                              <span
                                data-testid={`activity-dot-${device.uniqueId}`}
                                style={{
                                  display: 'inline-block',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  backgroundColor: getSensorActivityColor(device.lastContact, Date.now()),
                                }}
                              />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', display: 'block' }} noWrap>
                                  {device.uniqueId}
                                </Typography>
                                {device.name && (
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }} noWrap>
                                    {device.name}
                                  </Typography>
                                )}
                              </Box>
                              <Tooltip title="Locate in model">
                                <IconButton size="small" onClick={() => onLocateDevice(device)} sx={{ p: 0.25 }}>
                                  <MyLocationRoundedIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Sensor data">
                                <IconButton size="small" onClick={() => onShowSensorData(device.uniqueId)} sx={{ p: 0.25 }}>
                                  <BarChartRoundedIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Remove from building">
                                <IconButton size="small" color="error" onClick={() => onRemoveDevice(device)} sx={{ p: 0.25 }}>
                                  <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          ))}
                        {roomDevices.length === 0 && (
                          <Typography variant="caption" sx={{ pl: 7, py: 0.5, display: 'block', color: 'text.disabled', fontSize: '0.7rem' }}>
                            No sensors
                          </Typography>
                        )}
                        </Collapse>
                    </Fragment>
                  );
                })}
                {storeyRooms.length === 0 && (
                  <Typography variant="caption" sx={{ pl: 5, py: 0.5, display: 'block', color: 'text.disabled', fontSize: '0.7rem', fontStyle: 'italic' }}>
                    No rooms
                  </Typography>
                )}
              </Collapse>
            </Fragment>
          );
        })}

        {storeys.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No floors yet</Typography>
            {onAddFloor && (
              <Typography variant="caption" color="text.disabled">
                Click + to add a floor.
              </Typography>
            )}
          </Box>
        )}

        {/* Unassigned devices */}
        {unassignedDevices.length > 0 && (
          <>
            <Box sx={{ p: 1, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Placed (no room)
              </Typography>
            </Box>
            {unassignedDevices.map((device) => (
              <Box
                key={device.deviceId}
                sx={{
                  pl: 2,
                  pr: 1,
                  py: 0.25,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                }}
              >
                <Box
                  data-testid={`activity-dot-${device.uniqueId}`}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: getSensorActivityColor(device.lastContact, Date.now()),
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} noWrap>
                    {device.uniqueId}
                  </Typography>
                </Box>
                <Tooltip title="Locate">
                  <IconButton size="small" onClick={() => onLocateDevice(device)} sx={{ p: 0.25 }}>
                    <MyLocationRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Sensor data">
                  <IconButton size="small" onClick={() => onShowSensorData(device.uniqueId)} sx={{ p: 0.25 }}>
                    <BarChartRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton size="small" color="error" onClick={() => onRemoveDevice(device)} sx={{ p: 0.25 }}>
                    <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </>
        )}
      </List>

      {/* All floors button */}
      <Box sx={{ p: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Typography
          variant="caption"
          sx={{
            cursor: 'pointer',
            color: activeStorey === null ? 'primary.main' : 'text.secondary',
            fontWeight: activeStorey === null ? 700 : 400,
            '&:hover': { color: 'primary.light' },
          }}
          onClick={() => onSelectStorey(null)}
        >
          Show all floors
        </Typography>
      </Box>

      {/* Add/Edit/Delete dialogs */}
      {dialog && !isDeleteDialog && (
        <Dialog open onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            {(dialog.type === 'addFloor' || dialog.type === 'editFloor') && (
              <TextField
                label="Floor name"
                value={dialog.name}
                onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                autoFocus
                required
              />
            )}
            {(dialog.type === 'addRoom' || dialog.type === 'editRoom') && (
              <>
                <TextField
                  label="Room name"
                  value={dialog.name}
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  autoFocus
                  required
                />
                <TextField
                  label="Room number (optional)"
                  value={dialog.number}
                  onChange={(e) => setDialog({ ...dialog, number: e.target.value })}
                />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={
                saving ||
                ((dialog.type === 'addFloor' || dialog.type === 'editFloor') && !dialog.name.trim()) ||
                ((dialog.type === 'addRoom' || dialog.type === 'editRoom') && !dialog.name.trim())
              }
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {dialog && isDeleteDialog && (
        <Dialog open onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete <strong>{deleteTarget}</strong>?
              {dialog.type === 'deleteFloor' && ' All rooms on this floor will also be removed.'}
              {' '}Devices will be kept in the building but unassigned from their room.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleSave} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export default BimSidePanel;
