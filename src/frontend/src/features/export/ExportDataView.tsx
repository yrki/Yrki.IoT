import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
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
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import {
  exportReadings,
  getDevices,
  getDistinctSensorTypes,
  getLocations,
  LocationDto,
  SensorListItemDto,
  SensorReadingDto,
} from '../../api/api';
import {
  buildLocationOptions,
  buildTree,
  collectDescendantLocationIds,
  findLocationNode,
} from '../locations/locationTree';

type ExportFormat = 'csv' | 'json' | 'xml';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// --- Pivot readings into one row per (sensorId, timestamp) ---
interface PivotedRow {
  sensorId: string;
  timestamp: string;
  gatewayId: string | null;
  rssi: number | null;
  [readingType: string]: string | number | null;
}

/**
 * For each sensor, keep only the readings at the timestamp closest to
 * targetDate (within the already-fetched slack window), then pivot into
 * one row per sensor with a column per reading type.
 */
function pickClosestAndPivot(
  readings: SensorReadingDto[],
  targetDate: Date,
): PivotedRow[] {
  // Group all readings by sensorId
  const bySensor = new Map<string, SensorReadingDto[]>();
  for (const r of readings) {
    let list = bySensor.get(r.sensorId);
    if (!list) {
      list = [];
      bySensor.set(r.sensorId, list);
    }
    list.push(r);
  }

  const targetMs = targetDate.getTime();
  const result: PivotedRow[] = [];

  for (const [sensorId, sensorReadings] of bySensor) {
    // Find the timestamp closest to targetDate
    let closestTs: string | null = null;
    let closestDiff = Infinity;

    for (const r of sensorReadings) {
      const diff = Math.abs(new Date(r.timestamp).getTime() - targetMs);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestTs = r.timestamp;
      }
    }

    if (!closestTs) continue;

    // Pivot all readings at that timestamp into one row
    const row: PivotedRow = {
      sensorId,
      timestamp: closestTs,
      gatewayId: null,
      rssi: null,
    };

    for (const r of sensorReadings) {
      if (r.timestamp === closestTs) {
        row[r.sensorType] = r.value;
        if (r.gatewayId) row.gatewayId = r.gatewayId;
        if (r.rssi != null) row.rssi = r.rssi;
      }
    }

    result.push(row);
  }

  return result.sort((a, b) => a.sensorId.localeCompare(b.sensorId));
}

// --- File builders ---
function buildCsv(rows: PivotedRow[], columns: string[]): string {
  const header = columns.join(',');
  const dataRows = rows.map((row) =>
    columns.map((col) => {
      const s = row[col] != null ? String(row[col]) : '';
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','),
  );
  return [header, ...dataRows].join('\n');
}

function buildJson(rows: PivotedRow[], columns: string[]): string {
  return JSON.stringify(rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) obj[col] = row[col] ?? null;
    return obj;
  }), null, 2);
}

function buildXml(rows: PivotedRow[], columns: string[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dataRows = rows.map((row) => {
    const children = columns.map((col) => `    <${col}>${esc(row[col] != null ? String(row[col]) : '')}</${col}>`);
    return `  <reading>\n${children.join('\n')}\n  </reading>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<readings>\n${dataRows.join('\n')}\n</readings>`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Component ---
function ExportDataView() {
  const [devices, setDevices] = useState<SensorListItemDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [allReadingTypes, setAllReadingTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [locationFilter, setLocationFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [targetDate, setTargetDate] = useState(() => formatDate(new Date()));
  const [slackDays, setSlackDays] = useState(1);

  const [relevantReadingTypes, setRelevantReadingTypes] = useState<string[]>([]);
  const [loadingReadingTypes, setLoadingReadingTypes] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDevices(), getLocations(), getDistinctSensorTypes()])
      .then(([devs, locs, types]) => {
        setDevices(devs);
        setLocations(locs);
        setAllReadingTypes(types);
        setSelectedColumns(new Set(types));
      })
      .catch((err) => console.error('Failed to load data:', err))
      .finally(() => setLoading(false));
  }, []);

  // Derived filter options
  const sensorsOnly = useMemo(() => devices.filter((d) => d.kind !== 'Gateway'), [devices]);

  const manufacturers = useMemo(
    () => [...new Set(sensorsOnly.map((d) => d.manufacturer).filter((m): m is string => Boolean(m)))].sort(),
    [sensorsOnly],
  );

  const deviceTypes = useMemo(
    () => [...new Set(sensorsOnly.map((d) => d.type).filter(Boolean))].sort(),
    [sensorsOnly],
  );

  // Location tree
  const locationTree = useMemo(() => buildTree(locations), [locations]);
  const locationOptions = useMemo(() => buildLocationOptions(locations), [locations]);

  const allowedLocationIds = useMemo(() => {
    if (!locationFilter) return null;
    const node = findLocationNode(locationTree, locationFilter);
    if (!node) return new Set([locationFilter]);
    return collectDescendantLocationIds(node);
  }, [locationFilter, locationTree]);

  // Filtered sensors
  const filteredSensors = useMemo(() => {
    return sensorsOnly.filter((d) => {
      if (allowedLocationIds && (!d.locationId || !allowedLocationIds.has(d.locationId))) return false;
      if (manufacturerFilter && d.manufacturer !== manufacturerFilter) return false;
      if (deviceTypeFilter && d.type !== deviceTypeFilter) return false;
      return true;
    });
  }, [sensorsOnly, allowedLocationIds, manufacturerFilter, deviceTypeFilter]);

  const filteredSensorIds = useMemo(() => filteredSensors.map((d) => d.uniqueId), [filteredSensors]);

  // Fetch reading types for the filtered sensors in one backend call
  useEffect(() => {
    let cancelled = false;
    setLoadingReadingTypes(true);

    const ids = filteredSensors.length > 0 && filteredSensors.length < sensorsOnly.length
      ? filteredSensorIds
      : undefined;

    getDistinctSensorTypes(ids)
      .then((types) => {
        if (!cancelled) {
          setRelevantReadingTypes(types);
        }
      })
      .catch(() => {
        if (!cancelled) setRelevantReadingTypes(allReadingTypes);
      })
      .finally(() => {
        if (!cancelled) setLoadingReadingTypes(false);
      });

    return () => { cancelled = true; };
  }, [filteredSensorIds, filteredSensors.length, sensorsOnly.length, allReadingTypes]);

  // Auto-update selected columns when relevant types change
  useEffect(() => {
    setSelectedColumns((prev) => {
      const next = new Set<string>();
      if (prev.has('gatewayId')) next.add('gatewayId');
      if (prev.has('rssi')) next.add('rssi');
      for (const t of relevantReadingTypes) next.add(t);
      return next;
    });
  }, [relevantReadingTypes]);

  const optionalMeta = [
    { key: 'gatewayId', label: 'Gateway ID' },
    { key: 'rssi', label: 'RSSI' },
  ];

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedReadingTypes = useMemo(
    () => relevantReadingTypes.filter((t) => selectedColumns.has(t)),
    [relevantReadingTypes, selectedColumns],
  );

  const selectedLocationName = locationFilter
    ? locations.find((l) => l.id === locationFilter)?.name ?? null
    : null;

  const exportColumns = useMemo(() => {
    const cols: string[] = ['sensorId', 'timestamp'];
    for (const meta of optionalMeta) {
      if (selectedColumns.has(meta.key)) cols.push(meta.key);
    }
    for (const type of relevantReadingTypes) {
      if (selectedColumns.has(type)) cols.push(type);
    }
    return cols;
  }, [selectedColumns, relevantReadingTypes]);

  const handleExport = async () => {
    if (selectedReadingTypes.length === 0) return;

    const target = new Date(targetDate);
    const from = new Date(target);
    from.setDate(from.getDate() - slackDays);
    const to = new Date(target);
    to.setDate(to.getDate() + slackDays);
    to.setHours(23, 59, 59, 999);

    setExporting(true);
    setError(null);
    setResult(null);

    try {
      const readings = await exportReadings(filteredSensorIds, selectedReadingTypes, from.toISOString(), to.toISOString());

      const pivoted = pickClosestAndPivot(readings, target);

      if (pivoted.length === 0) {
        setResult('No readings found for the selected criteria and date range.');
        return;
      }
      const ts = formatDate(new Date());
      let content: string, filename: string, mime: string;

      switch (format) {
        case 'json':
          content = buildJson(pivoted, exportColumns);
          filename = `yrki-export-${ts}.json`;
          mime = 'application/json';
          break;
        case 'xml':
          content = buildXml(pivoted, exportColumns);
          filename = `yrki-export-${ts}.xml`;
          mime = 'application/xml';
          break;
        default:
          content = buildCsv(pivoted, exportColumns);
          filename = `yrki-export-${ts}.csv`;
          mime = 'text/csv';
          break;
      }

      downloadFile(content, filename, mime);
      setResult(`Exported ${pivoted.length} sensor${pivoted.length === 1 ? '' : 's'} (closest reading to ${targetDate} per sensor) to ${filename}`);
    } catch {
      setError('Export failed. Try narrowing the date range or selection.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, borderRadius: '6px', backgroundColor: 'rgba(36,42,51,0.82)', border: '1px solid rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Paper>
    );
  }

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
        Export Sensor Readings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Filter by location, manufacturer and device type, then choose columns and date range.
      </Typography>

      <Stack spacing={3}>
        {/* Row 1: Format + Date */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField label="Format" select size="small" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} sx={{ minWidth: 140 }}>
            <MenuItem value="csv">CSV</MenuItem>
            <MenuItem value="json">JSON</MenuItem>
            <MenuItem value="xml">XML</MenuItem>
          </TextField>
          <TextField label="Target date" type="date" size="small" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="± slack days" type="number" size="small" value={slackDays} onChange={(e) => setSlackDays(Math.max(0, parseInt(e.target.value) || 0))} inputProps={{ min: 0, max: 365 }} sx={{ width: 120 }} />
          <Typography variant="caption" color="text.secondary">
            {(() => {
              const t = new Date(targetDate);
              const f = new Date(t); f.setDate(f.getDate() - slackDays);
              const tt = new Date(t); tt.setDate(tt.getDate() + slackDays);
              return `Range: ${formatDate(f)} → ${formatDate(tt)}`;
            })()}
          </Typography>
        </Stack>

        {/* Row 2: Filters */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Location"
            select
            size="small"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            sx={{ minWidth: 240 }}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true, renderValue: () => selectedLocationName ?? 'All locations' }}
          >
            <MenuItem value="">All locations</MenuItem>
            {locationOptions.map(({ location, depth }) => (
              <MenuItem key={location.id} value={location.id} sx={{ pl: 2 + depth * 2 }}>
                {location.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Manufacturer"
            select
            size="small"
            value={manufacturerFilter}
            onChange={(e) => setManufacturerFilter(e.target.value)}
            sx={{ minWidth: 200 }}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true, renderValue: () => manufacturerFilter || 'All manufacturers' }}
          >
            <MenuItem value="">All manufacturers</MenuItem>
            {manufacturers.map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Device type"
            select
            size="small"
            value={deviceTypeFilter}
            onChange={(e) => setDeviceTypeFilter(e.target.value)}
            sx={{ minWidth: 200 }}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true, renderValue: () => deviceTypeFilter || 'All device types' }}
          >
            <MenuItem value="">All device types</MenuItem>
            {deviceTypes.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          {filteredSensors.length} sensor{filteredSensors.length === 1 ? '' : 's'} match
          {selectedLocationName && ` · ${selectedLocationName}`}
          {manufacturerFilter && ` · ${manufacturerFilter}`}
          {deviceTypeFilter && ` · ${deviceTypeFilter}`}
        </Typography>

        {/* Column selection */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Output columns</Typography>
            {loadingReadingTypes && <CircularProgress size={14} />}
          </Stack>
          <TableContainer sx={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', maxHeight: 400, overflowY: 'scroll' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48, backgroundColor: 'rgba(15,23,42,0.8)' }}>
                    <Checkbox
                      size="small"
                      checked={optionalMeta.every((m) => selectedColumns.has(m.key)) && relevantReadingTypes.every((t) => selectedColumns.has(t))}
                      indeterminate={
                        (optionalMeta.some((m) => selectedColumns.has(m.key)) || relevantReadingTypes.some((t) => selectedColumns.has(t)))
                        && !(optionalMeta.every((m) => selectedColumns.has(m.key)) && relevantReadingTypes.every((t) => selectedColumns.has(t)))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedColumns(new Set([...optionalMeta.map((m) => m.key), ...relevantReadingTypes]));
                        } else {
                          setSelectedColumns(new Set());
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'rgba(15,23,42,0.8)' }}>Column</TableCell>
                  <TableCell sx={{ fontWeight: 600, backgroundColor: 'rgba(15,23,42,0.8)' }}>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Fixed */}
                <TableRow>
                  <TableCell><Checkbox size="small" checked disabled /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>sensorId</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Sensor unique identifier (always included)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Checkbox size="small" checked disabled /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>timestamp</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Reading date and time (always included)</TableCell>
                </TableRow>

                {/* Optional meta */}
                {optionalMeta.map((meta) => (
                  <TableRow key={meta.key} hover>
                    <TableCell><Checkbox size="small" checked={selectedColumns.has(meta.key)} onChange={() => toggleColumn(meta.key)} /></TableCell>
                    <TableCell>{meta.key}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{meta.label}</TableCell>
                  </TableRow>
                ))}

                {/* Dynamic reading types */}
                {relevantReadingTypes.length > 0 ? (
                  relevantReadingTypes.map((type) => (
                    <TableRow key={type} hover>
                      <TableCell><Checkbox size="small" checked={selectedColumns.has(type)} onChange={() => toggleColumn(type)} /></TableCell>
                      <TableCell>{type}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Sensor reading value</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                      {loadingReadingTypes ? 'Discovering reading types...' : 'No reading types found for the selected sensors.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Status */}
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {result && <Alert severity="success" onClose={() => setResult(null)}>{result}</Alert>}

        {/* Export */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadRoundedIcon />}
            disabled={selectedReadingTypes.length === 0 || filteredSensors.length === 0 || exporting}
            onClick={handleExport}
          >
            {exporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {filteredSensors.length} sensor{filteredSensors.length === 1 ? '' : 's'} · {selectedReadingTypes.length} reading type{selectedReadingTypes.length === 1 ? '' : 's'}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default ExportDataView;
