import React from 'react';
import { Paper, Box, Typography, Button, TextField, FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Pagination } from '@mui/material';
import { GetApp, Visibility, PlayArrow, Pause, Delete } from '@mui/icons-material';
import { formatDateTime, formatDuration } from '../../../utils/formatters';

const TranscriptsTab = ({ state, handlers }) => {
  const {
    transcripts,
    pagination,
    filters,
    setFilters,
    canSeeAll,
    playingCallSid,
    exportMutation
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
            value={filters.result}
            onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value, page: 1 }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="escalated">Escalated</MenuItem>
            <MenuItem value="voicemail">Voicemail</MenuItem>
            <MenuItem value="error">Error</MenuItem>
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
          onClick={() => setFilters({ page: 1, limit: 20, search: '', result: '', startDate: '', endDate: '' })}
        >
          Clear Filters
        </Button>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Caller ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Escalated</TableCell>
              <TableCell>Complaint</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transcripts.map((t) => (
              <TableRow key={t.id || t.callSid}>
                <TableCell><Typography variant="body2" fontFamily="monospace">{t.from || t.callerId}</Typography></TableCell>
                <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                <TableCell>{formatDuration(t.duration)}</TableCell>
                <TableCell><Chip label={t.result || 'resolved'} color={getChipColor(t.result)} size="small" /></TableCell>
                <TableCell><Chip label={t.escalation?.escalated ? 'Yes' : 'No'} color={t.escalation?.escalated ? 'warning' : 'default'} size="small" /></TableCell>
                <TableCell><Chip label={t.complaint?.hasComplaint ? 'Yes' : 'No'} color={t.complaint?.hasComplaint ? 'error' : 'default'} size="small" /></TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => handleViewTranscript(t)}><Visibility fontSize="small" /></IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handlePlayRecording(t.callSid)}
                      color={playingCallSid === t.callSid ? 'primary' : 'default'}
                    >
                      {playingCallSid === t.callSid ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                    </IconButton>
                    {canSeeAll && <>
                      <IconButton size="small" onClick={() => handleExport({ id: t.id || t._id })}><GetApp fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteTranscript(t)}><Delete fontSize="small" /></IconButton>
                    </>}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination?.pages > 1 && (
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
          <Pagination count={pagination.pages} page={filters.page} onChange={(e, page) => setFilters(prev => ({ ...prev, page }))} color="primary" />
        </Box>
      )}
    </Paper>
  );
};

export default TranscriptsTab;



