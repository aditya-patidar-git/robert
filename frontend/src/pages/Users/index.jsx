import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Search, Check, Block, Delete, RemoveCircle } from '@mui/icons-material';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { formatDateTime } from '../../utils/formatters';
import { useToast } from '../../components/common/ToastProvider';
import userService from '../../services/userService';

// ✅ MOCK AUDIT LOGS (for UI testing)
const MOCK_AUDIT_LOGS = [
  { id: 1, userEmail: 'john.doe@example.com', action: 'Approved new admin account', timestamp: new Date() },
  { id: 2, userEmail: 'sarah.smith@example.com', action: 'Blocked user: alex.jones@example.com', timestamp: new Date(Date.now() - 3600_000) },
  { id: 3, userEmail: 'admin@system.com', action: 'Deleted user: test.user@example.com', timestamp: new Date(Date.now() - 7200_000) },
  { id: 4, userEmail: 'owner@example.com', action: 'Changed role of mike.lee@example.com to admin', timestamp: new Date(Date.now() - 10_800_000) },
];

const UsersPage = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, user: null, action: '' });

  // ✅ Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAllUsers
  });

  // ✅ Mock audit logs instead of API
  const auditLogs = MOCK_AUDIT_LOGS;

  // ✅ User action mutations
  const actionHandler = (mutationFn, successMsg, errorMsg) =>
    useMutation({
      mutationFn,
      onSuccess: () => {
        showSuccess(successMsg);
        queryClient.invalidateQueries(['users']);
      },
      onError: () => showError(errorMsg),
    });

  const approveUser = actionHandler(userService.approveUser, 'User approved', 'Approval failed');
  const blockUser = actionHandler(userService.blockUser, 'User blocked', 'Blocking failed');
  const excludeUser = actionHandler(userService.excludeUser, 'User excluded', 'Exclusion failed');
  const deleteUser = actionHandler(userService.deleteUser, 'User deleted', 'Deletion failed');

  // ✅ Filter logic
  const filteredUsers = users.filter(user => {
    const matchSearch =
      !searchTerm ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = !roleFilter || user.role === roleFilter;
    const matchStatus = !statusFilter || user.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const handleAction = (user, action) => setConfirmDialog({ open: true, user, action });

  const executeAction = () => {
    const { user, action } = confirmDialog;
    if (action === 'approve') approveUser.mutate(user.id);
    if (action === 'block') blockUser.mutate(user.id);
    if (action === 'exclude') excludeUser.mutate(user.id);
    if (action === 'delete') deleteUser.mutate(user.id);
    if (action === 'delete-audit') {
      // Handle audit log deletion (mock implementation)
      console.log('Deleting audit log:', user);
      showSuccess('Audit log deleted successfully');
    }
    setConfirmDialog({ open: false, user: null, action: '' });
  };

  const getStatusColor = (status) => ({
    active: 'success',
    pending: 'warning',
    blocked: 'error',
    excluded: 'default'
  }[status] || 'default');

  const getRoleColor = (role) => ({
    owner: 'error',
    admin: 'warning'
  }[role] || 'default');

  // ✅ Columns
  const userColumns = [
    {
      field: 'name',
      headerName: 'Name',
      width: 220,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {params.row.firstName} {params.row.lastName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            @{params.row.username}
          </Typography>
        </Box>
      )
    },
    { field: 'email', headerName: 'Email', width: 330 },
    {
      field: 'role',
      headerName: 'Role',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={getRoleColor(params.value)} size="small" />
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={getStatusColor(params.value)} size="small" variant="outlined" />
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {params.row.status === 'pending' && (
            <IconButton size="small" color="success" onClick={() => handleAction(params.row, 'approve')}>
              <Check fontSize="small" />
            </IconButton>
          )}
          {params.row.status === 'active' && (
            <IconButton size="small" color="warning" onClick={() => handleAction(params.row, 'block')}>
              <Block fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" color="default" onClick={() => handleAction(params.row, 'exclude')}>
            <RemoveCircle fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => handleAction(params.row, 'delete')}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  const auditColumns = [
    { field: 'userEmail', headerName: 'User', width: 241 },
    { field: 'action', headerName: 'Action', width: 300 },
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 200,
      renderCell: (params) => formatDateTime(params.value)
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" color="error" onClick={() => handleAction(params.row, 'delete-audit')}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Admin Management
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 280 }}
            InputProps={{
              startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Role</InputLabel>
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} label="Role">
              <MenuItem value="">All Roles</MenuItem>
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="blocked">Blocked</MenuItem>
              <MenuItem value="excluded">Excluded</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Users Table */}
      <Paper sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ p: 2 }}>
          Admins ({filteredUsers.length})
        </Typography>
        <Box sx={{ height: 400 }}>
          <DataGrid
            rows={filteredUsers}
            columns={userColumns}
            loading={usersLoading}
            pageSize={10}
            rowsPerPageOptions={[5, 10, 25]}
            disableSelectionOnClick
            getRowId={(row) => row.id || row._id}
          />
        </Box>
      </Paper>

      {/* Audit Logs */}
      <Paper>
        <Typography variant="h6" sx={{ p: 2 }}>
          Audit Logs
        </Typography>
        <Box sx={{ height: 350 }}>
          <DataGrid
            rows={auditLogs}
            columns={auditColumns}
            pageSize={5}
            rowsPerPageOptions={[5, 10]}
            disableSelectionOnClick
          />
        </Box>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, user: null, action: '' })}>
        <DialogTitle>Confirm {confirmDialog.action}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {confirmDialog.action === 'delete-audit' ? (
              <>
                Are you sure you want to delete this audit log entry?
                <br />
                <strong>Action:</strong> {confirmDialog.user?.action}
                <br />
                <strong>User:</strong> {confirmDialog.user?.userEmail}
                <br />
                <strong>Timestamp:</strong> {formatDateTime(confirmDialog.user?.timestamp)}
                <br />
                <br />
                This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to {confirmDialog.action} user "{confirmDialog.user?.email}"?
                {confirmDialog.action === 'delete' && ' This action cannot be undone.'}
              </>
            )}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, user: null, action: '' })}>Cancel</Button>
          <Button onClick={executeAction} variant="contained" color="warning">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UsersPage;
