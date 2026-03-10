import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Visibility,
  CheckCircle,
  Cancel,
  Search
} from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

/** Safely parse summary JSON (may be stringified). Returns null if invalid. */
function parseSummary(summary) {
  if (!summary) return null;
  if (typeof summary === 'object') return summary;
  try {
    return JSON.parse(summary);
  } catch {
    return null;
  }
}

/** Format duration seconds as "Xm Ys". */
function formatDuration(seconds) {
  if (seconds == null || isNaN(Number(seconds))) return '—';
  const s = Number(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const CONSENT_TYPES = ['recording', 'processing'];

const ConsentManagementTab = ({ state }) => {
  const {
    consentRecords = [],
    consentLoading,
    consentPagination = {},
    consentPage = 0,
    setConsentPage,
    consentPageSize = 15,
    setConsentPageSize,
    consentFilters = {},
    setConsentFilters
  } = state;

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const filters = consentFilters;
  const setFilters = setConsentFilters;
  const total = consentPagination?.total ?? 0;

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
              value={filters.consentType || ''}
              label="Consent Type"
              onChange={(e) => setFilters({ ...filters, consentType: e.target.value })}
            >
              <MenuItem value="">All Types</MenuItem>
              {CONSENT_TYPES.map((type) => (
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
              {consentRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {consentLoading ? 'Loading...' : 'No consent records found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                consentRecords.map((record) => (
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
          <TablePagination
            component="div"
            count={total}
            page={consentPage}
            onPageChange={(_, newPage) => setConsentPage(newPage)}
            rowsPerPage={consentPageSize}
            onRowsPerPageChange={(e) => setConsentPageSize(Number(e.target.value))}
            rowsPerPageOptions={[10, 15]}
            labelRowsPerPage="Rows per page:"
          />
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

              {/* Human-readable call summary from rawData */}
              {selectedRecord.rawData && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                    Call Summary
                  </Typography>
                  {(() => {
                    const raw = selectedRecord.rawData;
                    const summary = parseSummary(raw.summary);
                    return (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {summary && (
                          <>
                            {summary.purpose && (
                              <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                  Purpose
                                </Typography>
                                <Typography variant="body2">{summary.purpose}</Typography>
                              </Box>
                            )}
                            {summary.outcome && (
                              <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                  Outcome
                                </Typography>
                                <Chip
                                  label={String(summary.outcome)}
                                  size="small"
                                  color={summary.outcome === 'resolved' ? 'success' : 'default'}
                                  variant="outlined"
                                />
                              </Box>
                            )}
                            {Array.isArray(summary.keyFacts) && summary.keyFacts.length > 0 && (
                              <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                  Key facts
                                </Typography>
                                <List dense disablePadding sx={{ listStyleType: 'disc', pl: 2 }}>
                                  {summary.keyFacts.map((fact, idx) => (
                                    <ListItem key={idx} disablePadding sx={{ display: 'list-item', listStyleType: 'disc' }}>
                                      <ListItemText primary={fact} primaryTypographyProps={{ variant: 'body2' }} />
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}
                          </>
                        )}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                          {raw.duration != null && (
                            <Box>
                              <Typography variant="subtitle2" color="text.secondary">Duration</Typography>
                              <Typography variant="body2">{formatDuration(raw.duration)}</Typography>
                            </Box>
                          )}
                          {raw.from && (
                            <Box>
                              <Typography variant="subtitle2" color="text.secondary">From</Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{raw.from}</Typography>
                            </Box>
                          )}
                          {raw.to && (
                            <Box>
                              <Typography variant="subtitle2" color="text.secondary">To</Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{raw.to}</Typography>
                            </Box>
                          )}
                          {raw.result && (
                            <Box>
                              <Typography variant="subtitle2" color="text.secondary">Result</Typography>
                              <Chip label={String(raw.result)} size="small" variant="outlined" />
                            </Box>
                          )}
                        </Box>
                      </Box>
                    );
                  })()}
                </>
              )}
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
