import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Slider,
  TextField,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  FormControlLabel,
  Checkbox,
  LinearProgress
} from '@mui/material';
import {
  Save,
  Security,
  Backup,
  Restore,
  Delete,
  Refresh,
  Visibility,
  Warning,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import systemService from '../../../services/systemService';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, formatBytes } from '../../../utils/formatters';
import useBackupProgress from '../../../hooks/useBackupProgress';

const GeneralSettingsTab = ({
  control,
  watch,
  isOwner,
  saveConfigMutation
}) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  
  // WebSocket-based backup/restore progress
  const { 
    backupProgress, 
    restoreProgress, 
    isBackupInProgress, 
    isRestoreInProgress 
  } = useBackupProgress();
  
  // Backup/Restore state
  const [createBackupDialogOpen, setCreateBackupDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [backupToDelete, setBackupToDelete] = useState(null);
  const [backupPreview, setBackupPreview] = useState(null);
  const [backupOptions, setBackupOptions] = useState({
    includeScreenshots: false,
    includeAuditLogs: true
  });
  const [restoreOptions, setRestoreOptions] = useState({
    createSafetyBackup: true,
    mode: 'overwrite' // 'overwrite' or 'merge'
  });

  // Fetch backups list
  const { data: backupsData, isLoading: backupsLoading, refetch: refetchBackups } = useQuery({
    queryKey: ['system-backups'],
    queryFn: () => systemService.listBackups(),
    enabled: isOwner
  });

  const backups = backupsData?.data?.backups || backupsData?.backups || [];

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: (options) => systemService.createBackup(options),
    onSuccess: (data) => {
      showSuccess(`Backup created: ${data?.data?.backupId || data?.backupId || 'Success'}`);
      setCreateBackupDialogOpen(false);
      queryClient.invalidateQueries(['system-backups']);
    },
    onError: (error) => {
      showError(`Failed to create backup: ${error.message || 'Unknown error'}`);
    }
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: (backupId) => systemService.deleteBackup(backupId),
    onSuccess: () => {
      showSuccess('Backup deleted successfully');
      queryClient.invalidateQueries(['system-backups']);
    },
    onError: (error) => {
      showError(`Failed to delete backup: ${error.message || 'Unknown error'}`);
    }
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: ({ backupId, options }) => systemService.restoreBackup(backupId, options),
    onSuccess: (data) => {
      const result = data?.data || data;
      if (result.dryRun) {
        showSuccess('Dry run completed - no changes made');
      } else {
        showSuccess(`System restored from backup. Safety backup: ${result.safetyBackupId || 'N/A'}`);
      }
      setRestoreDialogOpen(false);
      setSelectedBackup(null);
      queryClient.invalidateQueries(['system-backups']);
      // Refresh all configs after restore
      queryClient.invalidateQueries(['system-config']);
    },
    onError: (error) => {
      showError(`Failed to restore backup: ${error.message || 'Unknown error'}`);
    }
  });

  // Get restore preview mutation
  const getPreviewMutation = useMutation({
    mutationFn: (backupId) => systemService.getRestorePreview(backupId),
    onSuccess: (data) => {
      setBackupPreview(data?.data || data);
      setPreviewDialogOpen(true);
    },
    onError: (error) => {
      showError(`Failed to get backup preview: ${error.message || 'Unknown error'}`);
    }
  });

  const handleCreateBackup = () => {
    createBackupMutation.mutate(backupOptions);
  };

  const handleDeleteClick = (backup) => {
    setBackupToDelete(backup);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (backupToDelete) {
      deleteBackupMutation.mutate(backupToDelete.backupId);
    }
    setDeleteDialogOpen(false);
    setBackupToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setBackupToDelete(null);
  };

  const handleRestoreClick = (backup) => {
    setSelectedBackup(backup);
    setRestoreDialogOpen(true);
  };

  const handlePreviewClick = (backup) => {
    setSelectedBackup(backup);
    getPreviewMutation.mutate(backup.backupId);
  };

  const handleRestore = () => {
    if (!selectedBackup) return;
    restoreBackupMutation.mutate({
      backupId: selectedBackup.backupId,
      options: restoreOptions
    });
  };

  return (
    <Box>
      {/* System Parameters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
          System Parameters
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure general system timeouts and limits. These settings control agent behavior and are synced to the calling service.
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ maxWidth: 500 }}>
              <Typography variant="subtitle2" gutterBottom>
                Max Concurrent Calls: {watch('maxConcurrentCalls')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Maximum number of simultaneous calls the system can handle
              </Typography>
              <Controller
                name="maxConcurrentCalls"
                control={control}
                render={({ field }) => (
                  <Slider
                    {...field}
                    min={1}
                    max={50}
                    step={1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 10, label: '10' },
                      { value: 25, label: '25' },
                      { value: 50, label: '50' }
                    ]}
                    valueLabelDisplay="auto"
                    sx={{ mt: 2 }}
                  />
                )}
              />
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ maxWidth: 500 }}>
              <Typography variant="subtitle2" gutterBottom>
                Call Timeout: {watch('callTimeout')}s ({Math.floor(watch('callTimeout') / 60)}m {watch('callTimeout') % 60}s)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Maximum duration for a single call before automatic termination
              </Typography>
              <Controller
                name="callTimeout"
                control={control}
                render={({ field }) => (
                  <Slider
                    {...field}
                    min={60}
                    max={1800}
                    step={60}
                    marks={[
                      { value: 60, label: '1m' },
                      { value: 300, label: '5m' },
                      { value: 600, label: '10m' },
                      { value: 1800, label: '30m' }
                    ]}
                    valueLabelDisplay="auto"
                    sx={{ mt: 2 }}
                  />
                )}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Owner-Only Advanced Settings */}
      {isOwner && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Security color="error" />
            <Typography variant="h5" component="h2" fontWeight="bold" color="error">
              Owner-Only Advanced Configuration
            </Typography>
          </Box>
          <Alert severity="warning" sx={{ mb: 3 }}>
            These settings can affect system stability. Use with caution.
          </Alert>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="logLevel"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="System Log Level"
                    SelectProps={{ native: true }}
                    helperText="Controls verbosity of system logs. Debug mode may impact performance."
                  >
                    <option value="debug">Debug - Most verbose</option>
                    <option value="info">Info - Standard logging</option>
                    <option value="warn">Warning - Errors and warnings only</option>
                    <option value="error">Error - Errors only</option>
                  </TextField>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ maxWidth: 500 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Retry Attempts: {watch('retryAttempts')}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Number of retry attempts for failed API calls and operations
                </Typography>
                <Controller
                  name="retryAttempts"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={0}
                      max={10}
                      step={1}
                      marks
                      valueLabelDisplay="auto"
                      sx={{ mt: 2 }}
                    />
                  )}
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Backup & Restore - Owner Only */}
      {isOwner && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Backup color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Backup & Restore
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
                onClick={() => refetchBackups()}
                disabled={backupsLoading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<Backup />}
                onClick={() => setCreateBackupDialogOpen(true)}
                disabled={createBackupMutation.isPending || isBackupInProgress}
              >
                Create Backup
              </Button>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create system backups and restore from previous configurations. Backups include database configurations, prompts, and settings.
          </Typography>

          {/* Backup Progress Indicator */}
          {(isBackupInProgress || backupProgress) && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: backupProgress?.status === 'completed' ? 'success.50' : 
                         backupProgress?.status === 'failed' ? 'error.50' : 'action.hover',
                borderColor: backupProgress?.status === 'completed' ? 'success.main' : 
                             backupProgress?.status === 'failed' ? 'error.main' : 'primary.main'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                {backupProgress?.status === 'completed' ? (
                  <CheckCircle color="success" />
                ) : backupProgress?.status === 'failed' ? (
                  <ErrorIcon color="error" />
                ) : (
                  <CircularProgress size={20} />
                )}
                <Typography variant="subtitle2" fontWeight="medium">
                  {backupProgress?.status === 'completed' ? 'Backup Completed' :
                   backupProgress?.status === 'failed' ? 'Backup Failed' : 'Creating Backup...'}
                </Typography>
                {backupProgress?.progress !== undefined && backupProgress?.status !== 'completed' && backupProgress?.status !== 'failed' && (
                  <Typography variant="body2" color="text.secondary">
                    {backupProgress.progress}%
                  </Typography>
                )}
              </Box>
              {backupProgress?.status !== 'completed' && backupProgress?.status !== 'failed' && (
                <LinearProgress 
                  variant="determinate" 
                  value={backupProgress?.progress || 0} 
                  sx={{ mb: 1 }}
                />
              )}
              <Typography variant="body2" color="text.secondary">
                {backupProgress?.message || 'Initializing...'}
              </Typography>
              {backupProgress?.currentCollection && backupProgress?.status === 'in_progress' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Collection: {backupProgress.currentCollection} ({backupProgress.processedCollections}/{backupProgress.totalCollections})
                </Typography>
              )}
            </Paper>
          )}

          {/* Restore Progress Indicator */}
          {(isRestoreInProgress || restoreProgress) && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: restoreProgress?.status === 'completed' ? 'success.50' : 
                         restoreProgress?.status === 'completed_with_errors' ? 'warning.50' :
                         restoreProgress?.status === 'failed' ? 'error.50' : 'action.hover',
                borderColor: restoreProgress?.status === 'completed' ? 'success.main' : 
                             restoreProgress?.status === 'completed_with_errors' ? 'warning.main' :
                             restoreProgress?.status === 'failed' ? 'error.main' : 'warning.main'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                {restoreProgress?.status === 'completed' ? (
                  <CheckCircle color="success" />
                ) : restoreProgress?.status === 'completed_with_errors' ? (
                  <Warning color="warning" />
                ) : restoreProgress?.status === 'failed' ? (
                  <ErrorIcon color="error" />
                ) : (
                  <CircularProgress size={20} color="warning" />
                )}
                <Typography variant="subtitle2" fontWeight="medium">
                  {restoreProgress?.status === 'completed' ? 'Restore Completed' :
                   restoreProgress?.status === 'completed_with_errors' ? 'Restore Completed with Errors' :
                   restoreProgress?.status === 'failed' ? 'Restore Failed' : 'Restoring Backup...'}
                </Typography>
                {restoreProgress?.progress !== undefined && restoreProgress?.status !== 'completed' && restoreProgress?.status !== 'failed' && (
                  <Typography variant="body2" color="text.secondary">
                    {restoreProgress.progress}%
                  </Typography>
                )}
              </Box>
              {restoreProgress?.status !== 'completed' && restoreProgress?.status !== 'completed_with_errors' && restoreProgress?.status !== 'failed' && (
                <LinearProgress 
                  variant="determinate" 
                  value={restoreProgress?.progress || 0} 
                  color="warning"
                  sx={{ mb: 1 }}
                />
              )}
              <Typography variant="body2" color="text.secondary">
                {restoreProgress?.message || 'Initializing...'}
              </Typography>
              {restoreProgress?.currentCollection && restoreProgress?.status === 'in_progress' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Collection: {restoreProgress.currentCollection} ({restoreProgress.processedCollections}/{restoreProgress.totalCollections})
                </Typography>
              )}
            </Paper>
          )}

          {backupsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : backups.length === 0 ? (
            <Alert severity="info">
              No backups found. Create your first backup to protect your system configuration.
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Backup ID</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell><strong>Size</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.backupId} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                          {backup.backupId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateTime(backup.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatBytes(backup.size)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={backup.backupId?.includes('safety') ? 'Safety' : 'Manual'}
                          size="small"
                          color={backup.backupId?.includes('safety') ? 'warning' : 'primary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title="Preview backup contents">
                            <IconButton
                              size="small"
                              onClick={() => handlePreviewClick(backup)}
                              disabled={getPreviewMutation.isPending}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Restore from this backup">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => handleRestoreClick(backup)}
                              disabled={restoreBackupMutation.isPending || isRestoreInProgress}
                            >
                              <Restore fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete backup">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(backup)}
                              disabled={deleteBackupMutation.isPending}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          startIcon={<Save />}
          disabled={saveConfigMutation.isPending || saveConfigMutation.isLoading}
          sx={{ minWidth: 150 }}
        >
          {(saveConfigMutation.isPending || saveConfigMutation.isLoading) ? 'Saving...' : 'Save Configuration'}
        </Button>
      </Box>

      {/* Create Backup Dialog */}
      <Dialog
        open={createBackupDialogOpen}
        onClose={() => setCreateBackupDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Backup color="primary" />
            Create System Backup
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a backup of all system configurations, including AI settings, audio settings, telephony configuration, and prompts.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={backupOptions.includeAuditLogs}
                  onChange={(e) => setBackupOptions(prev => ({ ...prev, includeAuditLogs: e.target.checked }))}
                />
              }
              label="Include audit logs"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={backupOptions.includeScreenshots}
                  onChange={(e) => setBackupOptions(prev => ({ ...prev, includeScreenshots: e.target.checked }))}
                />
              }
              label="Include screenshots (may increase backup size)"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setCreateBackupDialogOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleCreateBackup}
            variant="contained"
            startIcon={createBackupMutation.isPending ? <CircularProgress size={16} /> : <Backup />}
            disabled={createBackupMutation.isPending}
          >
            {createBackupMutation.isPending ? 'Creating...' : 'Create Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog
        open={restoreDialogOpen}
        onClose={() => setRestoreDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="warning" />
            Restore System Backup
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Restoring a backup will overwrite current configurations. A safety backup will be created automatically before restoration. This will replace current configurations and can change how the agent and telephony behave.
          </Alert>
          {selectedBackup && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Selected Backup:</Typography>
              <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                {selectedBackup.backupId}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Created: {formatDateTime(selectedBackup.createdAt)}
              </Typography>
            </Box>
          )}
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={restoreOptions.createSafetyBackup}
                  onChange={(e) => setRestoreOptions(prev => ({ ...prev, createSafetyBackup: e.target.checked }))}
                />
              }
              label="Create safety backup before restore (recommended)"
            />
          </Box>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Restore Mode:</Typography>
            <Controller
              name="restoreMode"
              control={control}
              defaultValue="overwrite"
              render={() => (
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={restoreOptions.mode}
                  onChange={(e) => setRestoreOptions(prev => ({ ...prev, mode: e.target.value }))}
                  SelectProps={{ native: true }}
                  helperText={
                    restoreOptions.mode === 'overwrite' 
                      ? 'Overwrite mode: Clears collections and inserts all documents from backup'
                      : 'Merge mode: Updates existing documents, adds new ones, keeps documents not in backup'
                  }
                >
                  <option value="overwrite">Overwrite (Replace All)</option>
                  <option value="merge">Merge (Upsert)</option>
                </TextField>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setRestoreDialogOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleRestore}
            variant="contained"
            color="warning"
            startIcon={restoreBackupMutation.isPending ? <CircularProgress size={16} /> : <Restore />}
            disabled={restoreBackupMutation.isPending}
          >
            {restoreBackupMutation.isPending ? 'Restoring...' : 'Restore Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backup Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Visibility color="primary" />
            Backup Preview - Restore Comparison
          </Box>
        </DialogTitle>
        <DialogContent>
          {backupPreview && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>Backup ID:</Typography>
                  <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                    {backupPreview.backupId}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>Backup Date:</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {backupPreview.backupTimestamp ? formatDateTime(backupPreview.backupTimestamp) : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
              
              {backupPreview.backupVersion && (
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={`Format v${backupPreview.backupVersion}`}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                </Box>
              )}

              {/* Collection-level diff table */}
              {backupPreview.collections && Object.keys(backupPreview.collections).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Collections Comparison:</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Collection</strong></TableCell>
                          <TableCell align="center"><strong>Current</strong></TableCell>
                          <TableCell align="center"><strong>In Backup</strong></TableCell>
                          <TableCell align="center"><strong>To Add</strong></TableCell>
                          <TableCell align="center"><strong>To Update</strong></TableCell>
                          <TableCell align="center"><strong>To Remove</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(backupPreview.collections).map(([key, info]) => (
                          <TableRow key={key} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {info.displayName || key}
                              </Typography>
                              {info.isSingleton && (
                                <Chip label="Singleton" size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">{info.current?.count ?? '-'}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">{info.backup?.count ?? '-'}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" color={info.diff?.toAdd > 0 ? 'success.main' : 'text.secondary'}>
                                {info.diff?.toAdd > 0 ? `+${info.diff.toAdd}` : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" color={info.diff?.toUpdate > 0 ? 'warning.main' : 'text.secondary'}>
                                {info.diff?.toUpdate > 0 ? info.diff.toUpdate : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" color={info.diff?.toRemove > 0 ? 'error.main' : 'text.secondary'}>
                                {info.diff?.toRemove > 0 ? `-${info.diff.toRemove}` : '-'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Note: "To Remove" shows documents in current DB that are not in the backup. In overwrite mode, these will be deleted.
                  </Typography>
                </Box>
              )}

              {/* Legacy format support */}
              {Array.isArray(backupPreview.collections) && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Collections to Restore:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {backupPreview.collections.map((col, idx) => (
                      <Chip key={idx} label={col} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              {backupPreview.configs && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Configurations Included:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {Object.keys(backupPreview.configs).map((key) => (
                      <Chip key={key} label={key} size="small" variant="outlined" color="primary" />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPreviewDialogOpen(false)} variant="outlined">
            Close
          </Button>
          <Button
            onClick={() => {
              setPreviewDialogOpen(false);
              if (selectedBackup) {
                handleRestoreClick(selectedBackup);
              }
            }}
            variant="contained"
            color="warning"
            startIcon={<Restore />}
          >
            Restore This Backup
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Backup Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Delete color="error" />
            Delete Backup
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this backup? This action cannot be undone.
          </Typography>
          {backupToDelete && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'action.hover', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                {backupToDelete.backupId}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Created: {formatDateTime(backupToDelete.createdAt)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCancelDelete} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            startIcon={deleteBackupMutation.isPending ? <CircularProgress size={16} /> : <Delete />}
            disabled={deleteBackupMutation.isPending}
          >
            {deleteBackupMutation.isPending ? 'Deleting...' : 'Delete Backup'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GeneralSettingsTab;
