import React, { useState } from 'react';
import { Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Paper, IconButton, Tooltip, TextField, InputAdornment } from '@mui/material';
import { GetApp, Visibility, Search } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  
  const {
    dsarRequests: initialRequests,
    dsarLoading: initialLoading,
    setDsarFormDialog
  } = state;

  const { getStatusColor } = handlers;

  // Fetch requests with filters
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['dsar-requests', filters],
    queryFn: async () => {
      const response = await privacyService.getAllDSARRequests(filters);
      // Handle normalized response structure
      return response?.data?.dsarRequests || response?.dsarRequests || response?.data || response || [];
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

  const handleUpdate = () => {
    queryClient.invalidateQueries(['dsar-requests']);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          DSAR Request Logs ({dsarRequests.length})
        </Typography>
        <Button
          variant="contained"
          onClick={() => setDsarFormDialog({ open: true })}
        >
          Create DSAR Request
        </Button>
      </Box>

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
                    <Typography color="text.secondary">No DSAR requests found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                dsarRequests.map((request) => (
                  <TableRow key={request.id}>
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
    </Box>
  );
};

export default DSARRequestsTab;



