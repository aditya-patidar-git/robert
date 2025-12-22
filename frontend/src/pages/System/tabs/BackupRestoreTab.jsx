import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
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
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  LinearProgress
} from '@mui/material';
import {
  Backup,
  Restore,
  Delete,
  Download,
  Upload,
  MoreVert,
  Info,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import systemService from '../../../services/systemService';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, formatFileSize } from '../../../utils/formatters';

const BackupRestoreTab = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [restoreOptions, setRestoreOptions] = useState({
    createSafetyBackup: true,
    collections: null,
    dryRun: false
  });
  const [backupOptions, setBackupOptions] = useState({
    includeScreenshots: false,
    includeAuditLogs: true
  });
  const [previewData, setPreviewData] = useState(null);

  // Fetch backups
  const { data: backupsData, isLoading: backupsLoading, refetch: refetchBackups } = useQuery({
    queryKey: ['system-backups'],
    queryFn: async () => {
      const response = await systemService.listBackups();
      return response.backups || [];
    }
  });

  const backups = backupsData || [];

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: (options) => systemService.createBackup(options),
    onSuccess: (data) => {
      showSuccess('Backup created successfully');
      queryClient.invalidateQueries(['system-backups']);
      setCreateDialogOpen(false);
      setBackupOptions({ includeScreenshots: false, includeAuditLogs: true });
    },
    onError: (error) => {
      showError(error.message || 'Failed to create backup');
    }
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: ({ backupId, options }) => systemService.restoreBackup(backupId, options),
    onSuccess: (data) => {
      if (data.dryRun) {
        showSuccess('Dry run completed successfully');
      } else {
        showSuccess(`Backup restored successfully${data.safetyBackupId ? `. Safety backup: ${data.safetyBackupId}` : ''}`);
      }
      queryClient.invalidateQueries(['system-backups']);
      setRestoreDialogOpen(false);
      setSelectedBackup(null);
    },
    onError: (error) => {
      showError(error.message || 'Failed to restore backup');
    }
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: (backupId) => systemService.deleteBackup(backupId),
    onSuccess: () => {
      showSuccess('Backup deleted successfully');
      queryClient.invalidateQueries(['system-backups']);
      setDeleteDialogOpen(false);
      setSelectedBackup(null);
    },
    onError: (error) => {
      showError(error.message || 'Failed to delete backup');
    }
  });

  // Get restore preview
  const fetchPreview = async () => {
    if (!selectedBackup) return null;
    try {
      const response = await systemService.getRestorePreview(selectedBackup.backupId);
      setPreviewData(response);
      return response;
    } catch (error) {
      showError(error.message || 'Failed to fetch preview');
      return null;
    }
  };

  // Handle create backup
  const handleCreateBackup = () => {
    createBackupMutation.mutate(backupOptions);
  };

  // Handle restore backup
  const handleRestoreBackup = () => {
    if (!selectedBackup) return;
    restoreBackupMutation.mutate({
      backupId: selectedBackup.backupId,
      options: restoreOptions
    });
  };

  // Handle delete backup
  const handleDeleteBackup = () => {
    if (!selectedBackup) return;
    deleteBackupMutation.mutate(selectedBackup.backupId);
  };

  // Handle download backup
  const handleDownloadBackup = async (backup) => {
    try {
      // In a real implementation, this would download the file
      // For now, show a message
      showSuccess(`Backup file: ${backup.fileName}`);
    } catch (error) {
      showError('Failed to download backup');
    }
  };

  // Handle preview restore
  const handlePreviewRestore = async (backup) => {
    setSelectedBackup(backup);
    setPreviewDialogOpen(true);
    await fetchPreview();
  };

  // Handle menu open
  const handleMenuOpen = (event, backup) => {
    setMenuAnchor(event.currentTarget);
    setSelectedBackup(backup);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              System Backup & Restore
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create, manage, and restore system backups. Backups include MongoDB data, configurations, and optional audit logs.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Backup />}
            onClick={() => setCreateDialogOpen(true)}
            disabled={createBackupMutation.isLoading}
          >
            Create Backup
          </Button>
        </Box>

        {backupsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : backups.length === 0 ? (
          <Alert severity="info">
            No backups found. Create your first backup to get started.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Backup ID</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Collections</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.backupId}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {backup.backupId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {formatDateTime(backup.createdAt || backup.metadata?.timestamp)}
                    </TableCell>
                    <TableCell>
                      {formatFileSize(backup.size || backup.metadata?.size || 0)}
                    </TableCell>
                    <TableCell>
                      {backup.metadata?.collections === 'all' || !backup.metadata?.collections
                        ? 'All'
                        : Array.isArray(backup.metadata?.collections)
                        ? backup.metadata.collections.length
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label="Available"
                        color="success"
                        size="small"
                        icon={<CheckCircle />}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, backup)}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create Backup Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create System Backup</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info">
              This will create a backup of all MongoDB collections, configurations, and optionally audit logs.
            </Alert>
            <FormControlLabel
              control={
                <Checkbox
                  checked={backupOptions.includeAuditLogs}
                  onChange={(e) => setBackupOptions({ ...backupOptions, includeAuditLogs: e.target.checked })}
                />
              }
              label="Include Audit Logs"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={backupOptions.includeScreenshots}
                  onChange={(e) => setBackupOptions({ ...backupOptions, includeScreenshots: e.target.checked })}
                />
              }
              label="Include Screenshots (may be large)"
            />
            {createBackupMutation.isLoading && (
              <Box>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Creating backup... This may take a few minutes.
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={createBackupMutation.isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateBackup}
            variant="contained"
            disabled={createBackupMutation.isLoading}
            startIcon={<Backup />}
          >
            {createBackupMutation.isLoading ? 'Creating...' : 'Create Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Restore System Backup</DialogTitle>
        <DialogContent>
          {selectedBackup && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Alert severity="warning">
                This will restore the system from backup: <strong>{selectedBackup.backupId}</strong>. 
                This action cannot be undone.
              </Alert>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={restoreOptions.createSafetyBackup}
                    onChange={(e) => setRestoreOptions({ ...restoreOptions, createSafetyBackup: e.target.checked })}
                  />
                }
                label="Create Safety Backup Before Restore (Recommended)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={restoreOptions.dryRun}
                    onChange={(e) => setRestoreOptions({ ...restoreOptions, dryRun: e.target.checked })}
                  />
                }
                label="Dry Run (Preview Only)"
              />
              {restoreBackupMutation.isLoading && (
                <Box>
                  <LinearProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Restoring backup... This may take several minutes.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} disabled={restoreBackupMutation.isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleRestoreBackup}
            variant="contained"
            color="warning"
            disabled={restoreBackupMutation.isLoading || !selectedBackup}
            startIcon={<Restore />}
          >
            {restoreBackupMutation.isLoading ? 'Restoring...' : restoreOptions.dryRun ? 'Preview Restore' : 'Restore Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Backup</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete backup <strong>{selectedBackup?.backupId}</strong>? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteBackup}
            variant="contained"
            color="error"
            disabled={deleteBackupMutation.isLoading}
          >
            {deleteBackupMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Preview Dialog */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Restore Preview</DialogTitle>
        <DialogContent>
          {!previewData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : previewData ? (
            <Box>
              {previewData.canRestore ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Backup is valid and can be restored
                  </Alert>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="subtitle2">Backup ID</Typography>
                      <Typography variant="body2">{previewData.backupId}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Size</Typography>
                      <Typography variant="body2">{formatFileSize(previewData.size || 0)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Created</Typography>
                      <Typography variant="body2">{formatDateTime(previewData.createdAt)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Collections</Typography>
                      <Typography variant="body2">
                        {previewData.collections?.length || 0} collections
                      </Typography>
                    </Box>
                  </Box>
                  {previewData.collections && previewData.collections.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Collections to Restore:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {previewData.collections.map((col, idx) => (
                          <Chip key={idx} label={col} size="small" />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Alert severity="error">{previewData.error || 'Cannot restore backup'}</Alert>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          {previewData?.canRestore && (
            <Button
              onClick={() => {
                setPreviewDialogOpen(false);
                setRestoreDialogOpen(true);
              }}
              variant="contained"
              startIcon={<Restore />}
            >
              Proceed with Restore
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            handlePreviewRestore(selectedBackup);
          }}
        >
          <Info sx={{ mr: 1 }} fontSize="small" />
          Preview Restore
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            setSelectedBackup(selectedBackup);
            setRestoreDialogOpen(true);
          }}
        >
          <Restore sx={{ mr: 1 }} fontSize="small" />
          Restore
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            handleDownloadBackup(selectedBackup);
          }}
        >
          <Download sx={{ mr: 1 }} fontSize="small" />
          Download
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            setDeleteDialogOpen(true);
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default BackupRestoreTab;

