import React, { useState, useEffect } from 'react';
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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  Menu,
  MenuItem,
  Link
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Link as LinkIcon,
  CheckCircle,
  Cancel,
  MoreVert,
  Sync,
  Download,
  Upload,
  PlayArrow
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import kbMappingService from '../../../services/kbMappingService';
import kbService from '../../../services/kbService';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime } from '../../../utils/formatters';

const DriftDetectionMapping = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuMapping, setMenuMapping] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    fileId: '',
    url: '',
    selector: ''
  });

  // Fetch mappings
  const { data: mappingsData, isLoading: mappingsLoading, refetch: refetchMappings } = useQuery({
    queryKey: ['kb-mappings'],
    queryFn: async () => {
      const response = await kbMappingService.getAllMappings();
      return response.mappings || [];
    }
  });

  // Fetch KB files for dropdown
  const { data: kbFilesData } = useQuery({
    queryKey: ['kb-files'],
    queryFn: async () => {
      const response = await kbService.getAllFiles();
      return response.files || [];
    }
  });

  const mappings = mappingsData || [];
  const kbFiles = kbFilesData || [];

  // Save mapping mutation
  const saveMappingMutation = useMutation({
    mutationFn: (data) => kbMappingService.saveMapping(data),
    onSuccess: () => {
      showSuccess('Mapping saved successfully');
      queryClient.invalidateQueries(['kb-mappings']);
      setEditDialogOpen(false);
      setFormData({ fileId: '', url: '', selector: '' });
    },
    onError: (error) => {
      showError(error.message || 'Failed to save mapping');
    }
  });

  // Delete mapping mutation
  const deleteMappingMutation = useMutation({
    mutationFn: (fileId) => kbMappingService.deleteMapping(fileId),
    onSuccess: () => {
      showSuccess('Mapping deleted successfully');
      queryClient.invalidateQueries(['kb-mappings']);
      setDeleteDialogOpen(false);
      setSelectedMapping(null);
    },
    onError: (error) => {
      showError(error.message || 'Failed to delete mapping');
    }
  });

  // Test mapping mutation
  const testMappingMutation = useMutation({
    mutationFn: (fileId) => kbMappingService.testMapping(fileId),
    onSuccess: (data) => {
      setTestResult(data);
      setTesting(false);
    },
    onError: (error) => {
      showError(error.message || 'Failed to test mapping');
      setTesting(false);
    }
  });

  // Sync with database mutation
  const syncMutation = useMutation({
    mutationFn: () => kbMappingService.syncWithDatabase(),
    onSuccess: () => {
      showSuccess('Mappings synced with database');
      queryClient.invalidateQueries(['kb-mappings']);
    },
    onError: (error) => {
      showError(error.message || 'Failed to sync mappings');
    }
  });

  // Export mappings
  const handleExport = async () => {
    try {
      const data = await kbMappingService.exportMappings();
      const blob = new Blob([JSON.stringify(data.mappings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kb-mappings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('Mappings exported successfully');
    } catch (error) {
      showError('Failed to export mappings');
    }
  };

  // Bulk import
  const handleBulkImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const mappings = Array.isArray(data) ? data : (data.mappings || []);

        const response = await kbMappingService.bulkImportMappings(mappings);
        if (response.result) {
          showSuccess(`Imported ${response.result.success} mappings successfully`);
          if (response.result.failed > 0) {
            showError(`${response.result.failed} mappings failed to import`);
          }
          queryClient.invalidateQueries(['kb-mappings']);
        }
      } catch (error) {
        showError('Failed to import mappings: ' + error.message);
      }
    };
    input.click();
  };

  // Open edit dialog
  const handleOpenEdit = (mapping = null) => {
    if (mapping) {
      setFormData({
        fileId: mapping.id || mapping.fileId,
        url: mapping.url || '',
        selector: mapping.selector || ''
      });
      setSelectedMapping(mapping);
    } else {
      setFormData({ fileId: '', url: '', selector: '' });
      setSelectedMapping(null);
    }
    setEditDialogOpen(true);
  };

  // Handle save
  const handleSave = () => {
    if (!formData.fileId || !formData.url) {
      showError('File and URL are required');
      return;
    }

    // Validate URL
    try {
      new URL(formData.url);
    } catch (e) {
      showError('Invalid URL format');
      return;
    }

    saveMappingMutation.mutate(formData);
  };

  // Handle delete
  const handleDelete = () => {
    if (selectedMapping) {
      deleteMappingMutation.mutate(selectedMapping.id || selectedMapping.fileId);
    }
  };

  // Handle test
  const handleTest = async (mapping) => {
    setSelectedMapping(mapping);
    setTestResult(null);
    setTesting(true);
    setTestDialogOpen(true);
    testMappingMutation.mutate(mapping.id || mapping.fileId);
  };

  // Get file name from ID
  const getFileName = (fileId) => {
    const file = kbFiles.find(f => f._id === fileId || f.id === fileId);
    return file ? file.filename || file.title : fileId;
  };

  // Get drift status chip
  const getDriftStatusChip = (mapping) => {
    if (!mapping.lastChecked) {
      return <Chip label="Not Checked" size="small" color="default" />;
    }
    // This would be enhanced when drift detection results are available
    return <Chip label="Checked" size="small" color="info" />;
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              KB File-URL Mappings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure file-URL mappings for drift detection. Maps KB files to their source URLs for automatic content comparison.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Sync />}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isLoading}
            >
              Sync
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExport}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              startIcon={<Upload />}
              onClick={handleBulkImport}
            >
              Import
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenEdit()}
            >
              Add Mapping
            </Button>
          </Box>
        </Box>

        {mappingsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : mappings.length === 0 ? (
          <Alert severity="info">
            No mappings configured. Click "Add Mapping" to create your first mapping.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>File</TableCell>
                  <TableCell>Source URL</TableCell>
                  <TableCell>Selector</TableCell>
                  <TableCell>Last Checked</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id || mapping.fileId}>
                    <TableCell>
                      {getFileName(mapping.id || mapping.fileId)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={mapping.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <LinkIcon fontSize="small" />
                        {mapping.url}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {mapping.selector || '-'}
                    </TableCell>
                    <TableCell>
                      {mapping.lastChecked ? formatDateTime(mapping.lastChecked) : '-'}
                    </TableCell>
                    <TableCell>
                      {getDriftStatusChip(mapping)}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleTest(mapping)}
                        title="Test Mapping"
                      >
                        <PlayArrow fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEdit(mapping)}
                        title="Edit Mapping"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedMapping(mapping);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete Mapping"
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Edit/Add Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedMapping ? 'Edit Mapping' : 'Add Mapping'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="KB File"
              value={formData.fileId}
              onChange={(e) => setFormData({ ...formData, fileId: e.target.value })}
              fullWidth
              SelectProps={{
                native: true
              }}
              required
            >
              <option value=""></option>
              {kbFiles.map((file) => (
                <option key={file._id || file.id} value={file._id || file.id}>
                  {file.filename || file.title}
                </option>
              ))}
            </TextField>
            <TextField
              label="Source URL"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              fullWidth
              required
              placeholder="https://example.com/page"
              helperText="URL of the source website to compare against"
            />
            <TextField
              label="CSS Selector (Optional)"
              value={formData.selector}
              onChange={(e) => setFormData({ ...formData, selector: e.target.value })}
              fullWidth
              placeholder="#content, .main-content"
              helperText="Optional CSS selector to extract specific content from the page"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saveMappingMutation.isLoading}
          >
            {saveMappingMutation.isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Mapping</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the mapping for{' '}
            <strong>{selectedMapping && getFileName(selectedMapping.id || selectedMapping.fileId)}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={deleteMappingMutation.isLoading}
          >
            {deleteMappingMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Test Mapping Result</DialogTitle>
        <DialogContent>
          {testing ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : testResult ? (
            <Box>
              {testResult.success ? (
                <Box>
                  <Alert severity={testResult.isStale ? 'warning' : 'success'} sx={{ mb: 2 }}>
                    {testResult.isStale
                      ? `Drift detected: ${(testResult.difference * 100).toFixed(1)}% difference`
                      : `No drift detected: ${(testResult.similarity * 100).toFixed(1)}% similarity`}
                  </Alert>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="subtitle2">Similarity</Typography>
                      <Typography variant="h6">{(testResult.similarity * 100).toFixed(1)}%</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Difference</Typography>
                      <Typography variant="h6">{(testResult.difference * 100).toFixed(1)}%</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">KB Content Length</Typography>
                      <Typography variant="body2">{testResult.kbContentLength} characters</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Website Content Length</Typography>
                      <Typography variant="body2">{testResult.websiteContentLength} characters</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Drift Threshold</Typography>
                      <Typography variant="body2">{(testResult.driftThreshold * 100).toFixed(0)}%</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Status</Typography>
                      <Chip
                        label={testResult.isStale ? 'Stale' : 'Up to Date'}
                        color={testResult.isStale ? 'warning' : 'success'}
                        size="small"
                      />
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Alert severity="error">{testResult.error || 'Test failed'}</Alert>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DriftDetectionMapping;

