import { useEffect, useMemo, useState } from 'react';
import {
  Box,
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
import { getGateways, SensorListItemDto } from '../../api/api';

type SortableField = 'uniqueId' | 'name' | 'locationName' | 'lastContact';
type SortDirection = 'asc' | 'desc';

interface GatewayListViewProps {
  onNavigateToGateway: (gatewayId: string) => void;
}

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
}

function GatewayListView({ onNavigateToGateway }: GatewayListViewProps) {
  const [gateways, setGateways] = useState<SensorListItemDto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('lastContact');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    getGateways()
      .then(setGateways)
      .catch((err) => console.error('Failed to fetch gateways:', err));
  }, []);

  const filteredGateways = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const normalizedTerm = normalizeSearchValue(searchTerm.trim());

    return [...gateways]
      .filter((gateway) => {
        if (!term) {
          return true;
        }

        return [gateway.uniqueId, gateway.name, gateway.type, gateway.locationName]
          .filter(Boolean)
          .some((value) => {
            const rawValue = String(value).toLowerCase();
            return rawValue.includes(term) || normalizeSearchValue(String(value)).includes(normalizedTerm);
          });
      })
      .sort((left, right) => {
        const leftValue = String(left[sortBy] ?? '');
        const rightValue = String(right[sortBy] ?? '');
        return sortDirection === 'asc'
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      });
  }, [gateways, searchTerm, sortBy, sortDirection]);

  const handleSort = (column: SortableField) => {
    if (sortBy === column) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortBy(column);
    setSortDirection('asc');
  };

  const columns: Array<{ id: SortableField; label: string }> = [
    { id: 'uniqueId', label: 'Gateway ID' },
    { id: 'name', label: 'Name' },
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
            Gateways
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Registered gateways. Click a gateway to inspect sensor contacts.
          </Typography>
        </Box>
        <TextField
          placeholder="Search gateways"
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
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
        <Chip label={`${filteredGateways.length} gateway${filteredGateways.length === 1 ? '' : 's'}`} />
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
                      '&.Mui-active': { color: 'text.primary' },
                      '& .MuiTableSortLabel-icon': { color: 'text.secondary !important' },
                    }}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGateways.map((gateway) => (
              <TableRow
                key={gateway.id}
                hover
                sx={{
                  cursor: 'pointer',
                  '&:last-child td': { borderBottom: 0 },
                  '& .MuiTableCell-root': { borderBottomColor: 'rgba(255,255,255,0.06)' },
                }}
                onClick={() => onNavigateToGateway(gateway.uniqueId)}
              >
                <TableCell sx={{ fontFamily: 'monospace' }}>{gateway.uniqueId}</TableCell>
                <TableCell>{gateway.name ?? '-'}</TableCell>
                <TableCell>{gateway.locationName ?? '-'}</TableCell>
                <TableCell>{new Date(gateway.lastContact).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {filteredGateways.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  {gateways.length === 0 ? 'No gateways registered yet.' : 'No gateways match the search.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default GatewayListView;
