import React from 'react';
import { Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress } from '@mui/material';
import { GetApp } from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

const DSARRequestsTab = ({ state, handlers }) => {
  const {
    dsarRequests,
    dsarLoading,
    setDsarFormDialog
  } = state;

  const { getStatusColor } = handlers;

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
                      {request.status === 'completed' && (
                        <Button size="small" startIcon={<GetApp />}>
                          Download
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default DSARRequestsTab;



