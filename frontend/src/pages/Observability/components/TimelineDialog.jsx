import React from 'react';
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
  CircularProgress
} from '@mui/material';
import { formatDateTime } from '../../../utils/formatters';

const TimelineDialog = ({
  open,
  onClose,
  selectedCallSid,
  callTimeline,
  timelineLoading
}) => {
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {callTimeline.timeline?.map((event, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDateTime(event.timestamp)}</TableCell>
                      <TableCell>
                        <Chip label={event.type} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {JSON.stringify(event.data, null, 2)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
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

