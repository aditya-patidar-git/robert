import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, Chip, Button } from '@mui/material';
import { Phone, CheckCircle, Error as ErrorIcon, Timer, Refresh } from '@mui/icons-material';
import StatGrid from '../shared/StatGrid';
import ChartContainer from '../shared/ChartContainer';
import DataTable from '../shared/DataTable';
import observabilityService from '../../../../services/observabilityService';

/**
 * SIP Analytics Dashboard Component
 * Displays SIP call metrics and performance
 */
const SIPAnalyticsDashboard = ({ timeRange = '24h' }) => {
  const { data: metrics, isLoading, error, refetch } = useQuery({
    queryKey: ['sip-metrics', timeRange],
    queryFn: () => observabilityService.getSIPMetrics(timeRange),
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
          Failed to load SIP metrics
        </Typography>
        <Typography variant="body2">
          {error.message || 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  const statMetrics = [
    {
      id: 'total-calls',
      title: 'Total SIP Calls',
      value: metrics?.totalCalls || 0,
      unit: '',
      color: 'primary',
      icon: Phone
    },
    {
      id: 'success-rate',
      title: 'Success Rate',
      value: metrics?.successRate || 0,
      unit: '',
      color: 'success',
      icon: CheckCircle,
      type: 'percentage',
      subtitle: 'Percentage of completed calls'
    },
    {
      id: 'failure-rate',
      title: 'Failure Rate',
      value: metrics?.failureRate || 0,
      unit: '',
      color: 'error',
      icon: ErrorIcon,
      type: 'percentage',
      subtitle: 'Percentage of failed calls'
    },
    {
      id: 'avg-duration',
      title: 'Avg Call Duration',
      value: metrics?.averageDuration || 0,
      unit: 's',
      color: 'info',
      icon: Timer,
      subtitle: 'Average call duration in seconds'
    }
  ];

  const statusColumns = [
    { key: 'status', label: 'Call Status' },
    { 
      key: 'count', 
      label: 'Count', 
      align: 'right',
      render: (value) => value.toLocaleString()
    },
    {
      key: 'percentage',
      label: 'Percentage',
      align: 'right',
      render: (value, row) => {
        const total = metrics?.totalCalls || 1;
        const pct = (value / total * 100).toFixed(1);
        return `${pct}%`;
      }
    },
    {
      key: 'chip',
      label: '',
      render: (value, row) => {
        const status = row.status;
        const colorMap = {
          'completed': 'success',
          'in-progress': 'info',
          'ringing': 'warning',
          'failed': 'error',
          'busy': 'warning',
          'no-answer': 'warning'
        };
        return (
          <Chip
            label={status}
            size="small"
            color={colorMap[status] || 'default'}
          />
        );
      }
    }
  ];

  const statusRows = metrics?.callsByStatus
    ? Object.entries(metrics.callsByStatus).map(([status, count]) => ({
        status,
        count
      })).sort((a, b) => b.count - a.count)
    : [];

  return (
    <Box>
      <StatGrid metrics={statMetrics} />
      
      <Box sx={{ mt: 4 }}>
        <ChartContainer title="SIP Call Status Distribution" subtitle={`Status breakdown for ${timeRange}`}>
          <DataTable 
            columns={statusColumns}
            rows={statusRows}
            emptyMessage="No SIP call data available"
            getRowKey={(row) => row.status}
          />
        </ChartContainer>
      </Box>
    </Box>
  );
};

export default SIPAnalyticsDashboard;

