import React, { useState, useMemo } from 'react';
import {
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
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  InputAdornment
} from '@mui/material';
import {
  Visibility,
  CheckCircle,
  Cancel,
  Search
} from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

// Consent Management Tab Component
const ConsentManagementTab = ({ state }) => {
  const {
    consentRecords: initialRecords = [],
    consentLoading
  } = state;

  const [filters, setFilters] = useState({
    consentType: '',
    granted: '',
    callSid: '',
    startDate: '',
    endDate: ''
  });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Filter consent records
  const filteredRecords = useMemo(() => {
    return initialRecords.filter(record => {
      if (filters.consentType && record.consentType !== filters.consentType) {
        return false;
      }
      if (filters.granted !== '' && record.granted !== (filters.granted === 'true')) {
        return false;
      }
      if (filters.callSid && record.callSid && !record.callSid.toLowerCase().includes(filters.callSid.toLowerCase())) {
        return false;
      }
      if (filters.startDate) {
        const recordDate = new Date(record.timestamp);
        const startDate = new Date(filters.startDate);
        if (recordDate < startDate) {
          return false;
        }
      }
      if (filters.endDate) {
        const recordDate = new Date(record.timestamp);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (recordDate > endDate) {
          return false;
        }
      }
      return true;
    });
  }, [initialRecords, filters]);

  // Get unique consent types for filter dropdown
  const consentTypes = useMemo(() => {
    return [...new Set(initialRecords.map(r => r.consentType).filter(Boolean))].sort();
  }, [initialRecords]);

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setDetailsDialogOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsDialogOpen(false);
    setSelectedRecord(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Search Call SID"
            value={filters.callSid}
            onChange={(e) => setFilters({ ...filters, callSid: e.target.value })}
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Consent Type</InputLabel>
            <Select
              value={filters.consentType}
              label="Consent Type"
              onChange={(e) => setFilters({ ...filters, consentType: e.target.value })}
            >
              <MenuItem value="">All Types</MenuItem>
              {consentTypes.map(type => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.granted}
              label="Status"
              onChange={(e) => setFilters({ ...filters, granted: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Granted</MenuItem>
              <MenuItem value="false">Withdrawn</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label="Start Date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            type="date"
            label="End Date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
        </Box>
      </Paper>

      {/* Consent Records Table */}
      {consentLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Call SID</TableCell>
                <TableCell>Consent Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {initialRecords.length === 0 
                        ? 'No consent records found' 
                        : 'No consent records match the selected filters'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTime(record.timestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {record.callSid || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.consentType || 'Unknown'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={record.granted ? <CheckCircle /> : <Cancel />}
                        label={record.granted ? 'Granted' : 'Withdrawn'}
                        color={record.granted ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(record)}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Consent Record Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 600 }}>
          Consent Record Details
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedRecord && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Timestamp
                </Typography>
                <Typography variant="body1">
                  {formatDateTime(selectedRecord.timestamp)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Call SID
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {selectedRecord.callSid || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Consent Type
                </Typography>
                <Typography variant="body1">
                  {selectedRecord.consentType || 'Unknown'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Status
                </Typography>
                <Chip
                  icon={selectedRecord.granted ? <CheckCircle /> : <Cancel />}
                  label={selectedRecord.granted ? 'Granted' : 'Withdrawn'}
                  color={selectedRecord.granted ? 'success' : 'error'}
                  size="small"
                />
              </Box>
              {selectedRecord.ipAddress && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    IP Address
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                    {selectedRecord.ipAddress}
                  </Typography>
                </Box>
              )}
              {selectedRecord.userAgent && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    User Agent
                  </Typography>
                  <Typography variant="body1" sx={{ fontSize: '0.875rem' }}>
                    {selectedRecord.userAgent}
                  </Typography>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Raw Data
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {JSON.stringify(selectedRecord.rawData, null, 2)}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDetails} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConsentManagementTab;
