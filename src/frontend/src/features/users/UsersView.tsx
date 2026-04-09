import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { AxiosError } from 'axios';
import { createUser, deleteUser, getUsers, updateUser, UserDto } from '../../api/api';

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

type SortableField = 'email' | 'createdAtUtc' | 'lastLoginAtUtc';
type SortDirection = 'asc' | 'desc';

function UsersView() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('email');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return [...users]
      .filter((u) => !term || u.email.toLowerCase().includes(term))
      .sort((a, b) => {
        const av = String(a[sortBy] ?? '');
        const bv = String(b[sortBy] ?? '');
        return sortDirection === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [users, searchTerm, sortBy, sortDirection]);

  const handleSort = (column: SortableField) => {
    if (sortBy === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUsers();
      setUsers(response);
    } catch (loadError) {
      console.error('Failed to fetch users:', loadError);
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const openCreateDialog = () => {
    setEditingUser(null);
    setEmail('');
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (user: UserDto) => {
    setEditingUser(user);
    setEmail(user.email);
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
    setEmail('');
  };

  const handleSave = async () => {
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingUser) {
        const updated = await updateUser(editingUser.id, email.trim());
        setUsers((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      } else {
        const created = await createUser(email.trim());
        setUsers((current) => [...current, created]);
      }

      setError(null);
      handleCloseDialog();
    } catch (saveError) {
      if (saveError instanceof AxiosError && saveError.response?.status === 409) {
        setError('A user with this email already exists.');
      } else {
        console.error('Failed to save user:', saveError);
        setError('Failed to save user.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserDto) => {
    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((candidate) => candidate.id !== user.id));
    } catch (deleteError) {
      console.error('Failed to delete user:', deleteError);
      setError(`Failed to delete ${user.email}.`);
    }
  };

  const columns: Array<{ id: SortableField; label: string }> = [
    { id: 'email', label: 'Email' },
    { id: 'createdAtUtc', label: 'Created' },
    { id: 'lastLoginAtUtc', label: 'Last login' },
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
            Users
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            placeholder="Search users"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: { sm: 260 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateDialog}>
            Add user
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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
                align="right"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderBottomColor: 'rgba(255,255,255,0.06)',
                  width: 100,
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow
                key={user.id}
                hover
                sx={{
                  '&:last-child td': { borderBottom: 0 },
                  '& .MuiTableCell-root': { borderBottomColor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <TableCell>{user.email}</TableCell>
                <TableCell>{formatDateTime(user.createdAtUtc)}</TableCell>
                <TableCell>{formatDateTime(user.lastLoginAtUtc)}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <IconButton size="small" aria-label={`Edit ${user.email}`} onClick={() => openEditDialog(user)}>
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label={`Delete ${user.email}`} onClick={() => void handleDelete(user)}>
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  {users.length === 0 ? 'No users created yet.' : 'No users match the search.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingUser ? 'Edit user' : 'Add user'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving} variant="contained">
            {editingUser ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default UsersView;
