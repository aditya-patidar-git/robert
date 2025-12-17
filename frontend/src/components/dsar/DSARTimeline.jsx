import React from 'react';
import { Box, Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot, Typography, Paper } from '@mui/material';
import { CheckCircle, Error as ErrorIcon, Info, Schedule } from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';

/**
 * DSARTimeline Component
 * Reusable timeline component for DSAR requests
 */
const DSARTimeline = ({ events = [] }) => {
  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'request_created':
        return <Info color="info" />;
      case 'request_processed':
      case 'request_completed':
        return <CheckCircle color="success" />;
      case 'request_rejected':
        return <ErrorIcon color="error" />;
      default:
        return <Schedule color="action" />;
    }
  };

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'request_created':
        return 'info';
      case 'request_processed':
      case 'request_completed':
        return 'success';
      case 'request_rejected':
        return 'error';
      default:
        return 'grey';
    }
  };

  if (!events || events.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No timeline events available
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom fontWeight="bold">
        Request Timeline
      </Typography>
      <Timeline>
        {events.map((event, index) => (
          <TimelineItem key={index}>
            <TimelineSeparator>
              <TimelineDot color={getEventColor(event.event)}>
                {getEventIcon(event.event)}
              </TimelineDot>
              {index < events.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="body2" fontWeight="medium">
                {event.description || event.event}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(event.timestamp)}
              </Typography>
              {event.user && (
                <Typography variant="caption" color="text.secondary" display="block">
                  by {event.user}
                </Typography>
              )}
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Paper>
  );
};

export default DSARTimeline;

