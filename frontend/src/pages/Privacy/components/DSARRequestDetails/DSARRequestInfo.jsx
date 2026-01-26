import React from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { formatDateTime } from '../../../../utils/formatters';

/**
 * DSARRequestInfo Component
 * Display request information
 */
const DSARRequestInfo = ({ request }) => {
  if (!request) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom fontWeight="bold">
        Request Information
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' }, minWidth: { md: '200px' } }}>
          <Typography variant="caption" color="text.secondary">Requestor Email</Typography>
          <Typography variant="body2">{request.requestorEmail || request.requestor || 'N/A'}</Typography>
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' }, minWidth: { md: '200px' } }}>
          <Typography variant="caption" color="text.secondary">Requestor Name</Typography>
          <Typography variant="body2">{request.requestorName || 'N/A'}</Typography>
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' }, minWidth: { md: '200px' } }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Request Type
          </Typography>
          <Chip
            label={request.requestType || request.type || 'N/A'}
            size="small"
            color={request.requestType === 'export' || request.type === 'export' ? 'info' : 'error'}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' }, minWidth: { md: '200px' } }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Status
          </Typography>
          <Chip
            label={request.status || 'N/A'}
            size="small"
            color={
              request.status === 'completed' ? 'success' :
              request.status === 'pending' ? 'warning' :
              request.status === 'rejected' ? 'error' : 'default'
            }
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' }, minWidth: { md: '200px' } }}>
          <Typography variant="caption" color="text.secondary">Created At</Typography>
          <Typography variant="body2">{formatDateTime(request.createdAt || request.date)}</Typography>
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' }, minWidth: { md: '200px' } }}>
          <Typography variant="caption" color="text.secondary">Requested Data Types</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {(request.requestedDataTypes || request.requestedData || []).map((dataType, index) => (
              <Chip key={index} label={dataType} size="small" variant="outlined" />
            ))}
            {(!request.requestedDataTypes?.length && !request.requestedData?.length) && (
              <Typography variant="body2" color="text.secondary">All Data</Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default DSARRequestInfo;

