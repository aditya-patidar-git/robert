import React from 'react';
import { Paper, Box, Typography, Button, TextField, FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Pagination, CircularProgress, Tooltip } from '@mui/material';
import { GetApp, Visibility, PlayArrow, Pause, Delete, VolumeOff } from '@mui/icons-material';
import { formatDateTime, formatDuration } from '../../../utils/formatters';
import { CONSENT_FILTER_OPTIONS, RESULT_FILTER_OPTIONS, DEFAULT_TRANSCRIPT_FILTERS } from '../constants';
import { getConsentStatusDisplay, canAttemptPlayback, getRecordingStatusDisplay } from '../utils';

const TranscriptsTab = ({ state, handlers }) => {
  const {
    transcripts,
    pagination,
    filters,
    setFilters,
    canSeeAll,
    playingCallSid,
    exportMutation,
    isLoadingTranscripts
  } = state;

  const {
    handleViewTranscript,
    handlePlayRecording,
    handleExport,
    handleDeleteTranscript,
    getChipColor
  } = handlers;

  return (
    <Paper>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Call Transcripts ({pagination?.total || transcripts.length})</Typography>
        {canSeeAll && (
          <Button 
            variant="outlined" 
            startIcon={<GetApp />} 
            onClick={() => handleExport()} 
            disabled={exportMutation.isLoading}
          >
            Export All
          </Button>
        )}
      </Box>

      <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          label="Search"
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
          placeholder="Search transcripts..."
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="result-label">Result</InputLabel>
          <Select
            labelId="result-label"
            label="Result"
            value={filters.result}
            onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value, page: 1 }))}
          >
            {RESULT_FILTER_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="consent-label">Recording Consent</InputLabel>
          <Select
            labelId="consent-label"
            label="Recording Consent"
            value={filters.consentStatus}
            onChange={(e) => setFilters(prev => ({ ...prev, consentStatus: e.target.value, page: 1 }))}
          >
            {CONSENT_FILTER_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Start Date"
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          label="End Date"
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <Button
          variant="outlined"
          onClick={() => setFilters(DEFAULT_TRANSCRIPT_FILTERS)}
        >
          Clear Filters
        </Button>
      </Box>

      {isLoadingTranscripts ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Caller ID</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Consent</TableCell>
                <TableCell>Escalated</TableCell>
                <TableCell>Complaint</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transcripts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No transcripts found matching your filters
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                transcripts.map((t) => {
                  const consentStatus = getConsentStatusDisplay(t);
                  return (
                    <TableRow key={t.id || t.callSid}>
                      <TableCell><Typography variant="body2" fontFamily="monospace">{t.from || t.callerId}</Typography></TableCell>
                      <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                      <TableCell>{formatDuration(t.duration)}</TableCell>
                      <TableCell><Chip label={t.result || 'resolved'} color={getChipColor(t.result)} size="small" /></TableCell>
                      <TableCell>
                        <Chip 
                          label={consentStatus.label} 
                          color={consentStatus.color} 
                          size="small" 
                          variant={consentStatus.variant}
                        />
                      </TableCell>
                      <TableCell><Chip label={t.escalation?.escalated ? 'Yes' : 'No'} color={t.escalation?.escalated ? 'warning' : 'default'} size="small" /></TableCell>
                      <TableCell><Chip label={t.complaint?.hasComplaint ? 'Yes' : 'No'} color={t.complaint?.hasComplaint ? 'error' : 'default'} size="small" /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => handleViewTranscript(t)}><Visibility fontSize="small" /></IconButton>
                          {(() => {
                            const canPlay = canAttemptPlayback(t);
                            const recordingStatus = getRecordingStatusDisplay(t);
                            const isPlaying = playingCallSid === t.callSid;
                            
                            return (
                              <Tooltip title={recordingStatus.tooltip}>
                                <span>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => canPlay && handlePlayRecording(t.callSid)}
                                    color={isPlaying ? 'primary' : (canPlay ? 'default' : 'default')}
                                    disabled={!canPlay}
                                    sx={{ opacity: canPlay ? 1 : 0.5 }}
                                  >
                                    {!canPlay ? (
                                      <VolumeOff fontSize="small" />
                                    ) : isPlaying ? (
                                      <Pause fontSize="small" />
                                    ) : (
                                      <PlayArrow fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            );
                          })()}
                          {canSeeAll && <>
                            <IconButton size="small" onClick={() => handleExport({ id: t.id || t._id })}><GetApp fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteTranscript(t)}><Delete fontSize="small" /></IconButton>
                          </>}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination?.pages > 1 && (
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
          <Pagination count={pagination.pages} page={filters.page} onChange={(e, page) => setFilters(prev => ({ ...prev, page }))} color="primary" />
        </Box>
      )}
    </Paper>
  );
};

export default TranscriptsTab;



