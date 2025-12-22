import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, Chip } from '@mui/material';
import { Search, TrendingUp } from '@mui/icons-material';
import StatGrid from '../shared/StatGrid';
import ChartContainer from '../shared/ChartContainer';
import DataTable from '../shared/DataTable';
import observabilityService from '../../../../services/observabilityService';
import { getDateRange } from '../../utils/dateRange';

/**
 * RAG Analytics Dashboard Component
 * Displays Retrieval-Augmented Generation analytics
 */
const RAGAnalytics = ({ timeRange = '24h' }) => {
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['rag-analytics', timeRange],
    queryFn: () => observabilityService.getRAGAnalytics({ 
      dateRange: getDateRange(timeRange) 
    }),
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
        Failed to load RAG analytics: {error.message}
      </Alert>
    );
  }

  const statMetrics = [
    {
      id: 'total-queries',
      title: 'Total KB Queries',
      value: analytics?.totalKBQueries || 0,
      unit: '',
      color: 'primary',
      icon: Search
    },
    {
      id: 'avg-similarity',
      title: 'Avg Similarity Score',
      value: analytics?.averageSimilarityScore || 0,
      unit: '',
      color: 'success',
      icon: TrendingUp,
      subtitle: 'Higher is better'
    },
    {
      id: 'avg-results',
      title: 'Avg Results per Query',
      value: analytics?.averageResultsPerQuery || 0,
      unit: '',
      color: 'info',
      subtitle: 'Average number of results'
    },
    {
      id: 'queries-with-results',
      title: 'Queries with Results',
      value: analytics?.queriesWithResults || 0,
      unit: '',
      color: 'success'
    },
    {
      id: 'queries-without-results',
      title: 'Queries without Results',
      value: analytics?.queriesWithoutResults || 0,
      unit: '',
      color: 'warning'
    }
  ];

  const similarityColumns = [
    { key: 'category', label: 'Similarity Category' },
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
        const total = (analytics?.similarityDistribution?.high || 0) +
                     (analytics?.similarityDistribution?.medium || 0) +
                     (analytics?.similarityDistribution?.low || 0);
        const pct = total > 0 ? (value / total * 100).toFixed(1) : 0;
        return `${pct}%`;
      }
    }
  ];

  const similarityRows = [
    { 
      category: 'High (>0.8)', 
      count: analytics?.similarityDistribution?.high || 0,
      percentage: analytics?.similarityDistribution?.high || 0
    },
    { 
      category: 'Medium (0.5-0.8)', 
      count: analytics?.similarityDistribution?.medium || 0,
      percentage: analytics?.similarityDistribution?.medium || 0
    },
    { 
      category: 'Low (<0.5)', 
      count: analytics?.similarityDistribution?.low || 0,
      percentage: analytics?.similarityDistribution?.low || 0
    }
  ];

  const topFilesColumns = [
    { key: 'file', label: 'File' },
    { 
      key: 'count', 
      label: 'Usage Count', 
      align: 'right',
      render: (value) => value.toLocaleString()
    }
  ];

  return (
    <Box>
      <StatGrid metrics={statMetrics} />
      
      <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <ChartContainer title="Similarity Distribution" subtitle="KB query result quality">
          <DataTable 
            columns={similarityColumns}
            rows={similarityRows}
            emptyMessage="No similarity data available"
          />
        </ChartContainer>

        <ChartContainer title="Top Files" subtitle="Most frequently referenced KB files">
          <DataTable 
            columns={topFilesColumns}
            rows={analytics?.topFiles || []}
            emptyMessage="No file usage data available"
            getRowKey={(row, index) => row.file || index}
          />
        </ChartContainer>
      </Box>
    </Box>
  );
};


export default RAGAnalytics;

