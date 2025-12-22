import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress
} from '@mui/material';
import { format } from 'date-fns';

/**
 * Audit Logs Tab Component
 * Displays audit logs for privacy-related activities
 */
export function AuditLogsTab({ logs, loading }) {
  const getActionColor = (action) => {
    if (action.includes('delete') || action.includes('remove')) return 'error';
    if (action.includes('update') || action.includes('modify')) return 'warning';
    if (action.includes('create') || action.includes('add')) return 'success';
    return 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>Audit Logs</Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs && logs.length > 0 ? (
              logs.map((log, index) => (
                <TableRow key={log.id || index}>
                  <TableCell>
                    {format(new Date(log.timestamp), 'PPp')}
                  </TableCell>
                  <TableCell>{log.userId || log.userEmail || 'System'}</TableCell>
                  <TableCell>
                    <Chip
                      label={log.action}
                      color={getActionColor(log.action)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{log.resourceType}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.details || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary">No audit logs found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

