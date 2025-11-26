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

const LiveCallsTab = ({
  liveCalls,
  liveCallsLoading,
  handleViewTimeline,
  handleViewToolTraces
}) => {
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
  );
};

export default LiveCallsTab;


