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
  Alert
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

  // Fetch transcripts
  const { data: transcripts = [], isLoading: transcriptsLoading } = useQuery({
    queryKey: ['transcripts', user?.id],
    queryFn: () => transcriptService.getAllTranscripts(),
    select: (data) => {
      // Filter for users to see only their own
      if (!canSeeAll) {
        return data.filter(transcript => transcript.userId === user?.id);
      }
      return data;
    }
  });

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

  // Mock escalation logs
  const mockEscalations = [
    {
      id: 'esc_001',
      callId: 'call_001',
      timestamp: new Date().toISOString(),
      from: 'AI Agent',
      to: 'Human Agent',
      reason: 'Complex technical query',
      summary: 'Customer needed detailed technical support beyond AI capabilities'
    },
    {
      id: 'esc_002',
      callId: 'call_002',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      from: 'AI Agent',
      to: 'Supervisor',
      reason: 'Customer complaint',
      summary: 'Customer expressed dissatisfaction with service quality'
    }
  ];

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

  const handleSubmitComplaint = () => {
    // Mock complaint submission
    showSuccess('Complaint submitted successfully');
    setComplaintDialog(false);
    setComplaintText('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'failed': return 'error';
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
              Call Transcripts ({transcripts.length})
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
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Caller ID</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Status</TableCell>
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
                        label={transcript.status || 'completed'}
                        color={getStatusColor(transcript.status)}
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
                  {mockEscalations.map((escalation) => (
                    <TimelineItem key={escalation.id}>
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
                            {formatDateTime(escalation.timestamp)}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Reason:</strong> {escalation.reason}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Summary:</strong> {escalation.summary}
                          </Typography>
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