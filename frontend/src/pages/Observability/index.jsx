import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  CircularProgress,
  Alert as MuiAlert,
  LinearProgress
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
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
  Info,
  CheckCircle,
  Cancel,
  Download,
  Visibility,
  Refresh
} from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';
import observabilityService from '../../services/observabilityService';
import MetricCard from '../../components/common/MetricCard';

const ObservabilityPage = () => {
  const [timeRange, setTimeRange] = useState('1h');
  const [logFilter, setLogFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCallSid, setSelectedCallSid] = useState(null);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [toolTracesDialogOpen, setToolTracesDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch system metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-metrics', timeRange],
    queryFn: async () => {
      const response = await observabilityService.getSystemMetrics(timeRange);
      return response.data || response;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch system logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['system-logs', logFilter],
    queryFn: async () => {
      const filters = logFilter !== 'all' ? { level: logFilter } : {};
      const response = await observabilityService.getSystemLogs(filters);
      return response.data || response;
    }
  });

  // Fetch performance metrics
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['performance-metrics', timeRange],
    queryFn: async () => {
      const response = await observabilityService.getPerformanceMetrics(timeRange);
      return response.data || response;
    }
  });

  // Fetch live calls
  const { data: liveCalls = [], isLoading: liveCallsLoading } = useQuery({
    queryKey: ['live-calls'],
    queryFn: async () => {
      const response = await observabilityService.getLiveCalls();
      return response.data || response;
    },
    refetchInterval: 10000 // Refresh every 10 seconds for live data
  });

  // Fetch error budgets
  const { data: errorBudgets, isLoading: errorBudgetsLoading } = useQuery({
    queryKey: ['error-budgets', timeRange],
    queryFn: async () => {
      const response = await observabilityService.getErrorBudgets(timeRange);
      return response.data || response;
    }
  });

  // Fetch alerts
  const { data: alertsData = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await observabilityService.getAlerts({ status: 'active' });
      return response.data || response;
    }
  });

  // Fetch call timeline
  const { data: callTimeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['call-timeline', selectedCallSid],
    queryFn: async () => {
      if (!selectedCallSid) return null;
      const response = await observabilityService.getCallTimeline(selectedCallSid);
      return response.data || response;
    },
    enabled: !!selectedCallSid && timelineDialogOpen
  });

  // Fetch tool traces
  const { data: toolTraces = [], isLoading: toolTracesLoading } = useQuery({
    queryKey: ['tool-traces', selectedCallSid],
    queryFn: async () => {
      if (!selectedCallSid) return [];
      const response = await observabilityService.getCallToolTraces(selectedCallSid);
      return response.data || response;
    },
    enabled: !!selectedCallSid && toolTracesDialogOpen
  });

  // Mutations
  const acknowledgeAlertMutation = useMutation({
    mutationFn: observabilityService.acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries(['alerts']);
    }
  });

  const resolveAlertMutation = useMutation({
    mutationFn: observabilityService.resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries(['alerts']);
    }
  });

  // Process metrics data
  const metrics = metricsData || {};
  const calls = metrics.calls || {};
  const performance = metrics.performance || {};

  // Summary metrics
  const summaryMetrics = [
    {
      title: `Total Calls (${timeRange})`,
      value: calls.total?.toLocaleString() || '0',
      icon: <Phone />,
      color: 'primary',
      change: null,
      changeType: 'neutral'
    },
    {
      title: 'Avg Latency',
      value: `${performance.avgLatency || 0}ms`,
      icon: <Speed />,
      color: 'info',
      change: null,
      changeType: 'neutral'
    },
    {
      title: 'Avg MOS Score',
      value: performance.avgMOS || '0.0',
      icon: <TrendingIcon />,
      color: 'success',
      change: null,
      changeType: 'neutral'
    },
    {
      title: 'Error Rate',
      value: calls.errorRate || '0%',
      icon: <ErrorIcon />,
      color: calls.errorRate && parseFloat(calls.errorRate) > 1 ? 'error' : 'success',
      change: null,
      changeType: 'neutral'
    }
  ];

  // Process logs for DataGrid
  const logs = (logsData || []).map((log, index) => ({
    id: log.id || `log_${index}`,
    timestamp: log.timestamp,
    level: log.level,
    component: log.context?.component || 'unknown',
    message: log.message
  }));

  // Process performance data for charts
  const hourlyData = performanceData?.hourlyData || [];
  const callVolumeData = hourlyData.map(h => ({
    time: h.time,
    calls: h.count || 0,
    errors: 0 // Would need to calculate from actual data
  }));

  const latencyData = hourlyData.map(h => ({
    time: h.time,
    avgLatency: h.avgLatency || 0,
    p95Latency: h.p95Latency || 0,
    p99Latency: h.p99Latency || 0
  }));

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'error': return 'error';
      case 'warn': return 'warning';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getLogIcon = (level) => {
    switch (level) {
      case 'error': return <ErrorIcon fontSize="small" />;
      case 'warn':
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

  const handleExport = async (format = 'json') => {
    try {
      const filters = logFilter !== 'all' ? { level: logFilter } : {};
      const exportData = await observabilityService.exportData(format, filters);
      
      if (format === 'json') {
        // exportData is already the JSON object
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `observability_export_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // exportData is already a Blob for CSV
        const url = URL.createObjectURL(exportData);
        const a = document.createElement('a');
        a.href = url;
        a.download = `observability_export_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const handleViewTimeline = (callSid) => {
    setSelectedCallSid(callSid);
    setTimelineDialogOpen(true);
  };

  const handleViewToolTraces = (callSid) => {
    setSelectedCallSid(callSid);
    setToolTracesDialogOpen(true);
  };

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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('json')}
            size="small"
          >
            Export JSON
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('csv')}
            size="small"
          >
            Export CSV
          </Button>
        </Box>
      </Paper>

      {/* Summary Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
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

      {/* Tabs for different views */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Metrics & Logs" />
          <Tab label="Live Calls" />
          <Tab label="Error Budgets" />
          <Tab label="Alerts" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
          {/* Charts Section */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Call Volume & Error Trends */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3, height: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Call Volume Trends
                </Typography>
                {performanceLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={callVolumeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="calls" fill="#1976d2" name="Total Calls" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>

            {/* Latency Metrics */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3, height: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Response Latency Distribution
                </Typography>
                {performanceLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={latencyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
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
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Error/Warning Logs */}
          <Paper>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                System Logs ({logs.length})
              </Typography>
            </Box>
            <Box sx={{ height: 400 }}>
              <DataGrid
                rows={logs}
                columns={errorLogColumns}
                loading={logsLoading}
                pageSize={10}
                rowsPerPageOptions={[5, 10, 25]}
                disableSelectionOnClick
                sx={{
                  border: 0,
                  '& .MuiDataGrid-row:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.08) !important',
                  },
                }}
              />
            </Box>
          </Paper>
        </>
      )}

      {/* Live Calls Tab */}
      {activeTab === 1 && (
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Live Calls ({liveCalls.length})
            </Typography>
          </Box>
          {liveCallsLoading ? (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : liveCalls.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No active calls</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Call SID</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Latency</TableCell>
                    <TableCell>Language</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {liveCalls.map((call) => (
                    <TableRow key={call.callSid}>
                      <TableCell>{call.callSid}</TableCell>
                      <TableCell>{call.from}</TableCell>
                      <TableCell>{call.to}</TableCell>
                      <TableCell>
                        <Chip label={call.status} size="small" color="primary" />
                      </TableCell>
                      <TableCell>{call.duration}s</TableCell>
                      <TableCell>{call.latency}ms</TableCell>
                      <TableCell>{call.language}</TableCell>
                      <TableCell>
                        <Tooltip title="View Timeline">
                          <IconButton size="small" onClick={() => handleViewTimeline(call.callSid)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Tool Traces">
                          <IconButton size="small" onClick={() => handleViewToolTraces(call.callSid)}>
                            <Info fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Error Budgets Tab */}
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Error Budgets
          </Typography>
          {errorBudgetsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : errorBudgets ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Call Statistics</Typography>
                  <Typography>Total: {errorBudgets.calls?.total || 0}</Typography>
                  <Typography>Successful: {errorBudgets.calls?.successful || 0}</Typography>
                  <Typography>Failed: {errorBudgets.calls?.failed || 0}</Typography>
                  <Typography>Error Rate: {errorBudgets.calls?.errorRate || '0%'}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Error Budget</Typography>
                  <Typography>Target: {errorBudgets.errorBudget?.target || '1%'}</Typography>
                  <Typography>Current: {errorBudgets.errorBudget?.current || '0%'}</Typography>
                  <Typography>Remaining: {errorBudgets.errorBudget?.remaining || '1%'}</Typography>
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={parseFloat(errorBudgets.errorBudget?.consumed || '0')}
                      color={errorBudgets.errorBudget?.status === 'exceeded' ? 'error' : 'success'}
                    />
                  </Box>
                  <Chip
                    label={errorBudgets.errorBudget?.status === 'exceeded' ? 'Exceeded' : 'Within Budget'}
                    color={errorBudgets.errorBudget?.status === 'exceeded' ? 'error' : 'success'}
                    sx={{ mt: 1 }}
                  />
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Typography color="text.secondary">No error budget data available</Typography>
          )}
        </Paper>
      )}

      {/* Alerts Tab */}
      {activeTab === 3 && (
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Active Alerts ({alertsData.length})
            </Typography>
          </Box>
          {alertsLoading ? (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : alertsData.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No active alerts</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Severity</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Component</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alertsData.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <Chip
                          label={alert.severity}
                          color={alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{alert.title}</TableCell>
                      <TableCell>{alert.message}</TableCell>
                      <TableCell>{alert.component}</TableCell>
                      <TableCell>{formatDateTime(alert.createdAt)}</TableCell>
                      <TableCell>
                        {alert.status === 'active' && (
                          <>
                            <Tooltip title="Acknowledge">
                              <IconButton
                                size="small"
                                onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                              >
                                <CheckCircle fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Resolve">
                              <IconButton
                                size="small"
                                onClick={() => resolveAlertMutation.mutate(alert.id)}
                              >
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Timeline Dialog */}
      <Dialog open={timelineDialogOpen} onClose={() => setTimelineDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Call Timeline - {selectedCallSid}</DialogTitle>
        <DialogContent>
          {timelineLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : callTimeline ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Summary: {callTimeline.summary?.totalEvents || 0} events
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {callTimeline.timeline?.map((event, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDateTime(event.timestamp)}</TableCell>
                        <TableCell>
                          <Chip label={event.type} size="small" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {JSON.stringify(event.data, null, 2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Typography>No timeline data available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimelineDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Tool Traces Dialog */}
      <Dialog open={toolTracesDialogOpen} onClose={() => setToolTracesDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Tool Traces - {selectedCallSid}</DialogTitle>
        <DialogContent>
          {toolTracesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : toolTraces.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Tool</TableCell>
                    <TableCell>Execution Time</TableCell>
                    <TableCell>Success</TableCell>
                    <TableCell>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {toolTraces.map((trace, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDateTime(trace.timestamp)}</TableCell>
                      <TableCell>{trace.toolName}</TableCell>
                      <TableCell>{trace.executionTime}ms</TableCell>
                      <TableCell>
                        <Chip
                          label={trace.success ? 'Yes' : 'No'}
                          color={trace.success ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{trace.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography>No tool traces available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToolTracesDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ObservabilityPage;
