import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
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
  Alert,
  InputAdornment,
  Tabs,
  Tab
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  PersonAdd as PersonAddIcon,
  Visibility,
  VisibilityOff,
  People as PeopleIcon,
  List as ListIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useToast } from '../../components/common/ToastProvider';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import AllowlistManager from './components/AllowlistManager';
import AuditLogViewer from './components/AuditLogViewer';

const UsersPage = () => {
  const { showSuccess, showError } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState(0);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, user: null, action: '' });
  const [addUserDialog, setAddUserDialog] = useState({ open: false });
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    role: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAllUsers()
  });

  const users = usersResponse?.success && usersResponse?.data 
    ? (Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data.users || [])
    : [];

  // Filter out deleted users from the list
  const activeUsers = users.filter(user => user.status !== 'deleted');

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

  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await userService.createUser(userData);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create user');
      }
      return response;
    },
    onSuccess: () => {
      showSuccess('User created successfully');
      queryClient.invalidateQueries(['users']);
      setAddUserDialog({ open: false });
      setFormData({ email: '', username: '', password: '', role: '' });
      setFormErrors({});
      setShowPassword(false);
    },
    onError: (error) => {
      showError(error.message || 'Failed to create user');
    }
  });

  const filteredUsers = activeUsers.filter(user => {
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesRole && matchesStatus;
  });

  // Check if user is the currently logged-in user
  const isCurrentUser = (user) => {
    const userId = user.id || user._id;
    const currentUserId = currentUser?.id || currentUser?._id;
    return userId && currentUserId && userId.toString() === currentUserId.toString();
  };

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

  const validateForm = () => {
    const errors = {};
    
    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      errors.email = 'Invalid email address';
    }
    
    // Username validation
    if (!formData.username) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    
    // Role validation
    if (!formData.role) {
      errors.role = 'Role is required';
    } else if (!['owner', 'admin'].includes(formData.role)) {
      errors.role = 'Role must be either owner or admin';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddUser = () => {
    if (validateForm()) {
      createUserMutation.mutate({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        role: formData.role
      });
    }
  };

  const handleCloseAddUserDialog = () => {
    setAddUserDialog({ open: false });
    setFormData({ email: '', username: '', password: '', role: '' });
    setFormErrors({});
    setShowPassword(false);
  };

  const handleFormChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: '' });
    }
  };

  if (usersLoading) {
    return (
      <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
        <Typography 
          variant="h4" 
          component="h1"
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '1.75rem', md: '2rem' },
            color: 'text.primary',
            mb: 1
          }}
        >
          User Management
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.9375rem'
          }}
        >
          Manage system users, roles, permissions, allowlist, and audit logs
        </Typography>
          </Box>
          {currentUser?.role === 'owner' && activeTab === 0 && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setAddUserDialog({ open: true })}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Add User
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Paper elevation={0} sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<PeopleIcon />} iconPosition="start" label="Users" />
          <Tab icon={<ListIcon />} iconPosition="start" label="Allowlist" />
          <Tab icon={<HistoryIcon />} iconPosition="start" label="Audit Logs" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
      {/* Filters */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 3, 
          mb: 3,
          borderRadius: 2
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            gap: 2,
            flexWrap: 'wrap'
          }}
        >
          <TextField
            select
            label="Filter by Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Roles</MenuItem>
            <MenuItem value="owner">Owner</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <TextField
            select
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </Box>
      </Paper>

      {/* Users Table */}
      <TableContainer 
        component={Paper} 
        elevation={0}
        sx={{ borderRadius: 2 }}
      >
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
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Alert 
                    severity="info"
                    sx={{ 
                      maxWidth: 400,
                      margin: '0 auto',
                      borderRadius: 2
                    }}
                  >
                    No users found matching the selected filters
                  </Alert>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow 
                  key={user.id || user._id}
                  sx={{
                    '&:last-child td': { border: 0 }
                  }}
                >
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.875rem'
                      }}
                    >
                      {user.name || user.username || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2"
                      sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.875rem'
                      }}
                    >
                      {user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.role || 'user'}
                      color={user.role === 'owner' ? 'error' : user.role === 'admin' ? 'warning' : 'default'}
                      size="small"
                      sx={{ 
                        textTransform: 'capitalize',
                        fontWeight: 500
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.status || 'active'}
                      color={user.status === 'active' ? 'success' : 'default'}
                      size="small"
                      sx={{ 
                        textTransform: 'capitalize',
                        fontWeight: 500
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2"
                      sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.875rem'
                      }}
                    >
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      {user.status === 'active' ? (
                        <IconButton
                          size="small"
                          onClick={() => handleAction(user, 'deactivate')}
                          color="warning"
                          disabled={isCurrentUser(user)}
                          sx={{
                            '&:hover': {
                              backgroundColor: 'warning.lighter'
                            }
                          }}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleAction(user, 'activate')}
                          color="success"
                          disabled={isCurrentUser(user)}
                          sx={{
                            '&:hover': {
                              backgroundColor: 'success.lighter'
                            }
                          }}
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleAction(user, 'delete')}
                        color="error"
                        disabled={isCurrentUser(user)}
                        sx={{
                          '&:hover': {
                            backgroundColor: 'error.lighter'
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, user: null, action: '' })}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Confirm Action
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary' }}>
            Are you sure you want to <strong>{confirmDialog.action}</strong> user{' '}
            <strong>{confirmDialog.user?.email || confirmDialog.user?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setConfirmDialog({ open: false, user: null, action: '' })}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            color="error" 
            variant="contained"
            autoFocus
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog
        open={addUserDialog.open}
        onClose={handleCloseAddUserDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Add New User
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={handleFormChange('email')}
              error={!!formErrors.email}
              helperText={formErrors.email}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Username"
              value={formData.username}
              onChange={handleFormChange('username')}
              error={!!formErrors.username}
              helperText={formErrors.username}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleFormChange('password')}
              error={!!formErrors.password}
              helperText={formErrors.password}
              required
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <TextField
              select
              fullWidth
              label="Role"
              value={formData.role}
              onChange={handleFormChange('role')}
              error={!!formErrors.role}
              helperText={formErrors.role}
              required
              margin="normal"
            >
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={handleCloseAddUserDialog}
            variant="outlined"
            disabled={createUserMutation.isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddUser} 
            variant="contained"
            disabled={createUserMutation.isLoading}
            startIcon={createUserMutation.isLoading ? <CircularProgress size={20} /> : <PersonAddIcon />}
          >
            {createUserMutation.isLoading ? 'Creating...' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}

      {activeTab === 1 && (
        <AllowlistManager />
      )}

      {activeTab === 2 && (
        <AuditLogViewer />
      )}
    </Box>
  );
};

export default UsersPage;

