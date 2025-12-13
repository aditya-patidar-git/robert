import React from 'react';
import {
  Box,
  Paper,
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
  Tooltip
} from '@mui/material';
import {
  Visibility,
  Info
} from '@mui/icons-material';
import { formatDuration, formatPhoneNumber } from '../../../utils/formatters';

const LiveCallsTab = ({
  liveCalls,
  liveCallsLoading,
  handleViewTimeline,
  handleViewToolTraces
}) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'queued':
        return 'default';
      case 'ringing':
        return 'warning';
      case 'in-progress':
        return 'success';
      default:
        return 'primary';
    }
  };

  const formatLatency = (latency) => {
    if (latency === null || latency === undefined || latency === 0) {
      return 'N/A';
    }
    return `${latency}ms`;
  };

  return (
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
        <Box sx={{ 
          p: 3, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 200
        }}>
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
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                      {call.callSid}
                    </Typography>
                  </TableCell>
                  <TableCell>{call.from ? formatPhoneNumber(call.from) : 'N/A'}</TableCell>
                  <TableCell>{call.to ? formatPhoneNumber(call.to) : 'N/A'}</TableCell>
                  <TableCell>
                    <Chip 
                      label={call.status} 
                      size="small" 
                      color={getStatusColor(call.status)}
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell>{formatDuration(call.duration)}</TableCell>
                  <TableCell>{formatLatency(call.latency)}</TableCell>
                  <TableCell>{call.language || 'N/A'}</TableCell>
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
  );
};

export default LiveCallsTab;


