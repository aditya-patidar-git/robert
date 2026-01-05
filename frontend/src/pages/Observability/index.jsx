import React from 'react';
import {
  Typography,
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import { Download } from '@mui/icons-material';
import MetricCard from '../../components/common/MetricCard';
import { useObservabilityState } from './hooks/useObservabilityState';
import MetricsLogsTab from './tabs/MetricsLogsTab';
import LiveCallsTab from './tabs/LiveCallsTab';
import ErrorBudgetsTab from './tabs/ErrorBudgetsTab';
import AlertsTab from './tabs/AlertsTab';
import TimelineDialog from './components/TimelineDialog';
import ToolTracesDialog from './components/ToolTracesDialog';
import GroundednessDashboard from './components/dashboards/GroundednessDashboard';
import RAGAnalytics from './components/dashboards/RAGAnalytics';
import ToolPerformanceDashboard from './components/dashboards/ToolPerformanceDashboard';
import SIPAnalyticsDashboard from './components/dashboards/SIPAnalyticsDashboard';
import VoiceInsightsDashboard from './components/dashboards/VoiceInsightsDashboard';
import TraceViewer from './components/dashboards/TraceViewer';
import ErrorBudgetDashboard from './components/dashboards/ErrorBudgetDashboard';

const ObservabilityPage = () => {
  const {
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
    summaryMetrics,
    logs,
    callVolumeData,
    latencyData,
    liveCalls,
    liveCallsLoading,
    errorBudgets,
    errorBudgetsLoading,
    alertsData,
    alertsLoading,
    callTimeline,
    timelineLoading,
    toolTraces,
    toolTracesLoading,
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
  } = useObservabilityState();

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1"
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '1.75rem', md: '2rem' },
            color: 'text.primary',
            mb: 1
          }}
        >
          System Observability
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.9375rem'
          }}
        >
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
            disabled={exportLoading}
          >
            Export JSON
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('csv')}
            size="small"
            disabled={exportLoading}
          >
            Export CSV
          </Button>
        </Box>
      </Paper>

      {/* Summary Metrics */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)'
          },
          gap: 3,
          mb: 4
        }}
      >
        {summaryMetrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            color={metric.color}
            change={metric.change}
            changeType={metric.changeType}
            loading={metricsLoading}
          />
        ))}
      </Box>

      {/* Tabs for different views */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3,
          borderRadius: 2
        }}
      >
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Metrics & Logs" />
          <Tab label="Live Calls" />
          <Tab label="Groundedness" />
          <Tab label="RAG Analytics" />
          <Tab label="Tool Performance" />
          <Tab label="SIP Analytics" />
          <Tab label="Voice Quality" />
          <Tab label="Traces" />
          <Tab label="Error Budgets" />
          <Tab label="Alerts" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <MetricsLogsTab
          performanceLoading={performanceLoading}
          logsLoading={logsLoading}
          callVolumeData={callVolumeData}
          latencyData={latencyData}
          logs={logs}
          errorLogColumns={errorLogColumns}
          getLogLevelColor={getLogLevelColor}
          getLogIcon={getLogIcon}
        />
      )}

      {/* Live Calls Tab */}
      {activeTab === 1 && (
        <LiveCallsTab
          liveCalls={liveCalls}
          liveCallsLoading={liveCallsLoading}
          handleViewTimeline={handleViewTimeline}
          handleViewToolTraces={handleViewToolTraces}
        />
      )}

      {/* Groundedness Tab */}
      {activeTab === 2 && (
        <Box sx={{ p: 3 }}>
          <GroundednessDashboard timeRange={timeRange} />
        </Box>
      )}

      {/* RAG Analytics Tab */}
      {activeTab === 3 && (
        <Box sx={{ p: 3 }}>
          <RAGAnalytics timeRange={timeRange} />
        </Box>
      )}

      {/* Tool Performance Tab */}
      {activeTab === 4 && (
        <Box sx={{ p: 3 }}>
          <ToolPerformanceDashboard timeRange={timeRange} />
        </Box>
      )}

      {/* SIP Analytics Tab */}
      {activeTab === 5 && (
        <Box sx={{ p: 3 }}>
          <SIPAnalyticsDashboard timeRange={timeRange} />
        </Box>
      )}

      {/* Voice Quality Tab */}
      {activeTab === 6 && (
        <Box sx={{ p: 3 }}>
          <VoiceInsightsDashboard timeRange={timeRange} />
        </Box>
      )}

      {/* Traces Tab */}
      {activeTab === 7 && (
        <Box sx={{ p: 3 }}>
          <TraceViewer 
            timeRange={timeRange} 
            onCallSelect={handleViewTimeline}
          />
        </Box>
      )}

      {/* Error Budgets Tab */}
      {activeTab === 8 && (
        <Box sx={{ p: 3 }}>
          <ErrorBudgetDashboard timeRange={timeRange} />
        </Box>
      )}

      {/* Alerts Tab */}
      {activeTab === 9 && (
        <AlertsTab
          alertsData={alertsData}
          alertsLoading={alertsLoading}
          acknowledgeAlertMutation={acknowledgeAlertMutation}
          resolveAlertMutation={resolveAlertMutation}
        />
      )}

      {/* Timeline Dialog */}
      <TimelineDialog
        open={timelineDialogOpen}
        onClose={handleCloseTimelineDialog}
        selectedCallSid={selectedCallSid}
        callTimeline={callTimeline}
        timelineLoading={timelineLoading}
      />

      {/* Tool Traces Dialog */}
      <ToolTracesDialog
        open={toolTracesDialogOpen}
        onClose={handleCloseToolTracesDialog}
        selectedCallSid={selectedCallSid}
        toolTraces={toolTraces}
        toolTracesLoading={toolTracesLoading}
      />
    </Box>
  );
};

export default ObservabilityPage;
