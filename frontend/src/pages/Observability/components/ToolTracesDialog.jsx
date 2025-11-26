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

const ToolTracesDialog = ({
  open,
  onClose,
  selectedCallSid,
  toolTraces,
  toolTracesLoading
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Tool Traces - {selectedCallSid}</DialogTitle>
      <DialogContent>
        {toolTracesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : toolTraces.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Tool</TableCell>
                  <TableCell>Execution Time</TableCell>
                  <TableCell>Success</TableCell>
                  <TableCell>Source</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {toolTraces.map((trace, index) => (
                  <TableRow key={index}>
                    <TableCell>{formatDateTime(trace.timestamp)}</TableCell>
                    <TableCell>{trace.toolName}</TableCell>
                    <TableCell>{trace.executionTime}ms</TableCell>
                    <TableCell>
                      <Chip
                        label={trace.success ? 'Yes' : 'No'}
                        color={trace.success ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{trace.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography>No tool traces available</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ToolTracesDialog;

