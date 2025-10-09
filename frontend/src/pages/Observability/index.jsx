import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import {
  TrendingUp as TrendingIcon,
  Speed,
  Phone,
  Error as ErrorIcon,
  Warning,
  Info
} from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';
import observabilityService from '../../services/observabilityService';
import MetricCard from '../../components/common/MetricCard';

const ObservabilityPage = () => {
  const [timeRange, setTimeRange] = useState('1h');
  const [logFilter, setLogFilter] = useState('all');

  // Fetch system metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-metrics', timeRange],
    queryFn: () => observabilityService.getSystemMetrics(timeRange)
  });

  // Fetch error logs
  const { data: errorLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['error-logs', logFilter],
    queryFn: () => observabilityService.getSystemLogs({ level: logFilter })
  });

  // Fetch performance metrics
  const { data: performanceData = [], isLoading: performanceLoading } = useQuery({
    queryKey: ['performance-metrics', timeRange],
    queryFn: () => observabilityService.getPerformanceMetrics({ timeRange })
  });

  // Mock data for charts
  const mockCallVolumeData = [
    { time: '00:00', calls: 12, errors: 0 },
    { time: '04:00', calls: 8, errors: 1 },
    { time: '08:00', calls: 24, errors: 2 },
    { time: '12:00', calls: 35, errors: 1 },
    { time: '16:00', calls: 28, errors: 3 },
    { time: '20:00', calls: 18, errors: 0 },
  ];

  const mockLatencyData = [
    { time: '00:00', avgLatency: 120, p95Latency: 180, p99Latency: 250 },
    { time: '04:00', avgLatency: 115, p95Latency: 170, p99Latency: 240 },
    { time: '08:00', avgLatency: 140, p95Latency: 200, p99Latency: 300 },
    { time: '12:00', avgLatency: 160, p95Latency: 220, p99Latency: 350 },
    { time: '16:00', avgLatency: 145, p95Latency: 210, p99Latency: 320 },
    { time: '20:00', avgLatency: 125, p95Latency: 185, p99Latency: 260 },
  ];

  // Mock error/warning logs
  const mockErrorLogs = [
    {
      id: 'log_001',
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Twilio API rate limit exceeded',
      component: 'telephony-service',
      details: 'Rate limit of 1000 calls/hour exceeded'
    },
    {
      id: 'log_002',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      level: 'warning',
      message: 'High latency detected in AI service',
      component: 'ai-service',
      details: 'Average response time: 2.5s'
    },
    {
      id: 'log_003',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      level: 'error',
      message: 'Database connection timeout',
      component: 'database',
      details: 'Connection to MongoDB timed out after 10s'
    },
    {
      id: 'log_004',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      level: 'info',
      message: 'System backup completed successfully',
      component: 'backup-service',
      details: 'Daily backup completed in 45 minutes'
    }
  ];

  // Summary metrics
  const summaryMetrics = [
    {
      title: 'Total Calls (24h)',
      value: '1,247',
      icon: <Phone />,
      color: 'primary',
      change: '+8%',
      changeType: 'positive'
    },
    {
      title: 'Avg Latency',
      value: '142ms',
      icon: <Speed />,
      color: 'info',
      change: '+12ms',
      changeType: 'negative'
    },
    {
      title: 'Avg MOS Score',
      value: '4.3',
      icon: <TrendingIcon />,
      color: 'success',
      change: '+1',
      changeType: 'positive'
    },
    {
      title: 'Error Rate',
      value: '0.8%',
      icon: <ErrorIcon />,
      color: 'error',
      change: '2%',
      changeType: 'positive'
    }
  ];

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getLogIcon = (level) => {
    switch (level) {
      case 'error': return <ErrorIcon fontSize="small" />;
      case 'warning': return <Warning fontSize="small" />;
      case 'info': return <Info fontSize="small" />;
      default: return null;
    }
  };

  const errorLogColumns = [
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 180,
      renderCell: (params) => formatDateTime(params.value)
    },
    {
      field: 'level',
      headerName: 'Level',
      width: 100,
      renderCell: (params) => (
        <Chip
          icon={getLogIcon(params.value)}
          label={params.value}
          color={getLogLevelColor(params.value)}
          size="small"
          variant="filled"
        />
      )
    },
    {
      field: 'component',
      headerName: 'Component',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'message',
      headerName: 'Message',
      width: 300,
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value}
        </Typography>
      )
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          System Observability
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor system health, performance metrics, and error logs
        </Typography>
      </Box>

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="6h">Last 6 Hours</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Log Level</InputLabel>
            <Select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              label="Log Level"
            >
              <MenuItem value="all">All Logs</MenuItem>
              <MenuItem value="error">Errors Only</MenuItem>
              <MenuItem value="warning">Warnings Only</MenuItem>
              <MenuItem value="info">Info Only</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Summary Metrics */}
      <Grid container spacing={3} sx={{ mb: 4, justifyContent: "space-between" }}>
        {summaryMetrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <MetricCard
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              change={metric.change}
              changeType={metric.changeType}
              loading={metricsLoading}
            />
          </Grid>
        ))}
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Call Volume & Error Trends */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Call Volume & Error Trends
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockCallVolumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="calls" fill="#1976d2" name="Total Calls" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="errors"
                  stroke="#d32f2f"
                  strokeWidth={3}
                  name="Errors"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Latency Metrics */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Response Latency Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockLatencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgLatency"
                  stroke="#1976d2"
                  strokeWidth={2}
                  name="Average"
                />
                <Line
                  type="monotone"
                  dataKey="p95Latency"
                  stroke="#ff9800"
                  strokeWidth={2}
                  name="95th Percentile"
                />
                <Line
                  type="monotone"
                  dataKey="p99Latency"
                  stroke="#d32f2f"
                  strokeWidth={2}
                  name="99th Percentile"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Error/Warning Logs */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            System Logs ({mockErrorLogs.length})
          </Typography>
        </Box>
        <Box sx={{ height: 400 }}>
          <DataGrid
            rows={mockErrorLogs}
            columns={errorLogColumns}
            loading={logsLoading}
            pageSize={10}
            rowsPerPageOptions={[5, 10, 25]}
            disableSelectionOnClick
            sx={{
              border: 0,
              backgroundColor: 'white',
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
                backgroundColor: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.08) !important',
                },
                '&:nth-of-type(even)': {
                  backgroundColor: 'white',
                },
                '&:nth-of-type(odd)': {
                  backgroundColor: 'white',
                },
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.08) !important',
              },
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
                backgroundColor: 'transparent',
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'white',
                borderBottom: '2px solid',
                borderBottomColor: 'primary.main',
                '& .MuiDataGrid-columnHeader': {
                  backgroundColor: 'white',
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 'bold',
                  color: 'text.primary',
                },
              },
              '& .MuiDataGrid-footerContainer': {
                backgroundColor: 'white',
                borderTop: '1px solid',
                borderTopColor: 'divider',
              },
              '& .MuiDataGrid-toolbarContainer': {
                backgroundColor: 'white',
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
              },
            }}
          />
        </Box>
      </Paper>
    </Container>
  );
};

export default ObservabilityPage;