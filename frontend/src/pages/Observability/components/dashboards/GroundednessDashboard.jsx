import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { CheckCircle, Cancel, TrendingUp, Refresh, PhoneForwarded } from '@mui/icons-material';
import StatGrid from '../shared/StatGrid';
import ChartContainer from '../shared/ChartContainer';
import DataTable from '../shared/DataTable';
import observabilityService from '../../../../services/observabilityService';
import { getDateRange } from '../../utils/dateRange';

/**
 * Groundedness Dashboard Component
 * Displays metrics about how well AI responses are grounded in knowledge base
 */
const GroundednessDashboard = ({ timeRange = '24h' }) => {
  const { data: metrics, isLoading, error, refetch } = useQuery({
    queryKey: ['groundedness-metrics', timeRange],
    queryFn: () => {
      const dateRange = getDateRange(timeRange);
      return observabilityService.getGroundednessMetrics({ 
        dateRange: `${dateRange.start},${dateRange.end}`
      });
    },
    refetchInterval: 60000 // Refresh every minute
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
          Failed to load groundedness metrics
        </Typography>
        <Typography variant="body2">
          {error.message || 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  const statMetrics = [
    {
      id: 'avg-score',
      title: 'Average Groundedness Score',
      value: metrics?.averageGroundednessScore || 0,
      unit: '',
      color: 'primary',
      icon: CheckCircle,
      subtitle: 'Higher is better (0-1 scale)'
    },
    {
      id: 'kb-usage',
      title: 'KB Usage Rate',
      value: metrics?.averageKBUsageRate || 0,
      unit: '',
      color: 'info',
      icon: TrendingUp,
      subtitle: 'Percentage of responses using KB',
      type: 'percentage'
    },
    {
      id: 'similarity',
      title: 'Average Similarity Score',
      value: metrics?.averageSimilarityScore || 0,
      unit: '',
      color: 'success',
      subtitle: 'KB result relevance (0-1)'
    },
    {
      id: 'citations',
      title: 'Total Citations',
      value: metrics?.totalCitations || 0,
      unit: '',
      color: 'secondary',
      subtitle: 'KB references used'
    },
    {
      id: 'calls-with-kb',
      title: 'Calls with KB',
      value: metrics?.callsWithKB || 0,
      unit: '',
      color: 'success',
      icon: CheckCircle
    },
    {
      id: 'calls-without-kb',
      title: 'Calls without KB',
      value: metrics?.callsWithoutKB || 0,
      unit: '',
      color: 'warning',
      icon: Cancel
    },
    {
      id: 'escalation-rate',
      title: 'Escalation Rate',
      value: metrics?.escalationRate || 0,
      unit: '',
      color: 'info',
      icon: PhoneForwarded,
      subtitle: 'Calls transferred to human',
      type: 'percentage'
    }
  ];

  const tableColumns = [
    { key: 'metric', label: 'Metric' },
    { key: 'value', label: 'Value', align: 'right' }
  ];

  const tableRows = [
    { metric: 'Total Calls', value: metrics?.totalCalls || 0 },
    { metric: 'Total Responses', value: metrics?.totalResponses || 0 },
    { metric: 'Ungrounded Responses', value: metrics?.totalUngroundedResponses || 0 },
    { metric: 'KB Coverage', value: `${((metrics?.callsWithKB || 0) / (metrics?.totalCalls || 1) * 100).toFixed(1)}%` },
    { metric: 'Escalated Calls', value: metrics?.escalatedCalls || 0 }
  ];

  return (
    <Box>
      <StatGrid metrics={statMetrics} />
      
      <Box sx={{ mt: 4 }}>
        <ChartContainer title="Groundedness Overview" subtitle={`Data for ${timeRange}`}>
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <Typography variant="h3" color="primary.main" sx={{ mb: 1 }}>
              {(metrics?.averageGroundednessScore || 0).toFixed(3)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Average Groundedness Score
            </Typography>
          </Box>
        </ChartContainer>
      </Box>

      <Box sx={{ mt: 3 }}>
        <DataTable 
          columns={tableColumns}
          rows={tableRows}
          emptyMessage="No metrics available"
        />
      </Box>
    </Box>
  );
};


export default GroundednessDashboard;

