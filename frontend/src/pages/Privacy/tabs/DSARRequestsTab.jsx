import React, { useState } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Paper, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { GetApp, Visibility, Delete } from '@mui/icons-material';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { formatDateTime } from '../../../utils/formatters';
import privacyService from '../../../services/privacyService';
import DSARRequestFilters from '../../../components/dsar/DSARRequestFilters';
import DSARRequestDetails from '../components/DSARRequestDetails';
import { useToast } from '../../../components/common/ToastProvider';

const DSARRequestsTab = ({ state, handlers }) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({});
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);
  
  const {
    dsarRequests: initialRequests,
    dsarLoading: initialLoading,
    setDsarFormDialog
  } = state;

  const { getStatusColor } = handlers;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (requestId) => privacyService.deleteDSARRequest(requestId),
    onSuccess: () => {
      showSuccess('DSAR request deleted successfully');
      queryClient.invalidateQueries(['dsar-requests']);
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    },
    onError: (error) => {
      showError(error.message || 'Failed to delete DSAR request');
    }
  });

  // Fetch requests with filters
  const { data: requestsData, isLoading, error } = useQuery({
    queryKey: ['dsar-requests', filters],
    queryFn: async () => {
      try {
        const response = await privacyService.getAllDSARRequests(filters);
        console.log('DSAR Requests API Response:', response);
        // Handle normalized response structure
        const requests = response?.data?.dsarRequests || response?.dsarRequests || response?.data || response || [];
        console.log('Parsed DSAR Requests:', requests);
        return requests;
      } catch (error) {
        console.error('Error fetching DSAR requests:', error);
        showError(error.response?.data?.error || 'Failed to fetch DSAR requests');
        return [];
      }
    },
    initialData: initialRequests || []
  });

  const dsarRequests = requestsData || [];
  const dsarLoading = isLoading || initialLoading;

  const handleViewDetails = (request) => {
    setSelectedRequestId(request.id || request._id);
    setDetailsDialogOpen(true);
  };

  const handleDownload = async (request) => {
    try {
      // In a real implementation, this would download the export
      showSuccess('Download started');
    } catch (error) {
      showError('Failed to download export');
    }
  };

  const handleDeleteClick = (request) => {
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (requestToDelete) {
      deleteMutation.mutate(requestToDelete._id || requestToDelete.id);
    }
  };

  const handleUpdate = () => {
    queryClient.invalidateQueries(['dsar-requests']);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <DSARRequestFilters
          filters={filters}
          onFilterChange={setFilters}
        />
      </Paper>
      {dsarLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="error">
            Error loading DSAR requests: {error.message || 'Unknown error'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Check the browser console for more details.
          </Typography>
        </Box>
      ) : (
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
              {dsarRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">
                      No DSAR requests found
                      {filters && Object.keys(filters).length > 0 && (
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          Try adjusting your filters or create a new request.
                        </Typography>
                      )}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                dsarRequests.map((request) => (
                  <TableRow key={request._id || request.id || request.requestId}>
                    <TableCell>{request.requestorEmail || request.requestor}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.requestType || request.type}
                        color={request.requestType === 'export' || request.type === 'export' ? 'info' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(request.createdAt || request.date)}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(request)}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {request.status === 'completed' && (
                          <Tooltip title="Download Export">
                            <IconButton
                              size="small"
                              onClick={() => handleDownload(request)}
                            >
                              <GetApp fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete Request">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(request)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Request Details Dialog */}
      <DSARRequestDetails
        requestId={selectedRequestId}
        open={detailsDialogOpen}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedRequestId(null);
        }}
        onUpdate={handleUpdate}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete DSAR Request</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this DSAR request from{' '}
            <strong>{requestToDelete?.requestorEmail}</strong>?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DSARRequestsTab;



