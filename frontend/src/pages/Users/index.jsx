import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useToast } from '../../components/common/ToastProvider';
import userService from '../../services/userService';

const UsersPage = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, user: null, action: '' });

  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAllUsers()
  });

  const users = usersResponse?.success && usersResponse?.data 
    ? (Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data.users || [])
    : [];

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      const response = await userService.updateUser(userId, data);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update user');
      }
      return response;
    },
    onSuccess: () => {
      showSuccess('User updated successfully');
      queryClient.invalidateQueries(['users']);
      setConfirmDialog({ open: false, user: null, action: '' });
    },
    onError: (error) => {
      showError(error.message || 'Failed to update user');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await userService.deleteUser(userId);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete user');
      }
      return response;
    },
    onSuccess: () => {
      showSuccess('User deleted successfully');
      queryClient.invalidateQueries(['users']);
      setConfirmDialog({ open: false, user: null, action: '' });
    },
    onError: (error) => {
      showError(error.message || 'Failed to delete user');
    }
  });

  const filteredUsers = users.filter(user => {
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesRole && matchesStatus;
  });

  const handleAction = (user, action) => {
    setConfirmDialog({ open: true, user, action });
  };

  const handleConfirm = () => {
    const { user, action } = confirmDialog;
    if (!user) return;

    switch (action) {
      case 'delete':
        deleteUserMutation.mutate(user.id || user._id);
        break;
      case 'activate':
        updateUserMutation.mutate({
          userId: user.id || user._id,
          data: { status: 'active' }
        });
        break;
      case 'deactivate':
        updateUserMutation.mutate({
          userId: user.id || user._id,
          data: { status: 'inactive' }
        });
        break;
      default:
        break;
    }
  };

  if (usersLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2}>
          <TextField
            select
            label="Filter by Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Roles</MenuItem>
            <MenuItem value="owner">Owner</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="user">User</MenuItem>
          </TextField>
          <TextField
            select
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Alert severity="info">No users found</Alert>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id || user._id}>
                  <TableCell>{user.name || user.username || 'N/A'}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role || 'user'}
                      color={user.role === 'owner' ? 'error' : user.role === 'admin' ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.status || 'active'}
                      color={user.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    {user.status === 'active' ? (
                      <IconButton
                        size="small"
                        onClick={() => handleAction(user, 'deactivate')}
                        color="warning"
                      >
                        <BlockIcon />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => handleAction(user, 'activate')}
                        color="success"
                      >
                        <CheckCircleIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleAction(user, 'delete')}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, user: null, action: '' })}
      >
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {confirmDialog.action} user{' '}
            {confirmDialog.user?.email || confirmDialog.user?.name}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, user: null, action: '' })}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} color="error" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UsersPage;

