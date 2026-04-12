import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
  Typography,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
  getDevices,
  importDevices,
  ImportDeviceEntry,
  SensorListItemDto,
} from '../../api/api';

// --- Target fields the user can map to ---
const targetFields = [
  { key: 'uniqueId', label: 'Unique ID', required: true },
  { key: 'name', label: 'Name', required: false },
  { key: 'manufacturer', label: 'Manufacturer', required: false },
  { key: 'type', label: 'Type', required: false },
  { key: 'kind', label: 'Kind (Sensor/Gateway)', required: false },
  { key: 'latitude', label: 'Latitude', required: false },
  { key: 'longitude', label: 'Longitude', required: false },
  { key: 'locationName', label: 'Location name', required: false },
] as const;

type TargetFieldKey = (typeof targetFields)[number]['key'];

// --- Auto-mapping aliases ---
const aliases: Record<string, TargetFieldKey> = {
  uniqueid: 'uniqueId',
  id: 'uniqueId',
  deviceid: 'uniqueId',
  device_id: 'uniqueId',
  sensorid: 'uniqueId',
  sensor_id: 'uniqueId',
  serial: 'uniqueId',
  serialnumber: 'uniqueId',
  name: 'name',
  devicename: 'name',
  device_name: 'name',
  manufacturer: 'manufacturer',
  mfr: 'manufacturer',
  brand: 'manufacturer',
  vendor: 'manufacturer',
  type: 'type',
  sensortype: 'type',
  sensor_type: 'type',
  devicetype: 'type',
  device_type: 'type',
  kind: 'kind',
  devicekind: 'kind',
  device_kind: 'kind',
  lat: 'latitude',
  latitude: 'latitude',
  lng: 'longitude',
  lon: 'longitude',
  longitude: 'longitude',
  location: 'locationName',
  locationname: 'locationName',
  location_name: 'locationName',
  site: 'locationName',
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, '');
}

function autoMap(sourceColumns: string[]): Record<string, TargetFieldKey | ''> {
  const mapping: Record<string, TargetFieldKey | ''> = {};
  const used = new Set<TargetFieldKey>();

  for (const col of sourceColumns) {
    const norm = normalize(col);
    const match = aliases[norm];
    if (match && !used.has(match)) {
      mapping[col] = match;
      used.add(match);
    } else {
      mapping[col] = '';
    }
  }

  return mapping;
}

// --- File parsers ---
function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { columns: [], rows: [] };

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const columns = lines[0].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col] = values[i] ?? '';
    });
    return row;
  });

  return { columns, rows };
}

function parseJson(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const parsed = JSON.parse(text);
  const array = Array.isArray(parsed) ? parsed : parsed.devices ?? parsed.data ?? parsed.items ?? [];
  if (!Array.isArray(array) || array.length === 0) return { columns: [], rows: [] };

  const columns = [...new Set(array.flatMap((item: Record<string, unknown>) => Object.keys(item)))];
  const rows = array.map((item: Record<string, unknown>) => {
    const row: Record<string, string> = {};
    for (const col of columns) {
      row[col] = item[col] != null ? String(item[col]) : '';
    }
    return row;
  });

  return { columns, rows };
}

function parseXml(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  const items = doc.querySelectorAll('*');
  const rowElements: Element[] = [];

  for (const el of items) {
    if (el.children.length > 0 && el.children[0].children.length === 0) {
      rowElements.push(el);
    }
  }

  if (rowElements.length === 0) return { columns: [], rows: [] };

  const columns = [...new Set(rowElements.flatMap((el) => Array.from(el.children).map((c) => c.tagName)))];
  const rows = rowElements.map((el) => {
    const row: Record<string, string> = {};
    for (const col of columns) {
      const child = el.querySelector(col);
      row[col] = child?.textContent ?? '';
    }
    return row;
  });

  return { columns, rows };
}

function parseFile(text: string, filename: string): { columns: string[]; rows: Record<string, string>[] } {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'json') return parseJson(text);
  if (ext === 'xml') return parseXml(text);
  return parseCsv(text);
}

// --- Component ---
function ImportDataView() {
  const [fileData, setFileData] = useState<{ columns: string[]; rows: Record<string, string>[] } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, TargetFieldKey | ''>>({});
  const [replaceMode, setReplaceMode] = useState(false);
  const [existingDevices, setExistingDevices] = useState<SensorListItemDto[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; deleted: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDevices().then(setExistingDevices).catch(() => {});
  }, []);

  const handleFile = (file: File) => {
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseFile(text, file.name);
        if (parsed.columns.length === 0) {
          setError('Could not parse any columns from the file.');
          return;
        }
        setFileData(parsed);
        setFileName(file.name);
        setMapping(autoMap(parsed.columns));
      } catch {
        setError('Failed to parse file. Check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const uniqueIdColumn = useMemo(() => {
    for (const [col, target] of Object.entries(mapping)) {
      if (target === 'uniqueId') return col;
    }
    return null;
  }, [mapping]);

  const mappedDevices: ImportDeviceEntry[] = useMemo(() => {
    if (!fileData || !uniqueIdColumn) return [];

    return fileData.rows
      .filter((row) => row[uniqueIdColumn]?.trim())
      .map((row) => {
        const entry: Record<string, string | number | undefined> = {};
        for (const [col, target] of Object.entries(mapping)) {
          if (!target || !row[col]?.trim()) continue;
          const value = row[col].trim();
          if (target === 'latitude' || target === 'longitude') {
            const num = Number(value);
            if (!isNaN(num)) entry[target] = num;
          } else {
            entry[target] = value;
          }
        }
        return entry as unknown as ImportDeviceEntry;
      });
  }, [fileData, mapping, uniqueIdColumn]);

  const preview = useMemo(() => {
    const existingIds = new Set(existingDevices.map((d) => d.uniqueId.toLowerCase()));
    const importIds = new Set(mappedDevices.map((d) => d.uniqueId.toLowerCase()));
    const toInsert = mappedDevices.filter((d) => !existingIds.has(d.uniqueId.toLowerCase())).length;
    const toUpdate = mappedDevices.filter((d) => existingIds.has(d.uniqueId.toLowerCase())).length;
    const toDelete = replaceMode
      ? existingDevices.filter((d) => !importIds.has(d.uniqueId.toLowerCase())).length
      : 0;
    return { toInsert, toUpdate, toDelete };
  }, [mappedDevices, existingDevices, replaceMode]);

  const handleImport = async () => {
    setConfirmOpen(false);
    setImporting(true);
    setError(null);
    try {
      const res = await importDevices(mappedDevices, replaceMode ? 'replace' : 'update');
      setResult(res);
      setFileData(null);
      setFileName(null);
      const refreshed = await getDevices();
      setExistingDevices(refreshed);
    } catch {
      setError('Import failed. Check the data and try again.');
    } finally {
      setImporting(false);
    }
  };

  const usedTargets = new Set(Object.values(mapping).filter(Boolean));

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
      <Typography variant="h4" sx={{ mb: 0.75 }}>
        Import Data
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload a CSV, JSON or XML file with sensor and gateway data.
      </Typography>

      {/* File upload */}
      {!fileData && (
        <Box
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          sx={{
            border: '2px dashed rgba(148,163,184,0.3)',
            borderRadius: '8px',
            p: 6,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main', backgroundColor: 'rgba(59,130,246,0.04)' },
          }}
          onClick={() => document.getElementById('import-file-input')?.click()}
        >
          <UploadFileRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" sx={{ mb: 0.5 }}>
            Drag and drop a file here, or click to browse
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supported formats: .csv, .json, .xml
          </Typography>
          <input
            id="import-file-input"
            type="file"
            accept=".csv,.json,.xml"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setResult(null)}>
          Import complete: {result.inserted} inserted, {result.updated} updated, {result.deleted} deleted.
        </Alert>
      )}

      {/* Mapping UI */}
      {fileData && (
        <Box sx={{ mt: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Chip label={fileName} variant="outlined" onDelete={() => { setFileData(null); setFileName(null); }} />
            <Typography variant="body2" color="text.secondary">
              {fileData.rows.length} row{fileData.rows.length === 1 ? '' : 's'} · {fileData.columns.length} column{fileData.columns.length === 1 ? '' : 's'}
            </Typography>
          </Stack>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Map file columns to device fields
          </Typography>

          <TableContainer sx={{ mb: 3, border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>File column</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Sample value</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Maps to</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fileData.columns.map((col) => (
                  <TableRow key={col}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{col}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileData.rows[0]?.[col] ?? ''}
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={mapping[col] ?? ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [col]: e.target.value as TargetFieldKey | '' }))}
                        sx={{ minWidth: 200 }}
                      >
                        <MenuItem value="">— skip —</MenuItem>
                        {targetFields.map((field) => (
                          <MenuItem
                            key={field.key}
                            value={field.key}
                            disabled={usedTargets.has(field.key) && mapping[col] !== field.key}
                          >
                            {field.label}{field.required ? ' *' : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {!uniqueIdColumn && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You must map at least one column to <strong>Unique ID</strong> before importing.
            </Alert>
          )}

          <Stack spacing={2}>
            <FormControlLabel
              control={<Checkbox checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)} />}
              label="Replace all: delete existing devices not present in the imported file"
            />

            {uniqueIdColumn && (
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip label={`${preview.toInsert} to insert`} color="success" size="small" variant="outlined" />
                <Chip label={`${preview.toUpdate} to update`} color="primary" size="small" variant="outlined" />
                {replaceMode && (
                  <Chip label={`${preview.toDelete} to delete`} color="error" size="small" variant="outlined" />
                )}
              </Stack>
            )}

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                disabled={!uniqueIdColumn || mappedDevices.length === 0 || importing}
                onClick={() => setConfirmOpen(true)}
              >
                {importing ? 'Importing...' : 'Import'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => { setFileData(null); setFileName(null); setResult(null); }}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm import</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This will apply the following changes to the database:
          </Typography>
          <Stack spacing={1}>
            <Typography>
              <strong>{preview.toInsert}</strong> device{preview.toInsert === 1 ? '' : 's'} will be <strong>inserted</strong>
            </Typography>
            <Typography>
              <strong>{preview.toUpdate}</strong> device{preview.toUpdate === 1 ? '' : 's'} will be <strong>updated</strong>
            </Typography>
            {replaceMode && (
              <Typography color="error">
                <strong>{preview.toDelete}</strong> device{preview.toDelete === 1 ? '' : 's'} will be <strong>deleted</strong>
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={replaceMode ? 'error' : 'primary'}
            onClick={handleImport}
          >
            I confirm — apply changes
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default ImportDataView;
