import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import {
  BuildingDto,
  createBuilding,
  deleteBuilding,
  getBuildings,
  updateBuilding,
  uploadBuildingIfc,
} from '../../api/api';
import { handleCoordinatePaste } from '../map/coordinatePaste';

type SortField = 'name' | 'address' | 'deviceCount' | 'createdAtUtc';

interface BuildingsListViewProps {
  onNavigateToBuilding: (buildingId: string) => void;
}

function BuildingsListView({ onNavigateToBuilding }: BuildingsListViewProps) {
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BuildingDto | null>(null);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadBuildings = () => {
    getBuildings()
      .then(setBuildings)
      .catch((err) => console.error('Failed to fetch buildings:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBuildings(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormAddress('');
    setFormLat('');
    setFormLng('');
    setIfcFile(null);
    setUploadError(null);
    setDialogOpen(true);
  };

  const openEdit = (b: BuildingDto) => {
    setEditing(b);
    setFormName(b.name);
    setFormAddress(b.address ?? '');
    setFormLat(b.latitude != null ? String(b.latitude) : '');
    setFormLng(b.longitude != null ? String(b.longitude) : '');
    setIfcFile(null);
    setUploadError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setUploading(true);
    setUploadError(null);

    try {
      const lat = formLat.trim() ? Number(formLat) : undefined;
      const lng = formLng.trim() ? Number(formLng) : undefined;

      let buildingId: string;
      if (editing) {
        await updateBuilding(editing.id, {
          name: formName.trim(),
          address: formAddress.trim() || undefined,
          latitude: lat ?? null,
          longitude: lng ?? null,
        });
        buildingId = editing.id;
      } else {
        const created = await createBuilding(formName.trim(), formAddress.trim() || undefined, lat, lng);
        buildingId = created.id;
      }

      if (ifcFile) {
        await uploadBuildingIfc(buildingId, ifcFile);
      }

      setDialogOpen(false);
      loadBuildings();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBuilding(id);
    loadBuildings();
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const handleIfcDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.ifc')) setIfcFile(file);
  };

  const handleIfcInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setIfcFile(file);
  };

  const term = searchTerm.trim().toLowerCase();
  const filtered = buildings
    .filter((b) =>
      !term || b.name.toLowerCase().includes(term) || (b.address ?? '').toLowerCase().includes(term),
    )
    .sort((a, b) => {
      const av = String(a[sortBy] ?? '');
      const bv = String(b[sortBy] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const columns: Array<{ id: SortField; label: string }> = [
    { id: 'name', label: 'Name' },
    { id: 'address', label: 'Address' },
    { id: 'deviceCount', label: 'Sensors' },
    { id: 'createdAtUtc', label: 'Created' },
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
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }} justifyContent="space-between" sx={{ mb: 3 }}>
          <Typography variant="h4">Buildings</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              placeholder="Search buildings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: { sm: 280 } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
              }}
            />
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Add building
            </Button>
          </Stack>
        </Stack>

        <TableContainer sx={{ borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(23,26,32,0.44)' }}>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.id} sx={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                    <TableSortLabel active={sortBy === col.id} direction={sortBy === col.id ? sortDir : 'asc'} onClick={() => handleSort(col.id)}>
                      {col.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell sx={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottomColor: 'rgba(255,255,255,0.06)', width: 48 }}>IFC</TableCell>
                <TableCell sx={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottomColor: 'rgba(255,255,255,0.06)', width: 100 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((building) => (
                <TableRow
                  key={building.id}
                  hover
                  sx={{ cursor: 'pointer', '& .MuiTableCell-root': { borderBottomColor: 'rgba(255,255,255,0.06)' } }}
                  onClick={() => onNavigateToBuilding(building.id)}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{building.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{building.address ?? '-'}</TableCell>
                  <TableCell><Chip label={building.deviceCount} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{new Date(building.createdAtUtc).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {building.ifcFileName
                      ? <Chip label="IFC" size="small" color="success" variant="outlined" />
                      : <Chip label="—" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(building)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(building.id)} disabled={building.deviceCount > 0}>
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                    {buildings.length === 0 ? 'No buildings yet.' : 'No buildings match the search.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add / Edit dialog with IFC upload */}
      <Dialog open={dialogOpen} onClose={() => !uploading && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Building' : 'Add Building'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Name" value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus required />
          <TextField label="Address" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Latitude" value={formLat} onChange={(e) => setFormLat(e.target.value)}
              onPaste={(e) => handleCoordinatePaste(e, setFormLat, setFormLng)}
              type="number" inputProps={{ step: 'any' }} fullWidth
            />
            <TextField
              label="Longitude" value={formLng} onChange={(e) => setFormLng(e.target.value)}
              onPaste={(e) => handleCoordinatePaste(e, setFormLat, setFormLng)}
              type="number" inputProps={{ step: 'any' }} fullWidth
            />
          </Stack>

          {/* IFC upload */}
          <Box
            onDrop={handleIfcDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('ifc-file-input')?.click()}
            sx={{
              border: ifcFile || editing?.ifcFileName
                ? '2px solid rgba(34,197,94,0.4)'
                : '2px dashed rgba(148,163,184,0.3)',
              borderRadius: '8px',
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: ifcFile ? 'rgba(34,197,94,0.06)' : 'transparent',
              '&:hover': { borderColor: 'primary.main', backgroundColor: 'rgba(59,130,246,0.04)' },
            }}
          >
            {ifcFile ? (
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                <CheckCircleRoundedIcon sx={{ color: 'success.main' }} />
                <Typography variant="body2">{ifcFile.name} ({(ifcFile.size / 1024 / 1024).toFixed(1)} MB)</Typography>
                <Button size="small" onClick={(e) => { e.stopPropagation(); setIfcFile(null); }}>Clear</Button>
              </Stack>
            ) : editing?.ifcFileName ? (
              <Stack spacing={0.5} alignItems="center">
                <CheckCircleRoundedIcon sx={{ color: 'success.main' }} />
                <Typography variant="body2" color="text.secondary">IFC model uploaded</Typography>
                <Typography variant="caption" color="text.secondary">Drop a new .ifc file here to replace</Typography>
              </Stack>
            ) : (
              <Stack spacing={0.5} alignItems="center">
                <UploadFileRoundedIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                <Typography variant="body2">Drag and drop an .ifc file, or click to browse</Typography>
                <Typography variant="caption" color="text.secondary">Optional — you can upload later</Typography>
              </Stack>
            )}
            <input
              id="ifc-file-input"
              type="file"
              accept=".ifc"
              style={{ display: 'none' }}
              onChange={handleIfcInput}
            />
          </Box>

          {uploadError && <Alert severity="error">{uploadError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={uploading}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!formName.trim() || uploading}>
            {uploading ? <><CircularProgress size={16} sx={{ mr: 1 }} /> Saving...</> : editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default BuildingsListView;
