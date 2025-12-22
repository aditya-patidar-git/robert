import React from 'react';
import { Box, Typography, Button, Grid, Paper, CircularProgress } from '@mui/material';
import { formatDateTime } from '../../../utils/formatters';

const RetentionStatusTab = ({ state, handlers }) => {
  const {
    retentionPolicies,
    retentionLoading
  } = state;

  const { cleanupMutation } = handlers;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">
          Retention Policy Status
        </Typography>
        <Button
          variant="contained"
          onClick={() => cleanupMutation.mutate()}
          disabled={cleanupMutation.isLoading}
        >
          {cleanupMutation.isLoading ? 'Cleaning...' : 'Run Cleanup Now'}
        </Button>
      </Box>
      {retentionLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {retentionPolicies && Object.keys(retentionPolicies).length > 0 ? (
            Object.entries(retentionPolicies).map(([dataType, check]) => (
            <Grid item xs={12} md={4} key={dataType}>
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
            </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" align="center">
                  No retention policy data available
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default RetentionStatusTab;



