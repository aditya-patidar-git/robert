import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Divider,
  Grid
} from '@mui/material';
import {
  Save,
  GetApp,
  Delete,
  Warning,
  Security,
  Storage,
  Policy
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { formatDateTime } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import privacyService from '../../services/privacyService';
import configService from '../../services/configService';

const PrivacyPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState({ open: false, userId: null });
  
  const canSeeAll = user?.role === 'owner' || user?.role === 'admin';

  const { control, handleSubmit, watch } = useForm({
    defaultValues: {
      consentScript: '',
      transcriptRetention: 90,
      recordingRetention: 30
    }
  });

  // Fetch privacy configuration
  const { data: privacyConfig, isLoading: configLoading } = useQuery({
    queryKey: ['privacy-config'],
    queryFn: configService.getPrivacyConfig,
    onSuccess: (data) => {
      if (data) {
        Object.keys(data).forEach(key => {
          if (key in control._defaultValues) {
            control._formValues[key] = data[key];
          }
        });
      }
    }
  });

  // Fetch DSAR requests
  const { data: dsarRequests = [], isLoading: dsarLoading } = useQuery({
    queryKey: ['dsar-requests'],
    queryFn: privacyService.getAllDSARRequests
  });

  // Save privacy configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: configService.updatePrivacyConfig,
    onSuccess: () => {
      showSuccess('Privacy configuration saved successfully');
      queryClient.invalidateQueries(['privacy-config']);
    },
    onError: () => showError('Failed to save privacy configuration')
  });

  // Export user data mutation
  const exportDataMutation = useMutation({
    mutationFn: (userId) => {
      if (canSeeAll && userId) {
        return privacyService.exportUserData(userId);
      } else {
        return privacyService.exportUserData(user?.id);
      }
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user_data_export.zip';
      a.click();
      showSuccess('Data export completed successfully');
    },
    onError: () => showError('Failed to export user data')
  });

  // Delete user data mutation
  const deleteDataMutation = useMutation({
    mutationFn: privacyService.deleteUserData,
    onSuccess: () => {
      showSuccess('User data deleted successfully');
      setDeleteDialog({ open: false, userId: null });
      queryClient.invalidateQueries(['dsar-requests']);
    },
    onError: () => showError('Failed to delete user data')
  });

  // Create DSAR request mutation
  const createDSARMutation = useMutation({
    mutationFn: privacyService.createDSARRequest,
    onSuccess: () => {
      showSuccess('DSAR request created successfully');
      queryClient.invalidateQueries(['dsar-requests']);
    },
    onError: () => showError('Failed to create DSAR request')
  });

  const onSubmit = (data) => {
    saveConfigMutation.mutate(data);
  };

  const handleExportData = (userId = null) => {
    exportDataMutation.mutate(userId);
  };

  const handleDeleteConfirm = () => {
    if (deleteDialog.userId) {
      deleteDataMutation.mutate(deleteDialog.userId);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // Mock DSAR requests for demonstration
  const mockDSARRequests = [
    {
      id: 'dsar_001',
      requestor: 'user@example.com',
      type: 'export',
      date: new Date().toISOString(),
      status: 'completed'
    },
    {
      id: 'dsar_002',
      requestor: 'customer@company.com',
      type: 'delete',
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'pending'
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Privacy & Compliance
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {canSeeAll ? 
            'Manage GDPR compliance, data retention, and privacy policies' :
            'Manage your personal data and privacy settings'
          }
        </Typography>
      </Box>

      {canSeeAll ? (
        /* Admin/Owner View */
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Consent Script Editor */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Policy color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Consent Script Editor
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure the consent script displayed to users during data collection
            </Typography>

            <Controller
              name="consentScript"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  multiline
                  rows={6}
                  fullWidth
                  placeholder="Enter the consent script that users will see..."
                  sx={{ mb: 2 }}
                />
              )}
            />
            
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              disabled={saveConfigMutation.isLoading}
            >
              Save Consent Script
            </Button>
          </Paper>

          {/* Retention Controls */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Storage color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Data Retention Controls
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure automatic data retention periods for transcripts and recordings
            </Typography>

            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Transcript Retention: {watch('transcriptRetention')} days
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  How long to keep call transcripts before automatic deletion
                </Typography>
                <Controller
                  name="transcriptRetention"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={7}
                      max={365}
                      step={7}
                      marks={[
                        { value: 7, label: '7d' },
                        { value: 30, label: '30d' },
                        { value: 90, label: '90d' },
                        { value: 180, label: '180d' },
                        { value: 365, label: '1yr' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Recording Retention: {watch('recordingRetention')} days
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  How long to keep call recordings before automatic deletion
                </Typography>
                <Controller
                  name="recordingRetention"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={7}
                      max={180}
                      step={7}
                      marks={[
                        { value: 7, label: '7d' },
                        { value: 30, label: '30d' },
                        { value: 90, label: '90d' },
                        { value: 180, label: '180d' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* DSAR Panel */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Security color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                DSAR Management Panel
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Data Subject Access Request (DSAR) management for GDPR compliance
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={() => handleExportData()}
                disabled={exportDataMutation.isLoading}
              >
                Export All User Data
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => setDeleteDialog({ open: true, userId: 'all' })}
              >
                Bulk Data Deletion
              </Button>
            </Box>

            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Data Processing Notice</Typography>
              All DSAR operations are logged for compliance audit trails. 
              Deletions are permanent and cannot be undone.
            </Alert>
          </Paper>

          {/* DSAR Logs */}
          <Paper>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                DSAR Request Logs ({mockDSARRequests.length})
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Requestor</TableCell>
                    <TableCell>Request Type</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockDSARRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.requestor}</TableCell>
                      <TableCell>
                        <Chip
                          label={request.type}
                          color={request.type === 'export' ? 'info' : 'error'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDateTime(request.date)}</TableCell>
                      <TableCell>
                        <Chip
                          label={request.status}
                          color={getStatusColor(request.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {request.type === 'export' && request.status === 'completed' && (
                          <Button size="small" startIcon={<GetApp />}>
                            Download
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </form>
      ) : (
        /* User View */
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Security color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Your Data Rights
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Under GDPR and data protection regulations, you have the right to access, 
              export, and request deletion of your personal data.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={() => handleExportData()}
                disabled={exportDataMutation.isLoading}
              >
                {exportDataMutation.isLoading ? 'Exporting...' : 'Export My Data'}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => setDeleteDialog({ open: true, userId: user?.id })}
              >
                Request Data Deletion
              </Button>
            </Box>

            <Alert severity="info">
              <Typography variant="subtitle2">Data Export Information</Typography>
              Your data export will include all call transcripts, recordings, and 
              personal information associated with your account. The export will be 
              provided as a downloadable ZIP file.
            </Alert>
          </Paper>

          {/* User's DSAR History */}
          <Paper>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Your Data Requests
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Request Type</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockDSARRequests
                    .filter(req => req.requestor === user?.email)
                    .map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Chip
                          label={request.type}
                          color={request.type === 'export' ? 'info' : 'error'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDateTime(request.date)}</TableCell>
                      <TableCell>
                        <Chip
                          label={request.status}
                          color={getStatusColor(request.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {request.type === 'export' && request.status === 'completed' && (
                          <Button size="small" startIcon={<GetApp />}>
                            Download
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, userId: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          Confirm Data Deletion
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This action cannot be undone. All user data including transcripts, 
            recordings, and personal information will be permanently deleted.
          </Alert>
          <Typography>
            Are you sure you want to proceed with data deletion?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, userId: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteDataMutation.isLoading}
          >
            {deleteDataMutation.isLoading ? 'Deleting...' : 'Delete Data'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PrivacyPage;