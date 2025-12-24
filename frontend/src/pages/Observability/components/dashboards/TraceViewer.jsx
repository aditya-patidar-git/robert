import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Button,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton
} from '@mui/material';
import { ExpandMore, Search, Refresh, Timeline } from '@mui/icons-material';
import { formatDateTime } from '../../../../utils/formatters';
import observabilityService from '../../../../services/observabilityService';
import { getDateRange } from '../../utils/dateRange';

/**
 * Trace Viewer Component
 * Displays OpenTelemetry trace timelines for calls
 */
const TraceViewer = ({ timeRange = '24h', onCallSelect = null }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCall, setExpandedCall] = useState(null);

  const { data: traces, isLoading, error, refetch } = useQuery({
    queryKey: ['traces', timeRange, searchTerm],
    queryFn: () => {
      const dateRange = getDateRange(timeRange);
      const filters = { dateRange: `${dateRange.start},${dateRange.end}` };
      if (searchTerm) {
        return observabilityService.getTraces({ search: searchTerm, ...filters });
      }
      return observabilityService.getTraces(filters);
    },
    refetchInterval: 30000
  });

  const handleCallClick = (callSid) => {
    if (onCallSelect) {
      onCallSelect(callSid);
    } else {
      setExpandedCall(expandedCall === callSid ? null : callSid);
    }
  };

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
          Failed to load traces
        </Typography>
        <Typography variant="body2">
          {error.message || 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  const traceList = traces || [];

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by Call SID, phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {traceList.length === 0 ? (
        <Alert severity="info">
          No traces found for the selected time range.
        </Alert>
      ) : (
        <Box>
          {traceList.map((trace) => (
            <Accordion
              key={trace.callSid}
              expanded={expandedCall === trace.callSid}
              onChange={() => handleCallClick(trace.callSid)}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Timeline color="primary" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {trace.callSid}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(trace.callStartTime)} - {formatDateTime(trace.callEndTime)}
                    </Typography>
                  </Box>
                  <Chip
                    label={trace.status}
                    size="small"
                    color={
                      trace.status === 'completed' ? 'success' :
                      trace.status === 'in-progress' ? 'info' :
                      trace.status === 'failed' ? 'error' : 'default'
                    }
                  />
                  <Chip
                    label={trace.entryPath}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <TraceTimeline trace={trace} />
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * Trace Timeline Component
 * Displays events in a timeline format
 */
const TraceTimeline = ({ trace }) => {
  const events = trace.events || [];
  const metrics = trace.metrics || {};

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Metrics
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip label={`Total Events: ${metrics.totalEvents || 0}`} size="small" />
          <Chip label={`Tool Executions: ${metrics.toolExecutions || 0}`} size="small" />
          <Chip label={`KB Queries: ${metrics.kbQueries || 0}`} size="small" />
          <Chip label={`Transcript Entries: ${metrics.transcriptEntries || 0}`} size="small" />
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Event Timeline
        </Typography>
        {events.map((event, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              gap: 2,
              mb: 2,
              pb: 2,
              borderBottom: index < events.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(event.timestamp)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip
                  label={event.type}
                  size="small"
                  color={
                    event.type.includes('error') ? 'error' :
                    event.type.includes('tool') ? 'primary' :
                    event.type.includes('kb') ? 'info' : 'default'
                  }
                />
                <Typography variant="body2" color="text.secondary">
                  {event.service}
                </Typography>
              </Box>
              {event.details && (
                <Box sx={{ pl: 2, mt: 0.5 }}>
                  {Object.entries(event.details).map(([key, value]) => (
                    <Typography key={key} variant="caption" color="text.secondary" display="block">
                      <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : value}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};


export default TraceViewer;

