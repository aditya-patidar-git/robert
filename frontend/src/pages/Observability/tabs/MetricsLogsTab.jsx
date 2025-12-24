import React from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Chip
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
  Error as ErrorIcon,
  Warning,
  Info
} from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

const MetricsLogsTab = ({
  performanceLoading,
  logsLoading,
  callVolumeData,
  latencyData,
  logs,
  errorLogColumns,
  getLogLevelColor,
  getLogIcon
}) => {
  const getLogIconComponent = (level) => {
    switch (level) {
      case 'error': return <ErrorIcon fontSize="small" />;
      case 'warn':
      case 'warning': return <Warning fontSize="small" />;
      case 'info': return <Info fontSize="small" />;
      default: return null;
    }
  };

  const columnsWithRenderers = errorLogColumns.map(col => {
    if (col.field === 'timestamp') {
      return {
        ...col,
        renderCell: (params) => formatDateTime(params.value)
      };
    }
    if (col.field === 'level') {
      return {
        ...col,
        renderCell: (params) => (
          <Chip
            icon={getLogIconComponent(params.value)}
            label={params.value}
            color={getLogLevelColor(params.value)}
            size="small"
            variant="filled"
          />
        )
      };
    }
    if (col.field === 'component') {
      return {
        ...col,
        renderCell: (params) => (
          <Typography variant="body2" fontFamily="monospace">
            {params.value}
          </Typography>
        )
      };
    }
    if (col.field === 'message') {
      return {
        ...col,
        renderCell: (params) => (
          <Typography variant="body2">
            {params.value}
          </Typography>
        )
      };
    }
    return col;
  });

  return (
    <>
      {/* Charts Section */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, mb: 4 }}>
        {/* Call Volume & Error Trends */}
        <Box sx={{ width: { xs: '100%', lg: '50%' }, minWidth: 0 }}>
          <Paper sx={{ p: 3, height: { xs: 300, md: 400, lg: 450 } }}>
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
                  <Bar dataKey="errors" fill="#d32f2f" name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Box>

        {/* Latency Metrics */}
        <Box sx={{ width: { xs: '100%', lg: '50%' }, minWidth: 0 }}>
          <Paper sx={{ p: 3, height: { xs: 300, md: 400, lg: 450 } }}>
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
        </Box>
      </Box>

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
            columns={columnsWithRenderers}
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
  );
};

export default MetricsLogsTab;


