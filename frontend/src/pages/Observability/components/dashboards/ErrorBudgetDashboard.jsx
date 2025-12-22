import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, LinearProgress } from '@mui/material';
import { Error, Warning, CheckCircle } from '@mui/icons-material';
import StatGrid from '../shared/StatGrid';
import ChartContainer from '../shared/ChartContainer';
import observabilityService from '../../../../services/observabilityService';

/**
 * Error Budget Dashboard Component
 * Displays error budgets and SLO compliance
 */
const ErrorBudgetDashboard = ({ timeRange = '24h' }) => {
  const { data: budgets, isLoading, error } = useQuery({
    queryKey: ['error-budgets', timeRange],
    queryFn: () => observabilityService.getErrorBudgets(timeRange),
    refetchInterval: 60000
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load error budgets: {error.message}
      </Alert>
    );
  }

  const calculateBudgetRemaining = (budget) => {
    if (!budget || !budget.total) return 0;
    const used = budget.errors || 0;
    const remaining = Math.max(0, budget.total - used);
    return (remaining / budget.total) * 100;
  };

  const getBudgetStatus = (budget) => {
    const remaining = calculateBudgetRemaining(budget);
    if (remaining >= 80) return { color: 'success', icon: CheckCircle, label: 'Healthy' };
    if (remaining >= 50) return { color: 'warning', icon: Warning, label: 'Warning' };
    return { color: 'error', icon: Error, label: 'Critical' };
  };

  const statMetrics = budgets ? Object.entries(budgets).map(([key, budget]) => {
    const status = getBudgetStatus(budget);
    const remaining = calculateBudgetRemaining(budget);
    
    return {
      id: key,
      title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: remaining,
      unit: '%',
      color: status.color,
      icon: status.icon,
      subtitle: `${budget.errors || 0} / ${budget.total || 0} errors`,
      trend: null
    };
  }) : [];

  return (
    <Box>
      <StatGrid metrics={statMetrics} />
      
      <Box sx={{ mt: 4 }}>
        {budgets && Object.entries(budgets).map(([key, budget]) => {
          const remaining = calculateBudgetRemaining(budget);
          const status = getBudgetStatus(budget);
          
          return (
            <ChartContainer 
              key={key}
              title={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              subtitle={`Error budget: ${budget.total || 0} errors allowed`}
            >
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Budget Remaining
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <status.icon color={status.color} fontSize="small" />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: `${status.color}.main` }}>
                      {status.label}
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={remaining} 
                  color={status.color}
                  sx={{ height: 8, borderRadius: 1 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Used: {budget.errors || 0} errors
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Remaining: {budget.total - (budget.errors || 0)} errors ({remaining.toFixed(1)}%)
                  </Typography>
                </Box>
              </Box>
            </ChartContainer>
          );
        })}
      </Box>
    </Box>
  );
};

export default ErrorBudgetDashboard;

