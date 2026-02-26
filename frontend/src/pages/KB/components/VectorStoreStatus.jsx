import React from 'react';
import { Paper, Typography, Box, Chip, Alert } from '@mui/material';
import { formatDateTime } from '../../../utils/formatters';

const VectorStoreStatus = ({ 
  vectorStoreStatus, 
  vectorStoreLoading, 
  vectorStoreError 
}) => {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Vector Store Status
      </Typography>
      {vectorStoreLoading ? (
        <Typography>Loading vector store status...</Typography>
      ) : vectorStoreError ? (
        <Alert severity="error">
          Failed to load vector store status: {vectorStoreError.message}
        </Alert>
      ) : vectorStoreStatus?.vectorStoreError ? (
        <Alert severity="warning">
          Vector store not available. {vectorStoreStatus.vectorStoreError}
        </Alert>
      ) : vectorStoreStatus && (vectorStoreStatus.id || vectorStoreStatus.status) ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Status</Typography>
            <Chip
              label={vectorStoreStatus.status === 'completed' ? 'Active' : (vectorStoreStatus.status || 'Unknown')}
              color={vectorStoreStatus.status === 'active' || vectorStoreStatus.status === 'completed' ? 'success' : 'default'}
              variant="filled"
              sx={{
                backgroundColor: (vectorStoreStatus.status === 'active' || vectorStoreStatus.status === 'completed') ? 'success.main' : undefined,
                color: (vectorStoreStatus.status === 'active' || vectorStoreStatus.status === 'completed') ? 'success.contrastText' : undefined
              }}
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Files</Typography>
            <Typography variant="h6">{vectorStoreStatus.fileCount || 0}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Vector Store Name</Typography>
            <Typography variant="body2">
              {vectorStoreStatus.name || 'N/A'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Last Updated</Typography>
            <Typography variant="body2">
              {vectorStoreStatus.lastUpdated ? formatDateTime(vectorStoreStatus.lastUpdated) : 'N/A'}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Alert severity="warning">Unable to load vector store status</Alert>
      )}
    </Paper>
  );
};

export default VectorStoreStatus;



