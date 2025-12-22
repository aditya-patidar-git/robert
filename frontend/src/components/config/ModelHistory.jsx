import React from 'react';
import { Box, Paper, Typography, Chip, Alert } from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';
import { CheckCircle, Error as ErrorIcon, Info, Warning } from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';

/**
 * ModelHistory Component
 * Timeline visualization for model history
 */
const ModelHistory = ({ history = [], modelId }) => {
  if (!history || history.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No history available for this model
        </Typography>
      </Paper>
    );
  }

  const getEventIcon = (status) => {
    switch (status) {
      case 'available':
        return <CheckCircle color="success" />;
      case 'deprecated':
        return <Warning color="warning" />;
      case 'removed':
        return <ErrorIcon color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  const getEventColor = (status) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'deprecated':
        return 'warning';
      case 'removed':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom fontWeight="bold">
        Model History: {modelId}
      </Typography>
      <Timeline>
        {history.map((entry, index) => (
          <TimelineItem key={index}>
            <TimelineSeparator>
              <TimelineDot color={getEventColor(entry.status)}>
                {getEventIcon(entry.status)}
              </TimelineDot>
              {index < history.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {entry.status === 'available' ? 'Model Available' :
                   entry.status === 'deprecated' ? 'Model Deprecated' :
                   entry.status === 'removed' ? 'Model Removed' : 'Status Change'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(entry.discoveredAt || entry.lastSeen)}
                </Typography>
                {entry.changes && entry.changes.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {entry.changes.map((change, changeIndex) => (
                      <Alert key={changeIndex} severity="info" sx={{ mt: 0.5, py: 0.5 }}>
                        <Typography variant="caption">
                          <strong>{change.field}</strong>: {String(change.oldValue)} → {String(change.newValue)}
                        </Typography>
                      </Alert>
                    ))}
                  </Box>
                )}
                {entry.capabilities && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {entry.capabilities.supportsTools && <Chip label="Tools" size="small" />}
                    {entry.capabilities.supportsAudio && <Chip label="Audio" size="small" />}
                    {entry.capabilities.supportsRealtime && <Chip label="Realtime" size="small" />}
                    {entry.capabilities.supportsFileSearch && <Chip label="File Search" size="small" />}
                    {entry.capabilities.contextLimit && (
                      <Chip label={`Context: ${entry.capabilities.contextLimit.toLocaleString()}`} size="small" />
                    )}
                  </Box>
                )}
              </Box>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Paper>
  );
};

export default ModelHistory;

