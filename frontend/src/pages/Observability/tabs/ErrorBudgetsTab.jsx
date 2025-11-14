import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  CircularProgress,
  LinearProgress,
  Chip
} from '@mui/material';

const ErrorBudgetsTab = ({
  errorBudgets,
  errorBudgetsLoading
}) => {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Error Budgets
      </Typography>
      {errorBudgetsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : errorBudgets ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Call Statistics</Typography>
              <Typography>Total: {errorBudgets.calls?.total || 0}</Typography>
              <Typography>Successful: {errorBudgets.calls?.successful || 0}</Typography>
              <Typography>Failed: {errorBudgets.calls?.failed || 0}</Typography>
              <Typography>Error Rate: {errorBudgets.calls?.errorRate || '0%'}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Error Budget</Typography>
              <Typography>Target: {errorBudgets.errorBudget?.target || '1%'}</Typography>
              <Typography>Current: {errorBudgets.errorBudget?.current || '0%'}</Typography>
              <Typography>Remaining: {errorBudgets.errorBudget?.remaining || '1%'}</Typography>
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={parseFloat(errorBudgets.errorBudget?.consumed || '0')}
                  color={errorBudgets.errorBudget?.status === 'exceeded' ? 'error' : 'success'}
                />
              </Box>
              <Chip
                label={errorBudgets.errorBudget?.status === 'exceeded' ? 'Exceeded' : 'Within Budget'}
                color={errorBudgets.errorBudget?.status === 'exceeded' ? 'error' : 'success'}
                sx={{ mt: 1 }}
              />
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Typography color="text.secondary">No error budget data available</Typography>
      )}
    </Paper>
  );
};

export default ErrorBudgetsTab;

