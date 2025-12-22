import React from 'react';
import { Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress } from '@mui/material';
import { formatDateTime } from '../../../utils/formatters';

const AuditLogsTab = ({ state }) => {
  const {
    auditLogs,
    auditLogsLoading,
    auditLogFilters,
    setAuditLogFilters
  } = state;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Privacy Audit Logs
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Event Type</InputLabel>
          <Select
            value={auditLogFilters.eventType}
            label="Event Type"
            onChange={(e) => setAuditLogFilters({ ...auditLogFilters, eventType: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="consent_recorded">Consent Recorded</MenuItem>
            <MenuItem value="dsar_created">DSAR Created</MenuItem>
            <MenuItem value="data_exported">Data Exported</MenuItem>
            <MenuItem value="data_deleted">Data Deleted</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          type="date"
          label="Start Date"
          value={auditLogFilters.startDate}
          onChange={(e) => setAuditLogFilters({ ...auditLogFilters, startDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label="End Date"
          value={auditLogFilters.endDate}
          onChange={(e) => setAuditLogFilters({ ...auditLogFilters, endDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      {auditLogsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Event Type</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!auditLogs || auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography color="text.secondary">No audit logs found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => {
                  // Handle different timestamp field names and formats
                  const timestamp = log.timestamp || log.createdAt || log.date || log.time;
                  return (
                    <TableRow key={log.id || log._id || Math.random()}>
                      <TableCell>{formatDateTime(timestamp)}</TableCell>
                      <TableCell>
                        <Chip label={log.eventType || log.action || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'auto' }}>
                          {log.eventData ? JSON.stringify(log.eventData, null, 2) : 
                           log.details ? JSON.stringify(log.details, null, 2) :
                           log.metadata ? JSON.stringify(log.metadata, null, 2) : '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default AuditLogsTab;



