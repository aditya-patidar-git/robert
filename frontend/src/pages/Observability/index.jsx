import React from 'react';
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

      {/* Error Budgets Tab */}
      {activeTab === 2 && (
        <ErrorBudgetsTab
          errorBudgets={errorBudgets}
          errorBudgetsLoading={errorBudgetsLoading}
        />
      )}

      {/* Alerts Tab */}
      {activeTab === 3 && (
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
    </Container>
  );
};

export default ObservabilityPage;
