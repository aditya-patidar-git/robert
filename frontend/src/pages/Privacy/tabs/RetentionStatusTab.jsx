import React from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { formatDateTime } from '../../../utils/formatters';

const RetentionStatusTab = ({ state, handlers }) => {
  const {
    retentionPolicies,
    retentionLoading
  } = state;

  const { cleanupMutation } = handlers;

  return (
    <Box sx={{ p: 3 }}>
      {retentionLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {retentionPolicies && Object.keys(retentionPolicies).length > 0 ? (
            Object.entries(retentionPolicies).map(([dataType, check]) => (
            <Box key={dataType} sx={{ width: { xs: '100%', md: 'calc(33.333% - 16px)' }, minWidth: { md: '250px' } }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cutoff Date: {formatDateTime(check?.cutoffDate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Records to Delete: {check?.recordsToDelete || 0}
                </Typography>
              </Paper>
            </Box>
            ))
          ) : (
            <Box sx={{ width: '100%' }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" align="center">
                  No retention policy data available
                </Typography>
              </Paper>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default RetentionStatusTab;



