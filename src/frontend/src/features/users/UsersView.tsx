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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
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

function UsersView() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => left.email.localeCompare(right.email, 'nb-NO', { sensitivity: 'base' })),
    [users],
  );

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

  return (
    <Box sx={{ width: '100%', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 12, md: 14 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Users
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1 }}>
              Manage access to the Yrki.IoT workspace.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateDialog}>
            Add user
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TableContainer component={Paper} sx={{ backgroundColor: 'background.paper' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last login</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedUsers.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{formatDateTime(user.createdAtUtc)}</TableCell>
                  <TableCell>{formatDateTime(user.lastLoginAtUtc)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton aria-label={`Edit ${user.email}`} onClick={() => openEditDialog(user)}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label={`Delete ${user.email}`} onClick={() => void handleDelete(user)}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && sortedUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography sx={{ color: 'text.secondary' }}>
                      No users created yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

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
    </Box>
  );
}

export default UsersView;
