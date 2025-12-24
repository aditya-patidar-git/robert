import React from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  LinearProgress,
  Chip
} from '@mui/material';
import { formatDateTime } from '../../../utils/formatters';

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

  // Get current timestamp for Last Updated card
  const currentTimestamp = new Date();

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Error Budgets
        </Typography>
      </Box>
      
      {errorBudgetsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : errorBudgets ? (
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 2 
        }}>
          {/* TimeRange Card */}
          <Box sx={{ 
            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)', lg: '1 1 calc(20% - 13px)' },
            minWidth: 0
          }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Time Range
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {errorBudgets.timeRange?.toUpperCase() || 'N/A'}
              </Typography>
            </Paper>
          </Box>

          {/* Calls Card */}
          <Box sx={{ 
            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)', lg: '1 1 calc(20% - 13px)' },
            minWidth: 0
          }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Total Calls
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {errorBudgets.calls?.total?.toLocaleString() || 0}
              </Typography>
              {errorBudgets.calls?.errorRate && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Error Rate: {errorBudgets.calls.errorRate}
                </Typography>
              )}
            </Paper>
          </Box>

          {/* ErrorBudget Card */}
          <Box sx={{ 
            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)', lg: '1 1 calc(20% - 13px)' },
            minWidth: 0
          }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Error Budget
              </Typography>
              <Typography 
                variant="h6" 
                fontWeight={600}
                color={isExceeded ? 'error.main' : 'text.primary'}
              >
                {errorBudgets.errorBudget?.current || '0%'}
              </Typography>
              <Box sx={{ mt: 1, mb: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressValue}
                  color={isExceeded ? 'error' : progressValue > 80 ? 'warning' : 'success'}
                  sx={{ 
                    height: 6, 
                    borderRadius: 1,
                    backgroundColor: 'grey.200'
                  }}
                />
              </Box>
              <Chip
                label={isExceeded ? 'Exceeded' : 'Within Budget'}
                color={isExceeded ? 'error' : 'success'}
                size="small"
                sx={{ mt: 0.5 }}
              />
            </Paper>
          </Box>

          {/* Errors Card */}
          <Box sx={{ 
            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)', lg: '1 1 calc(20% - 13px)' },
            minWidth: 0
          }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Total Errors
              </Typography>
              <Typography 
                variant="h6" 
                fontWeight={600}
                color={errorBudgets.errors?.total > 0 ? 'error.main' : 'text.primary'}
              >
                {errorBudgets.errors?.total?.toLocaleString() || 0}
              </Typography>
            </Paper>
          </Box>

          {/* Timestamp Card */}
          <Box sx={{ 
            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)', lg: '1 1 calc(20% - 13px)' },
            minWidth: 0
          }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Last Updated
              </Typography>
              <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {formatDateTime(currentTimestamp)}
              </Typography>
            </Paper>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No error budget data available</Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ErrorBudgetsTab;

