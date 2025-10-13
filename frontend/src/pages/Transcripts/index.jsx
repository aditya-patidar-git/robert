import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination
} from '@mui/material';
import {
  Visibility,
  PlayArrow,
  GetApp,
  Delete,
  SmartToy,
  Person
} from '@mui/icons-material';
import { formatDateTime, formatDuration } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import transcriptService from '../../services/transcriptService';
import telephonyService from '../../services/telephonyService';

const TranscriptsComplaintsPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const [currentTab, setCurrentTab] = useState(0);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [transcriptDialog, setTranscriptDialog] = useState(false);
  const [complaintDialog, setComplaintDialog] = useState(false);
  const [complaintText, setComplaintText] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [transcriptToDelete, setTranscriptToDelete] = useState(null);

  const canSeeAll = user?.role === 'owner' || user?.role === 'admin';

  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    result: ''
  });

  const { data: transcriptData } = useQuery({
    queryKey: ['transcripts', user?.id, filters],
    queryFn: () => transcriptService.getAllTranscripts(filters)
  });

  const transcripts = transcriptData?.transcripts || [];
  const pagination = transcriptData?.pagination;

  const exportMutation = useMutation({
    mutationFn: transcriptService.exportTranscripts,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transcripts.zip';
      a.click();
      showSuccess('Transcripts exported successfully');
    },
    onError: () => showError('Failed to export transcripts')
  });

  const deleteMutation = useMutation({
    mutationFn: (transcriptId) => transcriptService.deleteTranscript(transcriptId),
    onSuccess: () => {
      showSuccess('Transcript deleted successfully');
      queryClient.invalidateQueries(['transcripts']);
      setDeleteDialog(false);
      setTranscriptToDelete(null);
    },
    onError: () => showError('Failed to delete transcript')
  });

  const handleViewTranscript = (transcript) => {
    setSelectedTranscript(transcript);
    setTranscriptDialog(true);
  };

  const handlePlayRecording = (callSid) => {
    try {
      const audioUrl = telephonyService.getRecordingUrl(callSid);
      new Audio(audioUrl).play();
    } catch {
      showError('Failed to play recording');
    }
  };

  const handleSubmitComplaint = async () => {
    try {
      await transcriptService.submitComplaint({
        callId: selectedTranscript?.callSid,
        complaintText,
        complaintType: 'service_quality',
        callerId: selectedTranscript?.from
      });
      showSuccess('Complaint submitted successfully');
      setComplaintDialog(false);
      setComplaintText('');
      queryClient.invalidateQueries(['transcripts']);
    } catch {
      showError('Failed to submit complaint');
    }
  };

  const handleDeleteTranscript = (transcript) => {
    setTranscriptToDelete(transcript);
    setDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (transcriptToDelete) {
      deleteMutation.mutate(transcriptToDelete._id || transcriptToDelete.id);
    }
  };

  const getChipColor = (status) => {
    switch (status) {
      case 'resolved': return 'success';
      case 'escalated': return 'warning';
      case 'voicemail': return 'info';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const renderTranscriptContent = (transcript) => {
    if (!transcript?.transcript) return <Typography>No transcript available</Typography>;

    return (
      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
        {transcript.transcript.map((turn, idx) => (
          <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
            {turn.role === 'assistant' ? <SmartToy color="primary" fontSize="small" /> : <Person color="action" fontSize="small" />}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {turn.role === 'assistant' ? 'AI Agent' : 'Customer'}
              </Typography>
              <Typography variant="body2">{turn.text || turn.content}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Transcripts & Complaints
        </Typography>
        <Typography color="text.secondary">
          {canSeeAll
            ? 'Manage call transcripts, recordings, and customer complaints'
            : 'View your call transcripts and submit complaints'}
        </Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(e, val) => setCurrentTab(val)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Transcripts" />
          <Tab label="Complaints & Escalations" />
        </Tabs>
      </Paper>

      {/* Tab: Transcripts */}
      {currentTab === 0 && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Call Transcripts ({pagination?.total || transcripts.length})</Typography>
            {canSeeAll && <Button variant="outlined" startIcon={<GetApp />} onClick={() => exportMutation.mutate()} disabled={exportMutation.isLoading}>Export All</Button>}
          </Box>

          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              size="small"
              label="Search"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search transcripts..."
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="result-label">Result</InputLabel>
              <Select
                labelId="result-label"
                value={filters.result}
                onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value }))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="escalated">Escalated</MenuItem>
                <MenuItem value="voicemail">Voicemail</MenuItem>
                <MenuItem value="error">Error</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              onClick={() => setFilters({ page: 1, limit: 20, search: '', result: '' })}
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
                        <IconButton size="small" onClick={() => handlePlayRecording(t.callSid)}><PlayArrow fontSize="small" /></IconButton>
                        {canSeeAll && <>
                          <IconButton size="small" onClick={() => exportMutation.mutate({ id: t.id })}><GetApp fontSize="small" /></IconButton>
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
      )}

      {/* Tab: Complaints & Escalations */}
      {currentTab === 1 && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Complaints & Escalations</Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Caller ID</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Escalated</TableCell>
                  <TableCell>Complaint</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transcripts
                  .filter(t => t.result === 'escalated' || t.complaint?.hasComplaint)
                  .map((t) => (
                    <TableRow key={t.id || t.callSid}>
                      <TableCell><Typography variant="body2" fontFamily="monospace">{t.from || t.callerId}</Typography></TableCell>
                      <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                      <TableCell><Chip label={t.result || 'resolved'} color={getChipColor(t.result)} size="small" /></TableCell>
                      <TableCell><Chip label={t.escalation?.escalated ? 'Yes' : 'No'} color={t.escalation?.escalated ? 'warning' : 'default'} size="small" /></TableCell>
                      <TableCell><Chip label={t.complaint?.hasComplaint ? 'Yes' : 'No'} color={t.complaint?.hasComplaint ? 'error' : 'default'} size="small" /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => handleViewTranscript(t)}><Visibility fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => handlePlayRecording(t.callSid)}><PlayArrow fontSize="small" /></IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Transcript Dialog */}
      <Dialog open={transcriptDialog} onClose={() => setTranscriptDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Call Transcript - {selectedTranscript?.from}</DialogTitle>
        <DialogContent>
          {selectedTranscript && renderTranscriptContent(selectedTranscript)}
          {selectedTranscript?.summary && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>AI Summary</Typography>
              <Typography variant="body2">{selectedTranscript.summary}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTranscriptDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Complaint Dialog */}
      <Dialog open={complaintDialog} onClose={() => setComplaintDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Complaint</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={4}
            fullWidth
            placeholder="Describe your complaint..."
            value={complaintText}
            onChange={(e) => setComplaintText(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComplaintDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmitComplaint} variant="contained" disabled={!complaintText.trim()}>Submit</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Transcript</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this transcript? This action cannot be undone.
          </Typography>
          {transcriptToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Call Details:</Typography>
              <Typography variant="body2">Caller: {transcriptToDelete.from || transcriptToDelete.callerId}</Typography>
              <Typography variant="body2">Date: {formatDateTime(transcriptToDelete.createdAt)}</Typography>
              <Typography variant="body2">Duration: {formatDuration(transcriptToDelete.duration)}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button 
            onClick={confirmDelete} 
            variant="contained" 
            color="error"
            disabled={deleteMutation.isLoading}
          >
            {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TranscriptsComplaintsPage;
