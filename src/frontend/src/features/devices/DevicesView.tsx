import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
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
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddDeviceDialog from './AddDeviceDialog';
import { initialDevices } from './deviceData';
import { DeviceListItem } from './types';

type SortableField = keyof Pick<
  DeviceListItem,
  'id' | 'name' | 'uniqueId' | 'type' | 'locationId' | 'description' | 'lastContact' | 'installationDate'
>;

type SortDirection = 'asc' | 'desc';

function compareValues(left: string, right: string, direction: SortDirection) {
  return direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
}

function formatDeviceType(type: DeviceListItem['type']) {
  return type === 'PassiveIR' ? 'Passive IR' : type;
}

function formatNullableValue(value: string | null) {
  return value && value.length > 0 ? value : '-';
}

function DevicesView() {
  const [devices, setDevices] = useState<DeviceListItem[]>(initialDevices);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredDevices = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...devices]
      .filter((device) => {
        if (!normalizedSearch) {
          return true;
        }

        return Object.values(device).some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        );
      })
      .sort((left, right) => compareValues(String(left[sortBy] ?? ''), String(right[sortBy] ?? ''), sortDirection));
  }, [devices, searchTerm, sortBy, sortDirection]);

  const handleSort = (column: SortableField) => {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDirection('asc');
  };

  const handleAddDevice = (device: DeviceListItem) => {
    setDevices((current) => [device, ...current]);
  };

  const columns: Array<{ id: SortableField; label: string }> = [
    { id: 'id', label: 'Id' },
    { id: 'name', label: 'Name' },
    { id: 'uniqueId', label: 'UniqueId' },
    { id: 'type', label: 'Type' },
    { id: 'locationId', label: 'LocationId' },
    { id: 'description', label: 'Description' },
    { id: 'lastContact', label: 'LastContact' },
    { id: 'installationDate', label: 'InstallationDate' },
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
              Devices
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Search, sort, and manage the registered devices.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              placeholder="Search devices"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              sx={{ minWidth: { sm: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialogOpen(true)}>
              Add device
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
          <Chip label={`${filteredDevices.length} device${filteredDevices.length === 1 ? '' : 's'}`} />
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
                        '&.Mui-active': {
                          color: 'text.primary',
                        },
                        '& .MuiTableSortLabel-icon': {
                          color: 'text.secondary !important',
                        },
                      }}
                    >
                      {column.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDevices.map((device) => (
                <TableRow
                  key={device.id}
                  hover
                  sx={{
                    '&:last-child td': { borderBottom: 0 },
                    '& .MuiTableCell-root': {
                      borderBottomColor: 'rgba(255,255,255,0.06)',
                    },
                  }}
                >
                  <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{device.id}</TableCell>
                  <TableCell>{formatNullableValue(device.name)}</TableCell>
                  <TableCell>{device.uniqueId}</TableCell>
                  <TableCell>{formatDeviceType(device.type)}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{device.locationId}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{device.description}</TableCell>
                  <TableCell>{new Date(device.lastContact).toLocaleString()}</TableCell>
                  <TableCell>{new Date(device.installationDate).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredDevices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                    No devices match the current search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <AddDeviceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAddDevice={handleAddDevice}
      />
    </>
  );
}

export default DevicesView;
