import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  InputAdornment,
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
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridToolbarExport
} from '@mui/x-data-grid';
import {
  Search,
  PersonAdd,
  Check,
  Block,
  Delete,
  RemoveCircle,
  Visibility
} from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';
import { useToast } from '../../components/common/ToastProvider';
import userService from '../../services/userService';
import auditService from '../../services/auditService';

const UsersPage = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, user: null, action: '' });

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAllUsers
  });

  // Fetch audit logs
  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: auditService.getLogs
  });

  // User action mutations
  const approveUserMutation = useMutation({
    mutationFn: userService.approveUser,
    onSuccess: () => {
      showSuccess('User approved successfully');
      queryClient.invalidateQueries(['users']);
    },
    onError: () => showError('Failed to approve user')
  });

  const blockUserMutation = useMutation({
    mutationFn: userService.blockUser,
    onSuccess: () => {
      showSuccess('User blocked successfully');
      queryClient.invalidateQueries(['users']);
    },
    onError: () => showError('Failed to block user')
  });

  const excludeUserMutation = useMutation({
    mutationFn: userService.excludeUser,
    onSuccess: () => {
      showSuccess('User excluded successfully');
      queryClient.invalidateQueries(['users']);
    },
    onError: () => showError('Failed to exclude user')
  });

  const deleteUserMutation = useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      showSuccess('User deleted successfully');
      queryClient.invalidateQueries(['users']);
    },
    onError: () => showError('Failed to delete user')
  });

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAction = (user, action) => {
    setConfirmDialog({ open: true, user, action });
  };

  const executeAction = () => {
    const { user, action } = confirmDialog;
    
    switch (action) {
      case 'approve':
        approveUserMutation.mutate(user.id);
        break;
      case 'block':
        blockUserMutation.mutate(user.id);
        break;
      case 'exclude':
        excludeUserMutation.mutate(user.id);
        break;
      case 'delete':
        deleteUserMutation.mutate(user.id);
        break;
    }
    
    setConfirmDialog({ open: false, user: null, action: '' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'blocked': return 'error';
      case 'excluded': return 'default';
      default: return 'default';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner': return 'error';
      case 'admin': return 'warning';
      case 'user': return 'primary';
      default: return 'default';
    }
  };

  const userColumns = [
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
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
    {
      field: 'email',
      headerName: 'Email',
      width: 250,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getRoleColor(params.value)}
          size="small"
          variant="filled"
        />
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getStatusColor(params.value)}
          size="small"
          variant="outlined"
        />
      )
    },
    {
      field: 'createdAt',
      headerName: 'Created At',
      width: 180,
      renderCell: (params) => formatDateTime(params.value)
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {params.row.status === 'pending' && (
            <IconButton
              size="small"
              color="success"
              onClick={() => handleAction(params.row, 'approve')}
              title="Approve"
            >
              <Check fontSize="small" />
            </IconButton>
          )}
          {params.row.status === 'active' && (
            <IconButton
              size="small"
              color="warning"
              onClick={() => handleAction(params.row, 'block')}
              title="Block"
            >
              <Block fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            color="default"
            onClick={() => handleAction(params.row, 'exclude')}
            title="Exclude"
          >
            <RemoveCircle fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleAction(params.row, 'delete')}
            title="Delete"
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  const auditColumns = [
    {
      field: 'user',
      headerName: 'User',
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.row.userEmail || 'System'}
        </Typography>
      )
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 250,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 180,
      renderCell: (params) => formatDateTime(params.value)
    }
  ];

  const CustomToolbar = () => (
    <GridToolbarContainer>
      <GridToolbarFilterButton />
      <GridToolbarExport />
    </GridToolbarContainer>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          User Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage user accounts, roles, and permissions
        </Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              label="Role"
            >
              <MenuItem value="">All Roles</MenuItem>
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
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
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Users ({filteredUsers.length})
          </Typography>
        </Box>
        <Box sx={{ height: 400 }}>
          <DataGrid
            rows={filteredUsers}
            columns={userColumns}
            loading={usersLoading}
            pageSize={10}
            rowsPerPageOptions={[5, 10, 25, 50]}
            disableSelectionOnClick
            components={{
              Toolbar: CustomToolbar
            }}
            getRowId={(row) => row.id || row._id}
            sx={{
              border: 0,
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid',
                borderBottomColor: 'divider'
              }
            }}
          />
        </Box>
      </Paper>

      {/* Audit Log Viewer */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Audit Logs
          </Typography>
        </Box>
        <Box sx={{ height: 300 }}>
          <DataGrid
            rows={auditLogs}
            columns={auditColumns}
            loading={auditLoading}
            pageSize={10}
            rowsPerPageOptions={[5, 10, 25]}
            disableSelectionOnClick
            getRowId={(row) => row.id || row._id}
            sx={{
              border: 0,
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid',
                borderBottomColor: 'divider'
              }
            }}
          />
        </Box>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, user: null, action: '' })}>
        <DialogTitle>
          Confirm {confirmDialog.action}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to {confirmDialog.action} user "{confirmDialog.user?.email}"?
            {confirmDialog.action === 'delete' && ' This action cannot be undone.'}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, user: null, action: '' })}>
            Cancel
          </Button>
          <Button onClick={executeAction} variant="contained" color="warning">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UsersPage;