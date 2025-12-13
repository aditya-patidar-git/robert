import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  Speed,
  TrendingUp as TrendingIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import observabilityService from '../../../services/observabilityService';
import { useToast } from '../../../components/common/ToastProvider';

export const useObservabilityState = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [timeRange, setTimeRange] = useState('1h');
  const [logFilter, setLogFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCallSid, setSelectedCallSid] = useState(null);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [toolTracesDialogOpen, setToolTracesDialogOpen] = useState(false);

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
      showSuccess('Alert acknowledged successfully');
    },
    onError: (error) => {
      console.error('Error acknowledging alert:', error);
      showError(error?.response?.data?.error || error?.message || 'Failed to acknowledge alert');
    }
  });

  const resolveAlertMutation = useMutation({
    mutationFn: observabilityService.resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries(['alerts']);
      showSuccess('Alert resolved successfully');
    },
    onError: (error) => {
      console.error('Error resolving alert:', error);
      showError(error?.response?.data?.error || error?.message || 'Failed to resolve alert');
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
    errors: h.errors || 0
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
    // This will be handled in the component that uses it
    return level;
  };

  const errorLogColumns = [
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 180
    },
    {
      field: 'level',
      headerName: 'Level',
      width: 100
    },
    {
      field: 'component',
      headerName: 'Component',
      width: 150
    },
    {
      field: 'message',
      headerName: 'Message',
      width: 300,
      flex: 1
    }
  ];

  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async (format = 'json') => {
    setExportLoading(true);
    try {
      const filters = logFilter !== 'all' ? { level: logFilter } : {};
      const exportResult = await observabilityService.exportData(format, filters);
      
      if (format === 'json') {
        // Backend returns: { format: 'json', data: {...}, filename: '...' }
        // Extract the data object for JSON export
        const jsonData = exportResult?.data || exportResult;
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportResult?.filename || `observability_export_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess(`JSON export downloaded successfully`);
      } else {
        // For CSV, backend returns text in response.data
        // Convert text to Blob
        const csvText = typeof exportResult === 'string' ? exportResult : exportResult?.data || '';
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportResult?.filename || `observability_export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess(`CSV export downloaded successfully`);
      }
    } catch (error) {
      console.error('Export error:', error);
      showError(error?.response?.data?.error || error?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExportLoading(false);
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

  const handleCloseTimelineDialog = () => {
    setTimelineDialogOpen(false);
    setSelectedCallSid(null);
  };

  const handleCloseToolTracesDialog = () => {
    setToolTracesDialogOpen(false);
    setSelectedCallSid(null);
  };

  return {
    timeRange,
    setTimeRange,
    logFilter,
    setLogFilter,
    activeTab,
    setActiveTab,
    selectedCallSid,
    timelineDialogOpen,
    toolTracesDialogOpen,
    metricsLoading,
    logsLoading,
    performanceLoading,
    liveCallsLoading,
    errorBudgetsLoading,
    alertsLoading,
    timelineLoading,
    toolTracesLoading,
    summaryMetrics,
    logs,
    callVolumeData,
    latencyData,
    liveCalls,
    errorBudgets,
    alertsData,
    callTimeline,
    toolTraces,
    getLogLevelColor,
    getLogIcon,
    errorLogColumns,
    acknowledgeAlertMutation,
    resolveAlertMutation,
    handleExport,
    exportLoading,
    handleViewTimeline,
    handleViewToolTraces,
    handleCloseTimelineDialog,
    handleCloseToolTracesDialog
  };
};

