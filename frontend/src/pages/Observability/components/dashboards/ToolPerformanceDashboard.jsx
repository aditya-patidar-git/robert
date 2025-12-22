import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, Chip } from '@mui/material';
import { Build, CheckCircle, Error as ErrorIcon, Timer } from '@mui/icons-material';
import StatGrid from '../shared/StatGrid';
import ChartContainer from '../shared/ChartContainer';
import DataTable from '../shared/DataTable';
import observabilityService from '../../../../services/observabilityService';

/**
 * Tool Performance Dashboard Component
 * Displays metrics about tool execution performance
 */
const ToolPerformanceDashboard = ({ timeRange = '24h' }) => {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['tool-metrics', timeRange],
    queryFn: () => observabilityService.getToolMetrics(timeRange),
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
        Failed to load tool metrics: {error.message}
      </Alert>
    );
  }

  const statMetrics = [
    {
      id: 'total-invocations',
      title: 'Total Invocations',
      value: metrics?.totalInvocations || 0,
      unit: '',
      color: 'primary',
      icon: Build
    },
    {
      id: 'success-rate',
      title: 'Success Rate',
      value: metrics?.successRate || 0,
      unit: '',
      color: 'success',
      icon: CheckCircle,
      type: 'percentage',
      subtitle: 'Percentage of successful executions'
    },
    {
      id: 'error-rate',
      title: 'Error Rate',
      value: metrics?.errorRate || 0,
      unit: '',
      color: 'error',
      icon: ErrorIcon,
      type: 'percentage',
      subtitle: 'Percentage of failed executions'
    },
    {
      id: 'avg-execution-time',
      title: 'Avg Execution Time',
      value: metrics?.averageExecutionTime || 0,
      unit: 'ms',
      color: 'info',
      icon: Timer,
      subtitle: 'Average tool execution duration'
    }
  ];

  const toolBreakdownColumns = [
    { key: 'tool', label: 'Tool Name' },
    { 
      key: 'count', 
      label: 'Invocations', 
      align: 'right',
      render: (value) => value.toLocaleString()
    },
    { 
      key: 'avgTime', 
      label: 'Avg Time (ms)', 
      align: 'right',
      render: (value) => value ? value.toFixed(1) : '-'
    },
    { 
      key: 'successRate', 
      label: 'Success Rate', 
      align: 'right',
      render: (value, row) => {
        const total = row.count || 0;
        const successes = row.successes || 0;
        return total > 0 ? `${(successes / total * 100).toFixed(1)}%` : '-';
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (value, row) => {
        const total = row.count || 0;
        const successes = row.successes || 0;
        const rate = total > 0 ? successes / total : 0;
        return (
          <Chip
            label={rate >= 0.9 ? 'Excellent' : rate >= 0.7 ? 'Good' : rate >= 0.5 ? 'Fair' : 'Poor'}
            size="small"
            color={rate >= 0.9 ? 'success' : rate >= 0.7 ? 'info' : rate >= 0.5 ? 'warning' : 'error'}
          />
        );
      }
    }
  ];

  const toolBreakdownRows = metrics?.toolBreakdown 
    ? Object.entries(metrics.toolBreakdown).map(([tool, data]) => ({
        tool,
        count: data.count || 0,
        avgTime: data.totalTime && data.count ? data.totalTime / data.count : null,
        successes: data.successes || 0,
        failures: data.failures || 0
      })).sort((a, b) => b.count - a.count)
    : [];

  return (
    <Box>
      <StatGrid metrics={statMetrics} />
      
      <Box sx={{ mt: 4 }}>
        <ChartContainer title="Tool Performance Breakdown" subtitle={`Performance metrics for ${timeRange}`}>
          <DataTable 
            columns={toolBreakdownColumns}
            rows={toolBreakdownRows}
            emptyMessage="No tool execution data available"
            getRowKey={(row) => row.tool}
          />
        </ChartContainer>
      </Box>
    </Box>
  );
};

export default ToolPerformanceDashboard;

