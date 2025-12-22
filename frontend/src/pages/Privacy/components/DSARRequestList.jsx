import React, { useState } from 'react';
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
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import dsarService from '../../../services/dsarService';
import DSARExportPreview from './DSARExportPreview';
import { formatDateTime } from '../../../utils/formatters';

const DSARRequestList = ({ showUserOnly = false }) => {
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [previewDialog, setPreviewDialog] = useState({ open: false, requestId: null });
  const [processDialog, setProcessDialog] = useState({ open: false, request: null, action: '' });

  const { data: dsarData, isLoading } = useQuery({
    queryKey: ['dsar-requests', statusFilter, typeFilter],
    queryFn: () => dsarService.getDSARRequests({
      status: statusFilter || undefined,
      requestType: typeFilter || undefined
    })
  });

  const requests = (dsarData?.dsarRequests || dsarData || []).filter(req => {
    if (showUserOnly && user) {
      return req.requestorEmail === user.email || req.userIdentifier === user.email;
    }
    return true;
  });

  const processMutation = useMutation({
    mutationFn: ({ requestId, action, notes }) => dsarService.processDSARRequest(requestId, action, notes),
    onSuccess: () => {
      showSuccess('Request processed successfully');
      queryClient.invalidateQueries(['dsar-requests']);
      setProcessDialog({ open: false, request: null, action: '' });
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to process request');
    }
  });

  const generateExportMutation = useMutation({
    mutationFn: (requestId) => dsarService.generateDSARExport(requestId, false),
    onSuccess: () => {
      showSuccess('Export generated successfully');
      queryClient.invalidateQueries(['dsar-requests']);
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to generate export');
    }
  });

  const handleProcess = (request, action) => {
    setProcessDialog({ open: true, request, action });
  };

  const handleConfirmProcess = () => {
    const { request, action } = processDialog;
    if (request && action) {
      processMutation.mutate({
        requestId: request.requestId || request.id,
        action,
        notes: ''
      });
    }
  };

  const handleDownload = async (request) => {
    try {
      if (!request.exportUrl) {
        showError('Export not available. Please generate export first.');
        return;
      }

      const fileName = request.exportUrl.split('/').pop();
      const blob = await dsarService.downloadDSARExport(request.requestId || request.id, fileName);
      
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'info';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'export': return 'primary';
      case 'delete': return 'error';
      case 'rectification': return 'warning';
      default: return 'default';
    }
  };

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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="export">Export</MenuItem>
              <MenuItem value="delete">Delete</MenuItem>
              <MenuItem value="rectification">Rectification</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => queryClient.invalidateQueries(['dsar-requests'])}
            size="small"
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Request ID</TableCell>
              <TableCell>Requestor</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Requested</TableCell>
              <TableCell>Verified</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Alert severity="info" sx={{ maxWidth: 400, margin: '0 auto' }}>
                    No DSAR requests found
                  </Alert>
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.requestId || request.id || request._id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {request.requestId || request.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{request.requestorEmail}</Typography>
                    {request.userIdentifier && request.userIdentifier !== request.requestorEmail && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        ID: {request.userIdentifier}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={request.requestType}
                      size="small"
                      color={getTypeColor(request.requestType)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={request.status}
                      size="small"
                      color={getStatusColor(request.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                      {formatDateTime(request.requestedAt || request.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {request.verifiedAt ? (
                      <Typography variant="body2" color="success.main" sx={{ fontSize: '0.875rem' }}>
                        {formatDateTime(request.verifiedAt)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                        Not verified
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      {!showUserOnly && user?.role === 'owner' && request.status === 'pending' && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleProcess(request, 'approve')}
                            >
                              <ApproveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleProcess(request, 'reject')}
                            >
                              <RejectIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {!showUserOnly && user?.role === 'owner' && request.status === 'processing' && request.requestType === 'export' && (
                        <Tooltip title="Generate Export">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => generateExportMutation.mutate(request.requestId || request.id)}
                            disabled={generateExportMutation.isLoading}
                          >
                            Generate
                          </Button>
                        </Tooltip>
                      )}
                      {request.status === 'completed' && request.exportUrl && (
                        <Tooltip title="Download Export">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleDownload(request)}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {!showUserOnly && (
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedRequest(request);
                              setPreviewDialog({ open: true, requestId: request.requestId || request.id });
                            }}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Process Dialog */}
      <Dialog
        open={processDialog.open}
        onClose={() => setProcessDialog({ open: false, request: null, action: '' })}
      >
        <DialogTitle>
          {processDialog.action === 'approve' ? 'Approve' : 'Reject'} DSAR Request
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {processDialog.action} this DSAR request?
          </Typography>
          {processDialog.request && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Request ID: {processDialog.request.requestId || processDialog.request.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Type: {processDialog.request.requestType}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Requestor: {processDialog.request.requestorEmail}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProcessDialog({ open: false, request: null, action: '' })}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmProcess}
            variant="contained"
            color={processDialog.action === 'approve' ? 'success' : 'error'}
            disabled={processMutation.isLoading}
          >
            {processMutation.isLoading ? 'Processing...' : processDialog.action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      {previewDialog.open && (
        <DSARExportPreview
          open={previewDialog.open}
          onClose={() => setPreviewDialog({ open: false, requestId: null })}
          requestId={previewDialog.requestId}
        />
      )}
    </Box>
  );
};

export default DSARRequestList;

