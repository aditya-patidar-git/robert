import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Refresh,
  TrendingUp,
  TrendingDown,
  SignalCellularAlt,
  Speed,
  NetworkCheck,
  Assessment
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import StatGrid from '../shared/StatGrid';
import ChartContainer from '../shared/ChartContainer';
import observabilityService from '../../../../services/observabilityService';

const COLORS = {
  excellent: '#4caf50',
  good: '#8bc34a',
  fair: '#ff9800',
  poor: '#f44336'
};

/**
 * Voice Insights Dashboard Component
 * Displays call quality metrics, MOS trends, latency distribution, SLO gauges, and alerts
 */
const VoiceInsightsDashboard = ({ timeRange = '24h' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString()
  });

  // Fetch aggregated metrics
  const { data: metricsData, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useQuery({
    queryKey: ['voice-insights', dateRange.startDate, dateRange.endDate],
    queryFn: () => observabilityService.getVoiceInsights(dateRange.startDate, dateRange.endDate),
    enabled: !!dateRange.startDate && !!dateRange.endDate,
    refetchInterval: 60000
  });

  // Fetch SLO compliance
  const { data: sloData, isLoading: sloLoading, error: sloError, refetch: refetchSLO } = useQuery({
    queryKey: ['voice-insights-slo', selectedPeriod],
    queryFn: () => observabilityService.getVoiceInsightsSLO(selectedPeriod),
    refetchInterval: 60000
  });

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    const now = new Date();
    let hours = 24;
    
    switch (period) {
      case '1h':
        hours = 1;
        break;
      case '24h':
        hours = 24;
        break;
      case '7d':
        hours = 24 * 7;
        break;
      case '30d':
        hours = 24 * 30;
        break;
    }
    
    setDateRange({
      startDate: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(),
      endDate: now.toISOString()
    });
  };

  if (metricsLoading || sloLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (metricsError || sloError) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              refetchMetrics();
              refetchSLO();
            }}
            startIcon={<Refresh />}
          >
            Retry
          </Button>
        }
      >
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Failed to load voice insights
        </Typography>
        <Typography variant="body2">
          {(metricsError || sloError)?.message || 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  const summary = metricsData?.summary || {};
  const metrics = metricsData?.data || [];
  const slos = sloData?.slos || {};

  // Prepare chart data
  const mosTrendData = metrics.map(m => ({
    period: new Date(m.period).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric' 
    }),
    mos: m.avgMOS,
    min: m.minMOS,
    max: m.maxMOS
  }));

  const latencyData = metrics.map(m => ({
    period: new Date(m.period).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric' 
    }),
    avg: m.avgLatency,
    p50: m.p50Latency,
    p95: m.p95Latency,
    p99: m.p99Latency
  }));

  const jitterPacketLossData = metrics.map(m => ({
    period: new Date(m.period).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric' 
    }),
    jitter: m.avgJitter,
    packetLoss: m.avgPacketLoss
  }));

  // Quality distribution data
  const qualityDistribution = metrics.length > 0
    ? Object.entries(metrics[metrics.length - 1]?.qualityDistribution || {})
        .map(([quality, percentage]) => ({
          name: quality.charAt(0).toUpperCase() + quality.slice(1),
          value: percentage,
          color: COLORS[quality]
        }))
    : [];

  const statMetrics = [
    {
      id: 'avg-mos',
      title: 'Average MOS Score',
      value: summary.avgMOS || 0,
      unit: '/5.0',
      color: summary.avgMOS >= 4.0 ? 'success' : summary.avgMOS >= 3.5 ? 'info' : 'warning',
      icon: SignalCellularAlt,
      subtitle: 'Mean Opinion Score'
    },
    {
      id: 'avg-latency',
      title: 'Average Latency',
      value: summary.avgLatency || 0,
      unit: 'ms',
      color: summary.avgLatency < 200 ? 'success' : summary.avgLatency < 300 ? 'warning' : 'error',
      icon: Speed,
      subtitle: 'One-way delay'
    },
    {
      id: 'avg-jitter',
      title: 'Average Jitter',
      value: summary.avgJitter || 0,
      unit: 'ms',
      color: 'info',
      icon: NetworkCheck,
      subtitle: 'Packet delay variation'
    },
    {
      id: 'avg-packet-loss',
      title: 'Average Packet Loss',
      value: summary.avgPacketLoss || 0,
      unit: '%',
      color: summary.avgPacketLoss < 1 ? 'success' : summary.avgPacketLoss < 5 ? 'warning' : 'error',
      icon: Assessment,
      subtitle: 'Packet loss percentage'
    }
  ];

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Period</InputLabel>
              <Select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                label="Period"
              >
                <MenuItem value="1h">Last Hour</MenuItem>
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => {
                refetchMetrics();
                refetchSLO();
              }}
              fullWidth
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Stats */}
      <StatGrid metrics={statMetrics} />

      {/* SLO Compliance Gauges */}
      <Paper sx={{ p: 3, mt: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          SLO Compliance
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">MOS &gt; 3.5</Typography>
                <Chip
                  label={`${slos.mos?.compliance?.toFixed(1) || 0}%`}
                  color={slos.mos?.compliance >= 99.9 ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={slos.mos?.compliance || 0}
                color={slos.mos?.compliance >= 99.9 ? 'success' : 'warning'}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" mt={0.5}>
                {slos.mos?.compliant || 0} / {slos.mos?.total || 0} calls compliant
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Latency &lt; 200ms</Typography>
                <Chip
                  label={`${slos.latency?.compliance?.toFixed(1) || 0}%`}
                  color={slos.latency?.compliance >= 99.9 ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={slos.latency?.compliance || 0}
                color={slos.latency?.compliance >= 99.9 ? 'success' : 'warning'}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" mt={0.5}>
                {slos.latency?.compliant || 0} / {slos.latency?.total || 0} calls compliant
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Packet Loss &lt; 5%</Typography>
                <Chip
                  label={`${slos.packetLoss?.compliance?.toFixed(1) || 0}%`}
                  color={slos.packetLoss?.compliance >= 99.9 ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={slos.packetLoss?.compliance || 0}
                color={slos.packetLoss?.compliance >= 99.9 ? 'success' : 'warning'}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" mt={0.5}>
                {slos.packetLoss?.compliant || 0} / {slos.packetLoss?.total || 0} calls compliant
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* MOS Trend Chart */}
        <Grid size={{ xs: 12, md: 3 }}>
          <ChartContainer title="MOS Score Trend">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mosTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="mos"
                  stroke="#1976d2"
                  strokeWidth={2}
                  name="Average MOS"
                />
                <Line
                  type="monotone"
                  dataKey="min"
                  stroke="#90caf9"
                  strokeDasharray="5 5"
                  name="Min MOS"
                />
                <Line
                  type="monotone"
                  dataKey="max"
                  stroke="#42a5f5"
                  strokeDasharray="5 5"
                  name="Max MOS"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Grid>

        {/* Quality Distribution */}
        <Grid size={{ xs: 12, md: 3 }}>
          <ChartContainer title="Call Quality Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={qualityDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {qualityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Grid>

        {/* Latency Distribution */}
        <Grid size={{ xs: 12, md: 3 }}>
          <ChartContainer title="Latency Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#1976d2"
                  strokeWidth={2}
                  name="Average"
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#4caf50"
                  strokeDasharray="5 5"
                  name="P50"
                />
                <Line
                  type="monotone"
                  dataKey="p95"
                  stroke="#ff9800"
                  strokeDasharray="5 5"
                  name="P95"
                />
                <Line
                  type="monotone"
                  dataKey="p99"
                  stroke="#f44336"
                  strokeDasharray="5 5"
                  name="P99"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Grid>

        {/* Jitter & Packet Loss */}
        <Grid size={{ xs: 12, md: 3 }}>
          <ChartContainer title="Jitter & Packet Loss">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={jitterPacketLossData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="jitter"
                  stroke="#9c27b0"
                  strokeWidth={2}
                  name="Jitter (ms)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="packetLoss"
                  stroke="#e91e63"
                  strokeWidth={2}
                  name="Packet Loss (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VoiceInsightsDashboard;

