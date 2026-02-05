import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, CircularProgress, Alert, Button, Typography } from '@mui/material';
import { Error, Warning, CheckCircle, Refresh } from '@mui/icons-material';
import StatGrid from '../shared/StatGrid';
import observabilityService from '../../../../services/observabilityService';

/**
 * Error Budget Dashboard Component
 * Displays error budgets and SLO compliance
 */
const ErrorBudgetDashboard = ({ timeRange = '24h' }) => {
  const { data: budgets, isLoading, error, refetch } = useQuery({
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
      <Alert 
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => refetch()}
            startIcon={<Refresh />}
          >
            Retry
          </Button>
        }
      >
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Failed to load error budgets
        </Typography>
        <Typography variant="body2">
          {error.message || 'An unexpected error occurred'}
        </Typography>
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
    </Box>
  );
};

export default ErrorBudgetDashboard;

