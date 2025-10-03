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
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Pagination
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import {
  Visibility,
  PlayArrow,
  GetApp,
  Delete,
  Edit,
  Person,
  SmartToy,
  Phone,
  Report
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

  // Check if user can see all data or just their own
  const canSeeAll = user?.role === 'owner' || user?.role === 'admin';

  // Fetch transcripts with pagination and filtering
  const [transcriptFilters, setTranscriptFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    result: '',
    escalated: '',
    hasComplaint: ''
  });

  const { data: transcriptData, isLoading: transcriptsLoading } = useQuery({
    queryKey: ['transcripts', user?.id, transcriptFilters],
    queryFn: () => transcriptService.getAllTranscripts(transcriptFilters),
    select: (data) => {
      // Role-based filtering is now handled on the backend
      return data;
    }
  });

  const transcripts = transcriptData?.transcripts || [];
  const pagination = transcriptData?.pagination;

  // Mock complaints data - replace with actual service
  const mockComplaints = [
    {
      id: 'comp_001',
      callerId: '+1234567890',
      date: new Date().toISOString(),
      summary: 'Unsatisfied with call quality and response time',
      status: 'open',
      escalated: false
    },
    {
      id: 'comp_002',
      callerId: '+1987654321',
      date: new Date(Date.now() - 86400000).toISOString(),
      summary: 'AI agent did not understand request properly',
      status: 'resolved',
      escalated: true
    }
  ];

  // Fetch escalation timeline for selected transcript
  const { data: escalationData } = useQuery({
    queryKey: ['escalations', selectedTranscript?.callSid],
    queryFn: () => transcriptService.getEscalationTimeline(selectedTranscript?.callSid),
    enabled: !!selectedTranscript?.callSid
  });

  const escalations = escalationData?.escalations || [];

  // Export transcripts mutation
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

  // Delete transcript mutation
  const deleteMutation = useMutation({
    mutationFn: transcriptService.deleteTranscript,
    onSuccess: () => {
      showSuccess('Transcript deleted successfully');
      queryClient.invalidateQueries(['transcripts']);
    },
    onError: () => showError('Failed to delete transcript')
  });

  const handleViewTranscript = (transcript) => {
    setSelectedTranscript(transcript);
    setTranscriptDialog(true);
  };

  const handlePlayRecording = async (callSid) => {
    try {
      const audioUrl = telephonyService.getRecordingUrl(callSid);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      showError('Failed to play recording');
    }
  };

  const handleSubmitComplaint = async () => {
    try {
      await transcriptService.submitComplaint({
        callId: selectedTranscript?.callSid,
        complaintText: complaintText,
        complaintType: 'service_quality',
        callerId: selectedTranscript?.from
      });
      showSuccess('Complaint submitted successfully');
      setComplaintDialog(false);
      setComplaintText('');
      queryClient.invalidateQueries(['transcripts']);
    } catch (error) {
      showError('Failed to submit complaint');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'success';
      case 'escalated': return 'warning';
      case 'voicemail': return 'info';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getResultColor = (result) => {
    switch (result) {
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
        {transcript.transcript.map((turn, index) => (
          <Box key={index} sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            {turn.role === 'assistant' ? (
              <SmartToy color="primary" fontSize="small" />
            ) : (
              <Person color="action" fontSize="small" />
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {turn.role === 'assistant' ? 'AI Agent' : 'Customer'}
              </Typography>
              <Typography variant="body2">
                {turn.text || turn.content}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Transcripts & Complaints
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {canSeeAll ? 
            'Manage call transcripts, recordings, and customer complaints' :
            'View your call transcripts and submit complaints'
          }
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Transcripts" />
          <Tab label="Complaints & Escalations" />
        </Tabs>
      </Paper>

      {/* Tab A: Transcripts */}
      {currentTab === 0 && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Call Transcripts ({pagination?.total || transcripts.length})
            </Typography>
            {canSeeAll && (
              <Button
                variant="outlined"
                startIcon={<GetApp />}
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isLoading}
              >
                Export All
              </Button>
            )}
          </Box>
          
          {/* Filters */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search"
                  value={transcriptFilters.search}
                  onChange={(e) => setTranscriptFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Search transcripts..."
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Result</InputLabel>
                  <Select
                    value={transcriptFilters.result}
                    onChange={(e) => setTranscriptFilters(prev => ({ ...prev, result: e.target.value }))}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="escalated">Escalated</MenuItem>
                    <MenuItem value="voicemail">Voicemail</MenuItem>
                    <MenuItem value="error">Error</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Escalated</InputLabel>
                  <Select
                    value={transcriptFilters.escalated}
                    onChange={(e) => setTranscriptFilters(prev => ({ ...prev, escalated: e.target.value }))}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Complaint</InputLabel>
                  <Select
                    value={transcriptFilters.hasComplaint}
                    onChange={(e) => setTranscriptFilters(prev => ({ ...prev, hasComplaint: e.target.value }))}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="outlined"
                  onClick={() => setTranscriptFilters({
                    page: 1,
                    limit: 20,
                    search: '',
                    result: '',
                    escalated: '',
                    hasComplaint: ''
                  })}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
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
                {transcripts.map((transcript) => (
                  <TableRow key={transcript.id || transcript.callSid}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {transcript.from || transcript.callerId}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDateTime(transcript.createdAt)}</TableCell>
                    <TableCell>{formatDuration(transcript.duration)}</TableCell>
                    <TableCell>
                      <Chip
                        label={transcript.result || 'resolved'}
                        color={getResultColor(transcript.result)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={transcript.escalation?.escalated ? 'Yes' : 'No'}
                        color={transcript.escalation?.escalated ? 'warning' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={transcript.complaint?.hasComplaint ? 'Yes' : 'No'}
                        color={transcript.complaint?.hasComplaint ? 'error' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewTranscript(transcript)}
                          title="View Transcript"
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handlePlayRecording(transcript.callSid)}
                          title="Play Recording"
                        >
                          <PlayArrow fontSize="small" />
                        </IconButton>
                        {canSeeAll && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => exportMutation.mutate({ id: transcript.id })}
                              title="Export"
                            >
                              <GetApp fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => deleteMutation.mutate(transcript.id)}
                              title="Delete/Redact"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
              <Pagination
                count={pagination.pages}
                page={transcriptFilters.page}
                onChange={(event, page) => setTranscriptFilters(prev => ({ ...prev, page }))}
                color="primary"
              />
            </Box>
          )}
        </Paper>
      )}

      {/* Tab B: Complaints & Escalations */}
      {currentTab === 1 && (
        <Box>
          {/* Complaints Section */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Customer Complaints
              </Typography>
              {!canSeeAll && (
                <Button
                  variant="contained"
                  startIcon={<Report />}
                  onClick={() => setComplaintDialog(true)}
                >
                  Submit Complaint
                </Button>
              )}
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Caller ID</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Complaint Summary</TableCell>
                    <TableCell>Status</TableCell>
                    {canSeeAll && <TableCell>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockComplaints.map((complaint) => (
                    <TableRow key={complaint.id}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {complaint.callerId}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDateTime(complaint.date)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {complaint.summary}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={complaint.status}
                          color={complaint.status === 'resolved' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      {canSeeAll && (
                        <TableCell>
                          <IconButton size="small">
                            <Edit fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Escalation Logs (Owner/Admin only) */}
          {canSeeAll && (
            <Paper>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Escalation Timeline
                </Typography>
              </Box>
              <Box sx={{ p: 3 }}>
                <Timeline>
                  {escalations.map((escalation) => (
                    <TimelineItem key={escalation._id}>
                      <TimelineSeparator>
                        <TimelineDot color="primary">
                          <Phone fontSize="small" />
                        </TimelineDot>
                        <TimelineConnector />
                      </TimelineSeparator>
                      <TimelineContent>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {escalation.from} → {escalation.to}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(escalation.initiatedAt)}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Reason:</strong> {escalation.reason.replace('_', ' ').toUpperCase()}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Summary:</strong> {escalation.summary}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Status:</strong> {escalation.escalationStatus}
                          </Typography>
                          {escalation.handoverSummary && (
                            <Typography variant="body2">
                              <strong>Handover:</strong> {escalation.handoverSummary}
                            </Typography>
                          )}
                        </Box>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              </Box>
            </Paper>
          )}
        </Box>
      )}

      {/* Transcript Detail Dialog */}
      <Dialog
        open={transcriptDialog}
        onClose={() => setTranscriptDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Call Transcript - {selectedTranscript?.from}
        </DialogTitle>
        <DialogContent>
          {selectedTranscript && renderTranscriptContent(selectedTranscript)}
          
          {selectedTranscript?.summary && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                AI Summary
              </Typography>
              <Typography variant="body2">
                {selectedTranscript.summary}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTranscriptDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Complaint Submission Dialog */}
      <Dialog
        open={complaintDialog}
        onClose={() => setComplaintDialog(false)}
        maxWidth="sm"
        fullWidth
      >
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
          <Button
            onClick={handleSubmitComplaint}
            variant="contained"
            disabled={!complaintText.trim()}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TranscriptsComplaintsPage;