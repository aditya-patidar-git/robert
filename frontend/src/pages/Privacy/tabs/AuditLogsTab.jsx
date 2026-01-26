import React from 'react';
import { Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Tooltip, TablePagination } from '@mui/material';
import { formatDateTime } from '../../../utils/formatters';
import { formatAuditDetails, formatEventTypeLabel, getEventTypeColor } from '../utils/auditLogFormatters';

const AuditLogsTab = ({ state }) => {
  const {
    auditLogs,
    auditLogsLoading,
    auditLogFilters,
    setAuditLogFilters,
    auditLogPage,
    setAuditLogPage,
    auditLogPageSize,
    auditLogPagination
  } = state;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Event Type</InputLabel>
          <Select
            value={auditLogFilters.eventType || ''}
            label="Event Type"
            onChange={(e) => setAuditLogFilters({ ...auditLogFilters, eventType: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="consent_recorded">Consent Recorded</MenuItem>
            <MenuItem value="dsar_created">DSAR Created</MenuItem>
            <MenuItem value="dsar_processed">DSAR Processed</MenuItem>
            <MenuItem value="data_exported">Data Exported</MenuItem>
            <MenuItem value="data_deleted">Data Deleted</MenuItem>
            <MenuItem value="retention_cleanup">Retention Cleanup</MenuItem>
            <MenuItem value="breach_reported">Breach Reported</MenuItem>
            <MenuItem value="compliance_report_generated">Compliance Report</MenuItem>
            <MenuItem value="allowlist.add">Allowlist Added</MenuItem>
            <MenuItem value="allowlist.remove">Allowlist Removed</MenuItem>
            <MenuItem value="user.create">User Created</MenuItem>
            <MenuItem value="user.update">User Updated</MenuItem>
            <MenuItem value="auth.login">Login</MenuItem>
            <MenuItem value="auth.logout">Logout</MenuItem>
            <MenuItem value="auth.login_failed">Login Failed</MenuItem>
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
        <>
          <TableContainer>
            <Table size="small">
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
                    const timestamp = log.timestamp || log.createdAt || log.date || log.time;
                    const eventType = log.eventType || log.action;
                    const formattedDetails = formatAuditDetails(log);
                    const rawData = log.eventData || log.diff || log.details || log.metadata;
                    
                    return (
                      <TableRow key={log.id || log._id || Math.random()}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(timestamp)}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={formatEventTypeLabel(eventType)} 
                            size="small" 
                            color={getEventTypeColor(eventType)}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip 
                            title={rawData ? JSON.stringify(rawData, null, 2) : 'No raw data'}
                            placement="left"
                            arrow
                            slotProps={{
                              tooltip: {
                                sx: {
                                  maxWidth: 500,
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem'
                                }
                              }
                            }}
                          >
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                maxWidth: 500, 
                                cursor: rawData ? 'help' : 'default'
                              }}
                            >
                              {formattedDetails}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={auditLogPagination?.total ?? 0}
            page={auditLogPage ?? 0}
            onPageChange={(event, newPage) => setAuditLogPage(newPage)}
            rowsPerPage={auditLogPageSize ?? 15}
            rowsPerPageOptions={[15]}
            showFirstButton
            showLastButton
            labelDisplayedRows={({ from, to, count }) => {
              // Handle edge cases where count is 0 or undefined
              if (count === 0 || count === -1) {
                return '0 results';
              }
              return `${from}-${to} of ${count}`;
            }}
          />
        </>
      )}
    </Box>
  );
};

export default AuditLogsTab;



