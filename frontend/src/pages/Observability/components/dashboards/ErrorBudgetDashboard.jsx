import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, CircularProgress, Alert, Button, Typography } from '@mui/material';
import { Error, Warning, CheckCircle, Refresh } from '@mui/icons-material';
import StatGrid from '../shared/StatGrid';
import observabilityService from '../../../../services/observabilityService';

function parsePercent(str) {
  if (str == null) return 0;
  const n = parseFloat(String(str).replace('%', ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function getStatusFromRemaining(remainingPct) {
  if (remainingPct >= 80) return { color: 'success', icon: CheckCircle };
  if (remainingPct >= 50) return { color: 'warning', icon: Warning };
  return { color: 'error', icon: Error };
}

/**
 * Build stat metrics from API shape: { calls, errorBudget, errors }.
 * Does not render timeRange/timestamp as cards.
 */
function buildErrorBudgetMetrics(budgets) {
  if (!budgets) return [];
  const { calls = {}, errorBudget = {}, errors = {} } = budgets;
  const metrics = [];

  const totalCalls = calls.total ?? 0;
  const failedCalls = calls.failed ?? 0;
  const callsRemainingPct = totalCalls > 0 ? ((totalCalls - failedCalls) / totalCalls) * 100 : 100;
  const callsStatus = getStatusFromRemaining(callsRemainingPct);
  metrics.push({
    id: 'calls',
    title: 'Calls',
    value: callsRemainingPct,
    unit: '%',
    color: callsStatus.color,
    icon: callsStatus.icon,
    subtitle: `${failedCalls} / ${totalCalls} failed`,
    trend: null
  });

  const budgetRemainingPct = parsePercent(errorBudget.remaining);
  const budgetStatus = getStatusFromRemaining(budgetRemainingPct);
  metrics.push({
    id: 'errorBudget',
    title: 'Error budget',
    value: budgetRemainingPct,
    unit: '%',
    color: budgetStatus.color,
    icon: budgetStatus.icon,
    subtitle: `Current: ${errorBudget.current ?? '0%'}, target: ${errorBudget.target ?? '1%'}`,
    trend: null
  });

  const errorCount = errors.total ?? 0;
  const errorsStatus = errorCount > 0 ? { color: 'error', icon: Error } : { color: 'success', icon: CheckCircle };
  metrics.push({
    id: 'errors',
    title: 'Errors',
    value: errorCount,
    unit: '',
    color: errorsStatus.color,
    icon: errorsStatus.icon,
    subtitle: `Application error logs in window`,
    trend: null
  });

  return metrics;
}

/**
 * Error Budget Dashboard Component
 * Displays error budgets and SLO compliance from API shape: calls, errorBudget, errors.
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

  const statMetrics = buildErrorBudgetMetrics(budgets);

  return (
    <Box>
      <StatGrid metrics={statMetrics} />
    </Box>
  );
};

export default ErrorBudgetDashboard;

