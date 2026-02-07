import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  IconButton,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Collapse,
  Tooltip,
  Pagination,
  Button,
  Autocomplete
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import auditLogService from '../../../services/auditLogService';
import userService from '../../../services/userService';
import { formatEventTypeLabel, AUDIT_LOG_ACTIONS } from '../../Privacy/utils/auditLogFormatters';

const AuditLogViewer = () => {
  const [exporting, setExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [selectedUser, setSelectedUser] = useState(null);
  const [filters, setFilters] = useState({
    actorId: '',
    action: '',
    targetType: '',
    startDate: null,
    endDate: null,
    page: 1,
    limit: 50
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAllUsers()
  });
  const users = useMemo(() => {
    const d = usersData?.data ?? usersData;
    const list = d?.users ?? d;
    return Array.isArray(list) ? list : [];
  }, [usersData]);

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditLogService.getAuditLogs({
      actorId: filters.actorId || undefined,
      action: filters.action || undefined,
      targetType: filters.targetType || undefined,
      startDate: filters.startDate ? filters.startDate.toISOString() : undefined,
      endDate: filters.endDate ? filters.endDate.toISOString() : undefined,
      page: filters.page,
      limit: filters.limit
    })
  });

  // Access data from normalized response structure
  const auditLogs = auditData?.data?.auditLogs || auditData?.auditLogs || [];
  const pagination = auditData?.data?.pagination || auditData?.pagination || { page: 1, total: 0, pages: 1 };

  const toggleRow = (logId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  const handleFilterChange = (field) => (value) => {
    setFilters({ ...filters, [field]: value, page: 1 });
  };

  const handlePageChange = (event, newPage) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleClearFilters = () => {
    setSelectedUser(null);
    setFilters({
      actorId: '',
      action: '',
      targetType: '',
      startDate: null,
      endDate: null,
      page: 1,
      limit: 50
    });
  };

  const handleExport = async (format = 'csv') => {
    setExporting(true);
    try {
      await auditLogService.exportAuditLogs({
        actorId: filters.actorId || undefined,
        action: filters.action || undefined,
        targetType: filters.targetType || undefined,
        startDate: filters.startDate ? filters.startDate.toISOString() : undefined,
        endDate: filters.endDate ? filters.endDate.toISOString() : undefined,
        format
      });
    } finally {
      setExporting(false);
    }
  };

  const formatDiff = (diff) => {
    if (!diff) return 'No changes recorded';
    if (typeof diff === 'string') return diff;
    
    const entries = Object.entries(diff);
    if (entries.length === 0) return 'No changes recorded';
    
    return entries.map(([key, value]) => {
      if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
        return `${key}: "${value.from}" → "${value.to}"`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    }).join(', ');
  };

  const getActionColor = (action) => {
    if (action.includes('create')) return 'success';
    if (action.includes('delete') || action.includes('block') || action.includes('exclude')) return 'error';
    if (action.includes('update')) return 'warning';
    return 'default';
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Autocomplete
            size="small"
            sx={{ minWidth: 220 }}
            options={users}
            value={selectedUser}
            onChange={(_, value) => {
              setSelectedUser(value ?? null);
              handleFilterChange('actorId')(value?._id ?? '');
            }}
            getOptionLabel={(option) => option.email || option.username || ''}
            isOptionEqualToValue={(option, val) => option._id === val?._id}
            renderInput={(params) => (
              <TextField {...params} label="User" placeholder="Select user..." />
            )}
          />
          <TextField
            select
            label="Action"
            value={filters.action}
            onChange={(e) => handleFilterChange('action')(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All</MenuItem>
            {AUDIT_LOG_ACTIONS.map((action) => (
              <MenuItem key={action} value={action}>
                {formatEventTypeLabel(action)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Target Type"
            value={filters.targetType}
            onChange={(e) => handleFilterChange('targetType')(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="config">Config</MenuItem>
            <MenuItem value="call">Call</MenuItem>
            <MenuItem value="kb">Knowledge Base</MenuItem>
            <MenuItem value="allowlist">Allowlist</MenuItem>
            <MenuItem value="audit">Audit</MenuItem>
          </TextField>
          <DatePicker
            label="Start Date"
            value={filters.startDate}
            onChange={(date) => handleFilterChange('startDate')(date)}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }}
          />
          <DatePicker
            label="End Date"
            value={filters.endDate}
            onChange={(date) => handleFilterChange('endDate')(date)}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
          >
            Clear filters
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('csv')}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('json')}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export JSON'}
          </Button>
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="50px" />
              <TableCell>Timestamp</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>IP Address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auditLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Alert severity="info" sx={{ maxWidth: 400, margin: '0 auto' }}>
                    No audit logs found
                  </Alert>
                </TableCell>
              </TableRow>
            ) : (
              auditLogs.map((log) => {
                const isExpanded = expandedRows.has(log._id || log.id);
                return (
                  <React.Fragment key={log._id || log.id}>
                    <TableRow>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleRow(log._id || log.id)}
                        >
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.actorId?.email || log.actorId?.username || 'Unknown'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          color={getActionColor(log.action)}
                          sx={{ textTransform: 'none' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.targetType} {log.targetId ? `(${log.targetId.substring(0, 8)}...)` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {log.ip || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                              Details
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {log.diff && (
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    Changes:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', bgcolor: 'background.paper', p: 1, borderRadius: 1 }}>
                                    {formatDiff(log.diff)}
                                  </Typography>
                                </Box>
                              )}
                              {log.userAgent && (
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    User Agent:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                    {log.userAgent}
                                  </Typography>
                                </Box>
                              )}
                              {log.metadata && (
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    Metadata:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', bgcolor: 'background.paper', p: 1, borderRadius: 1 }}>
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.pages}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default AuditLogViewer;

