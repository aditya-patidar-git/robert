import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
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
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Domain as DomainIcon
} from '@mui/icons-material';
import { useToast } from '../../../components/common/ToastProvider';
import allowlistService from '../../../services/allowlistService';

const AllowlistManager = forwardRef((props, ref) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialog, setAddDialog] = useState({ open: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, entry: null });
  const [formData, setFormData] = useState({
    type: 'email',
    value: '',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const { data: allowlistData, isLoading } = useQuery({
    queryKey: ['allowlist', typeFilter, searchQuery],
    queryFn: () => allowlistService.getAllowlist({
      type: typeFilter || undefined,
      search: searchQuery || undefined,
      page: 1,
      limit: 100
    })
  });

  // Access data from normalized response structure
  const allowlist = allowlistData?.data?.allowlist || allowlistData?.allowlist || [];
  const pagination = allowlistData?.data?.pagination || allowlistData?.pagination || {};

  const addMutation = useMutation({
    mutationFn: (data) => allowlistService.addToAllowlist(data),
    onSuccess: () => {
      showSuccess('Entry added to allowlist');
      queryClient.invalidateQueries(['allowlist']);
      setAddDialog({ open: false });
      setFormData({ type: 'email', value: '', notes: '' });
      setFormErrors({});
    },
    onError: (error) => {
      showError(error.response?.data?.message || 'Failed to add entry');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId) => allowlistService.removeFromAllowlist(entryId),
    onSuccess: () => {
      showSuccess('Entry removed from allowlist');
      queryClient.invalidateQueries(['allowlist']);
      setDeleteDialog({ open: false, entry: null });
    },
    onError: (error) => {
      showError(error.response?.data?.message || 'Failed to remove entry');
    }
  });

  const validateForm = () => {
    const errors = {};
    
    if (!formData.value) {
      errors.value = 'Value is required';
    } else if (formData.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.value)) {
        errors.value = 'Invalid email format';
      }
    } else if (formData.type === 'domain') {
      const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
      if (!domainRegex.test(formData.value)) {
        errors.value = 'Invalid domain format';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = () => {
    if (validateForm()) {
      addMutation.mutate(formData);
    }
  };

  const handleDelete = (entry) => {
    setDeleteDialog({ open: true, entry });
  };

  const handleConfirmDelete = () => {
    if (deleteDialog.entry) {
      deleteMutation.mutate(deleteDialog.entry._id || deleteDialog.entry.id);
    }
  };

  useImperativeHandle(ref, () => ({
    openAddDialog: () => {
      setAddDialog({ open: true });
    }
  }));

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Filter by Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="email">Email</MenuItem>
            <MenuItem value="domain">Domain</MenuItem>
          </TextField>
          <TextField
            label="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
            placeholder="Search by value..."
          />
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allowlist.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Alert severity="info" sx={{ maxWidth: 400, margin: '0 auto' }}>
                    No allowlist entries found
                  </Alert>
                </TableCell>
              </TableRow>
            ) : (
              allowlist.map((entry) => (
                <TableRow key={entry._id || entry.id}>
                  <TableCell>
                    <Chip
                      icon={entry.type === 'email' ? <EmailIcon /> : <DomainIcon />}
                      label={entry.type}
                      size="small"
                      color={entry.type === 'email' ? 'primary' : 'secondary'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {entry.value}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {entry.notes || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {entry.createdBy?.email || entry.createdBy?.username || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Remove from allowlist">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(entry)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Dialog */}
      <Dialog
        open={addDialog.open}
        onClose={() => {
          setAddDialog({ open: false });
          setFormData({ type: 'email', value: '', notes: '' });
          setFormErrors({});
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add to Allowlist</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              select
              fullWidth
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            >
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="domain">Domain</MenuItem>
            </TextField>
            <TextField
              fullWidth
              label={formData.type === 'email' ? 'Email Address' : 'Domain'}
              value={formData.value}
              onChange={(e) => {
                setFormData({ ...formData, value: e.target.value });
                if (formErrors.value) setFormErrors({ ...formErrors, value: '' });
              }}
              error={!!formErrors.value}
              helperText={formErrors.value}
              required
              placeholder={formData.type === 'email' ? 'user@example.com' : 'example.com'}
            />
            <TextField
              fullWidth
              label="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddDialog({ open: false });
              setFormData({ type: 'email', value: '', notes: '' });
              setFormErrors({});
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            variant="contained"
            disabled={addMutation.isLoading}
            startIcon={addMutation.isLoading ? <CircularProgress size={20} /> : <AddIcon />}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, entry: null })}
      >
        <DialogTitle>Remove from Allowlist</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove <strong>{deleteDialog.entry?.value}</strong> from the allowlist?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, entry: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isLoading}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

AllowlistManager.displayName = 'AllowlistManager';

export default AllowlistManager;

