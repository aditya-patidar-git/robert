import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  CircularProgress
} from '@mui/material';
import { Visibility, Download } from '@mui/icons-material';
import { format } from 'date-fns';

/**
 * DSAR Requests Tab Component
 * Displays and manages DSAR requests
 */
export function DSARRequestsTab({
  requests,
  loading,
  onView,
  onExport,
  onStatusChange
}) {
  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      in_progress: 'info',
      completed: 'success',
      rejected: 'error'
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Data Subject Access Requests</Typography>
        <Button variant="contained" onClick={() => onView(null)}>
          New Request
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Request ID</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Submitted</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests && requests.length > 0 ? (
              requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.id}</TableCell>
                  <TableCell>{request.subjectEmail || request.subjectPhone}</TableCell>
                  <TableCell>{request.requestType}</TableCell>
                  <TableCell>
                    <Chip
                      label={request.status}
                      color={getStatusColor(request.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.createdAt), 'PPp')}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => onView(request)}
                      title="View Details"
                    >
                      <Visibility />
                    </IconButton>
                    {request.status === 'completed' && (
                      <IconButton
                        size="small"
                        onClick={() => onExport(request.id)}
                        title="Export Data"
                      >
                        <Download />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">No DSAR requests found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

