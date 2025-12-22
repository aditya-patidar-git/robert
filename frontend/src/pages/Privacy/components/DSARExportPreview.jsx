import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Grid,
  Paper
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useToast } from '../../../components/common/ToastProvider';
import dsarService from '../../../services/dsarService';
import { formatDateTime } from '../../../utils/formatters';

const DSARExportPreview = ({ open, onClose, requestId }) => {
  const { showSuccess, showError } = useToast();
  const [generating, setGenerating] = useState(false);

  const { data: requestData, isLoading } = useQuery({
    queryKey: ['dsar-request', requestId],
    queryFn: () => dsarService.getDSARRequestDetails(requestId),
    enabled: open && !!requestId
  });

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['dsar-preview', requestId],
    queryFn: () => dsarService.previewDSARData(requestId, ['all']),
    enabled: open && !!requestId && requestData?.status === 'processing'
  });

  const generateExportMutation = useMutation({
    mutationFn: () => dsarService.generateDSARExport(requestId, false),
    onSuccess: () => {
      showSuccess('Export generated successfully');
      setGenerating(false);
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to generate export');
      setGenerating(false);
    }
  });

  const handleGenerateExport = () => {
    setGenerating(true);
    generateExportMutation.mutate();
  };

  const handleDownload = async () => {
    try {
      if (!requestData?.exportUrl) {
        showError('Export not available');
        return;
      }

      const fileName = requestData.exportUrl.split('/').pop();
      const blob = await dsarService.downloadDSARExport(requestId, fileName);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      showSuccess('Export downloaded successfully');
    } catch (error) {
      showError('Failed to download export');
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  const request = requestData?.request || requestData;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          DSAR Request Details
        </Typography>
      </DialogTitle>
      <DialogContent>
        {request && (
          <Box sx={{ mt: 2 }}>
            {/* Request Information */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Request Information
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Request ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                    {request.requestId || request.id}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={request.status}
                    size="small"
                    color={
                      request.status === 'completed' ? 'success' :
                      request.status === 'processing' ? 'info' :
                      request.status === 'pending' ? 'warning' : 'error'
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Request Type
                  </Typography>
                  <Chip
                    label={request.requestType}
                    size="small"
                    color={request.requestType === 'export' ? 'primary' : 'error'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Requestor Email
                  </Typography>
                  <Typography variant="body1">
                    {request.requestorEmail}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Requested At
                  </Typography>
                  <Typography variant="body1">
                    {formatDateTime(request.requestedAt || request.createdAt)}
                  </Typography>
                </Grid>
                {request.verifiedAt && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Verified At
                    </Typography>
                    <Typography variant="body1">
                      {formatDateTime(request.verifiedAt)}
                    </Typography>
                  </Grid>
                )}
                {request.completedAt && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Completed At
                    </Typography>
                    <Typography variant="body1">
                      {formatDateTime(request.completedAt)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            {/* Export Information */}
            {request.requestType === 'export' && (
              <>
                <Divider sx={{ my: 2 }} />
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                    Export Information
                  </Typography>
                  {request.exportUrl ? (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="success" sx={{ mb: 2 }}>
                        Export is ready for download
                      </Alert>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Export URL
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                            {request.exportUrl}
                          </Typography>
                        </Grid>
                        {request.exportExpiresAt && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                              Expires At
                            </Typography>
                            <Typography variant="body2">
                              {formatDateTime(request.exportExpiresAt)}
                              {new Date(request.exportExpiresAt) < new Date() && (
                                <Chip label="Expired" size="small" color="error" sx={{ ml: 1 }} />
                              )}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                  ) : request.status === 'processing' ? (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Export is being generated. This may take a few minutes.
                      </Alert>
                      {previewLoading ? (
                        <Box display="flex" justifyContent="center" p={2}>
                          <CircularProgress />
                        </Box>
                      ) : previewData && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Data Preview
                          </Typography>
                          <Typography variant="body2">
                            This export will include call records, transcripts, and metadata associated with{' '}
                            <strong>{request.userIdentifier}</strong>.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="warning">
                        Export has not been generated yet. Click "Generate Export" to create it.
                      </Alert>
                    </Box>
                  )}
                </Paper>
              </>
            )}

            {/* Notes */}
            {request.notes && (
              <>
                <Divider sx={{ my: 2 }} />
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {request.notes}
                  </Typography>
                </Paper>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {request?.requestType === 'export' && request.status === 'processing' && !request.exportUrl && (
          <Button
            onClick={handleGenerateExport}
            variant="contained"
            startIcon={generating ? <CircularProgress size={20} /> : <RefreshIcon />}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Export'}
          </Button>
        )}
        {request?.exportUrl && (
          <Button
            onClick={handleDownload}
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={request.exportExpiresAt && new Date(request.exportExpiresAt) < new Date()}
          >
            Download Export
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DSARExportPreview;

