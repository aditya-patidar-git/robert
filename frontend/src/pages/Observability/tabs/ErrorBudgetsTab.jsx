import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  CircularProgress,
  LinearProgress,
  Chip,
  Divider,
  Stack
} from '@mui/material';

const ErrorBudgetsTab = ({
  errorBudgets,
  errorBudgetsLoading
}) => {
  // Calculate progress bar value: (errorRate / targetErrorRate) * 100, capped at 100
  const calculateProgressValue = () => {
    if (!errorBudgets?.errorBudget) return 0;
    
    const currentStr = errorBudgets.errorBudget.current || '0%';
    const targetStr = errorBudgets.errorBudget.target || '1%';
    
    const current = parseFloat(currentStr.replace('%', '')) || 0;
    const target = parseFloat(targetStr.replace('%', '')) || 1;
    
    if (target === 0) return 0;
    
    // Calculate percentage of budget consumed, capped at 100%
    const progress = Math.min(100, (current / target) * 100);
    return progress;
  };

  const progressValue = calculateProgressValue();
  const isExceeded = errorBudgets?.errorBudget?.status === 'exceeded';

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Error Budgets
        </Typography>
        {errorBudgets?.timeRange && (
          <Chip 
            label={`Time Range: ${errorBudgets.timeRange.toUpperCase()}`} 
            size="small" 
            variant="outlined"
          />
        )}
      </Box>
      
      {errorBudgetsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : errorBudgets ? (
        <Grid container spacing={3}>
          {/* Call Statistics */}
          <Grid item xs={12} md={6} lg={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Call Statistics
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Total Calls:</Typography>
                  <Typography fontWeight={600}>{errorBudgets.calls?.total?.toLocaleString() || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Successful:</Typography>
                  <Typography color="success.main" fontWeight={600}>
                    {errorBudgets.calls?.successful?.toLocaleString() || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Failed:</Typography>
                  <Typography color="error.main" fontWeight={600}>
                    {errorBudgets.calls?.failed?.toLocaleString() || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                  <Typography color="text.secondary" fontWeight={600}>Error Rate:</Typography>
                  <Typography 
                    fontWeight={700} 
                    color={isExceeded ? 'error.main' : 'success.main'}
                  >
                    {errorBudgets.calls?.errorRate || '0%'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Error Budget */}
          <Grid item xs={12} md={6} lg={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Error Budget
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Target:</Typography>
                  <Typography fontWeight={600}>{errorBudgets.errorBudget?.target || '1%'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Current:</Typography>
                  <Typography 
                    fontWeight={600}
                    color={isExceeded ? 'error.main' : 'text.primary'}
                  >
                    {errorBudgets.errorBudget?.current || '0%'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Remaining:</Typography>
                  <Typography fontWeight={600}>
                    {errorBudgets.errorBudget?.remaining || '1%'}
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Budget Consumed
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {progressValue.toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progressValue}
                    color={isExceeded ? 'error' : progressValue > 80 ? 'warning' : 'success'}
                    sx={{ 
                      height: 8, 
                      borderRadius: 1,
                      backgroundColor: 'grey.200'
                    }}
                  />
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={isExceeded ? 'Budget Exceeded' : 'Within Budget'}
                    color={isExceeded ? 'error' : 'success'}
                    size="small"
                    variant="filled"
                  />
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Error Logs Statistics */}
          <Grid item xs={12} md={12} lg={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Error Logs
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Total Errors:</Typography>
                  <Typography 
                    fontWeight={600}
                    color={errorBudgets.errors?.total > 0 ? 'error.main' : 'text.primary'}
                  >
                    {errorBudgets.errors?.total?.toLocaleString() || 0}
                  </Typography>
                </Box>
                {errorBudgets.errors?.byComponent && 
                 Object.keys(errorBudgets.errors.byComponent).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      By Component:
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {Object.entries(errorBudgets.errors.byComponent)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([component, count]) => (
                          <Box key={component} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                              {component}
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {count}
                            </Typography>
                          </Box>
                        ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No error budget data available</Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ErrorBudgetsTab;

