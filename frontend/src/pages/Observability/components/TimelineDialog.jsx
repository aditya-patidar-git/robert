import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
  Collapse,
  Paper
} from '@mui/material';
import { ExpandMore, ExpandLess, ContentCopy, CheckCircle } from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

const TimelineDialog = ({
  open,
  onClose,
  selectedCallSid,
  callTimeline,
  timelineLoading
}) => {
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [copiedIndex, setCopiedIndex] = useState(null);

  const toggleEvent = (index) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEvents(newExpanded);
  };

  const copyToClipboard = async (data, index) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatEventData = (data) => {
    if (!data || typeof data !== 'object') {
      return String(data || 'N/A');
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
      return 'No data';
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {entries.slice(0, 3).map(([key, value]) => (
          <Typography key={key} variant="body2" component="div">
            <Box component="span" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {key}:
            </Box>{' '}
            <Box component="span" fontFamily="monospace" fontSize="0.75rem">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </Box>
          </Typography>
        ))}
        {entries.length > 3 && (
          <Typography variant="caption" color="text.secondary">
            +{entries.length - 3} more fields
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
                    <TableCell width={100}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {callTimeline.timeline?.map((event, index) => {
                    const isExpanded = expandedEvents.has(index);
                    const hasData = event.data && typeof event.data === 'object' && Object.keys(event.data).length > 0;
                    const dataString = JSON.stringify(event.data, null, 2);

                    return (
                      <React.Fragment key={index}>
                        <TableRow>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                              {formatDateTime(event.timestamp)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={event.type} size="small" />
                          </TableCell>
                          <TableCell>
                            {hasData ? (
                              <Box>
                                {formatEventData(event.data)}
                                {Object.keys(event.data).length > 3 && (
                                  <Button
                                    size="small"
                                    onClick={() => toggleEvent(index)}
                                    endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                                    sx={{ mt: 0.5 }}
                                  >
                                    {isExpanded ? 'Show Less' : 'Show More'}
                                  </Button>
                                )}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No additional data
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasData && (
                              <IconButton
                                size="small"
                                onClick={() => copyToClipboard(event.data, index)}
                                title="Copy to clipboard"
                              >
                                {copiedIndex === index ? (
                                  <CheckCircle fontSize="small" color="success" />
                                ) : (
                                  <ContentCopy fontSize="small" />
                                )}
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && hasData && (
                          <TableRow>
                            <TableCell colSpan={4} sx={{ py: 0, border: 0 }}>
                              <Collapse in={isExpanded}>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 2,
                                    mt: 1,
                                    mb: 1,
                                    bgcolor: 'grey.50',
                                    maxHeight: 300,
                                    overflow: 'auto'
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    component="pre"
                                    fontFamily="monospace"
                                    fontSize="0.75rem"
                                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0 }}
                                  >
                                    {dataString}
                                  </Typography>
                                </Paper>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          <Typography>No timeline data available</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TimelineDialog;

