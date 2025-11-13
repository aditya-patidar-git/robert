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
  Pagination,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem
} from '@mui/material';
import {
  Visibility,
  PlayArrow,
  Pause,
  GetApp,
  Delete,
  SmartToy,
  Person,
  ExpandMore,
  Description,
  Timeline,
  Gavel
} from '@mui/icons-material';
import { formatDateTime, formatDuration } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import transcriptService from '../../services/transcriptService';
import complaintService from '../../services/complaintService';

const TranscriptsComplaintsPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const [currentTab, setCurrentTab] = useState(0);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [transcriptDialog, setTranscriptDialog] = useState(false);
  const [complaintDialog, setComplaintDialog] = useState(false);
  const [complaintText, setComplaintText] = useState('');
  const [complaintType, setComplaintType] = useState('service_quality');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [transcriptToDelete, setTranscriptToDelete] = useState(null);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportDialog, setExportDialog] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [playingCallSid, setPlayingCallSid] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaintDetailDialog, setComplaintDetailDialog] = useState(false);
  const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState(false);
  const [priorityUpdateDialog, setPriorityUpdateDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newResolution, setNewResolution] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newPriority, setNewPriority] = useState('');

  const canSeeAll = user?.role === 'owner' || user?.role === 'admin';

  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    result: '',
    startDate: '',
    endDate: ''
  });

  const [complaintFilters, setComplaintFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: '',
    priority: '',
    complaintType: '',
    assignedTo: '',
    startDate: '',
    endDate: ''
  });

  const { data: transcriptData } = useQuery({
    queryKey: ['transcripts', user?.id, filters],
    queryFn: () => transcriptService.getAllTranscripts(filters)
  });

  const transcripts = transcriptData?.transcripts || [];
  const pagination = transcriptData?.pagination;

  // Complaints query
  const { data: complaintData, isLoading: isLoadingComplaints } = useQuery({
    queryKey: ['complaints', complaintFilters],
    queryFn: () => complaintService.getAllComplaints(complaintFilters),
    enabled: currentTab === 1
  });

  const complaints = complaintData?.complaints || [];
  const complaintPagination = complaintData?.pagination;

  const exportMutation = useMutation({
    mutationFn: (params) => transcriptService.exportTranscripts(params),
    onSuccess: (blob, variables) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const format = variables?.format || exportFormat;
      const filename = variables?.id ? `transcript-${variables.id}.${format}` : `transcripts.${format}`;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('Transcripts exported successfully');
      setExportDialog(false);
    },
    onError: () => {
      showError('Failed to export transcripts');
      setExportDialog(false);
    }
  });

  // Query for full transcript details
  const { data: fullTranscriptData, isLoading: isLoadingTranscript } = useQuery({
    queryKey: ['transcript', selectedTranscript?._id || selectedTranscript?.id],
    queryFn: () => transcriptService.getTranscript(selectedTranscript?._id || selectedTranscript?.id),
    enabled: !!selectedTranscript && transcriptDialog && !!(selectedTranscript?._id || selectedTranscript?.id)
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

  // Complaint mutations
  const statusUpdateMutation = useMutation({
    mutationFn: ({ complaintId, status, resolution }) => 
      complaintService.updateComplaintStatus(complaintId, status, resolution),
    onSuccess: () => {
      showSuccess('Complaint status updated successfully');
      queryClient.invalidateQueries(['complaints']);
      queryClient.invalidateQueries(['transcripts']);
      setStatusUpdateDialog(false);
      setNewStatus('');
      setNewResolution('');
    },
    onError: () => showError('Failed to update complaint status')
  });

  const assignMutation = useMutation({
    mutationFn: ({ complaintId, assignedTo }) => 
      complaintService.assignComplaint(complaintId, assignedTo),
    onSuccess: () => {
      showSuccess('Complaint assigned successfully');
      queryClient.invalidateQueries(['complaints']);
      setAssignDialog(false);
      setNewAssignedTo('');
    },
    onError: () => showError('Failed to assign complaint')
  });

  const priorityUpdateMutation = useMutation({
    mutationFn: ({ complaintId, priority }) => 
      complaintService.updateComplaintPriority(complaintId, priority),
    onSuccess: () => {
      showSuccess('Complaint priority updated successfully');
      queryClient.invalidateQueries(['complaints']);
      setPriorityUpdateDialog(false);
      setNewPriority('');
    },
    onError: () => showError('Failed to update complaint priority')
  });

  const handleViewTranscript = (transcript) => {
    setSelectedTranscript(transcript);
    setTranscriptDialog(true);
  };

  const handlePlayRecording = async (callSid) => {
    try {
      // If this call is already playing, pause it
      if (playingCallSid === callSid && playingAudio) {
        playingAudio.pause();
        setPlayingAudio(null);
        setPlayingCallSid(null);
        return;
      }

      // If another call is playing, stop it first
      if (playingAudio) {
        playingAudio.pause();
        playingAudio.currentTime = 0;
      }

      const audioUrl = await transcriptService.getRecordingUrl(callSid);
      const audio = new Audio(audioUrl);
      
      // Set up event listeners to reset state when audio ends
      audio.addEventListener('ended', () => {
        setPlayingAudio(null);
        setPlayingCallSid(null);
      });
      
      audio.addEventListener('error', () => {
        showError('Failed to play recording. The recording may not be available.');
        setPlayingAudio(null);
        setPlayingCallSid(null);
      });

      await audio.play();
      setPlayingAudio(audio);
      setPlayingCallSid(callSid);
    } catch (error) {
      showError('Failed to play recording');
      setPlayingAudio(null);
      setPlayingCallSid(null);
    }
  };

  const handleExport = (params = {}) => {
    if (canSeeAll && !params.id) {
      setExportDialog(true);
    } else {
      exportMutation.mutate({ format: exportFormat, ...params });
    }
  };

  const confirmExport = () => {
    exportMutation.mutate({ format: exportFormat, ...filters });
  };

  const handleSubmitComplaint = async () => {
    try {
      await transcriptService.submitComplaint({
        callId: selectedTranscript?.callSid,
        complaintText,
        complaintType: complaintType,
        callerId: selectedTranscript?.from
      });
      showSuccess('Complaint submitted successfully');
      setComplaintDialog(false);
      setComplaintText('');
      setComplaintType('service_quality');
      queryClient.invalidateQueries(['transcripts']);
      queryClient.invalidateQueries(['complaints']);
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

  const getComplaintStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'success';
      case 'closed': return 'default';
      case 'investigating': return 'warning';
      case 'open': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const handleViewComplaint = async (complaint) => {
    try {
      const data = await complaintService.getComplaint(complaint._id || complaint.id);
      setSelectedComplaint(data);
      setComplaintDetailDialog(true);
    } catch (error) {
      showError('Failed to load complaint details');
    }
  };

  const handleUpdateStatus = () => {
    if (selectedComplaint?.complaint?._id) {
      statusUpdateMutation.mutate({
        complaintId: selectedComplaint.complaint._id,
        status: newStatus,
        resolution: newResolution
      });
    }
  };

  const handleAssign = () => {
    if (selectedComplaint?.complaint?._id) {
      assignMutation.mutate({
        complaintId: selectedComplaint.complaint._id,
        assignedTo: newAssignedTo
      });
    }
  };

  const handleUpdatePriority = () => {
    if (selectedComplaint?.complaint?._id) {
      priorityUpdateMutation.mutate({
        complaintId: selectedComplaint.complaint._id,
        priority: newPriority
      });
    }
  };

  const renderTranscriptContent = (transcript) => {
    if (!transcript?.transcript) return <Typography>No transcript available</Typography>;

    return (
      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
        {transcript.transcript.map((turn, idx) => {
          const isAgent = turn.role === 'assistant' || turn.role === 'agent';
          const hasRedactions = turn.redactions && turn.redactions.length > 0;
          
          return (
            <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
              {isAgent ? <SmartToy color="primary" fontSize="small" /> : <Person color="action" fontSize="small" />}
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {isAgent ? 'AI Agent' : 'Customer'}
                  </Typography>
                  {turn.timestamp && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(turn.timestamp)}
                    </Typography>
                  )}
                  {hasRedactions && (
                    <Chip label="PII Redacted" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {turn.text || turn.content}
                </Typography>
              </Box>
            </Box>
          );
        })}
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
      )}

      {/* Tab: Complaints & Escalations */}
      {currentTab === 1 && (
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Complaints & Escalations ({complaintPagination?.total || complaints.length})
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => {
                if (selectedTranscript) {
                  setComplaintDialog(true);
                } else {
                  showError('Please select a transcript first');
                }
              }}
            >
              Submit Complaint
            </Button>
          </Box>

          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              size="small"
              label="Search"
              value={complaintFilters.search}
              onChange={(e) => setComplaintFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              placeholder="Search complaints..."
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                value={complaintFilters.status}
                onChange={(e) => setComplaintFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="investigating">Investigating</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="priority-label">Priority</InputLabel>
              <Select
                labelId="priority-label"
                value={complaintFilters.priority}
                onChange={(e) => setComplaintFilters(prev => ({ ...prev, priority: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="type-label">Type</InputLabel>
              <Select
                labelId="type-label"
                value={complaintFilters.complaintType}
                onChange={(e) => setComplaintFilters(prev => ({ ...prev, complaintType: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="service_quality">Service Quality</MenuItem>
                <MenuItem value="ai_understanding">AI Understanding</MenuItem>
                <MenuItem value="response_time">Response Time</MenuItem>
                <MenuItem value="technical_issue">Technical Issue</MenuItem>
                <MenuItem value="billing">Billing</MenuItem>
                <MenuItem value="booking">Booking</MenuItem>
                <MenuItem value="instructor_conduct">Instructor Conduct</MenuItem>
                <MenuItem value="safety_concern">Safety Concern</MenuItem>
                <MenuItem value="discrimination">Discrimination</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Start Date"
              type="date"
              value={complaintFilters.startDate}
              onChange={(e) => setComplaintFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              size="small"
              label="End Date"
              type="date"
              value={complaintFilters.endDate}
              onChange={(e) => setComplaintFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <Button
              variant="outlined"
              onClick={() => setComplaintFilters({ page: 1, limit: 20, search: '', status: '', priority: '', complaintType: '', assignedTo: '', startDate: '', endDate: '' })}
            >
              Clear Filters
            </Button>
          </Box>

          {isLoadingComplaints ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Caller ID</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Assigned To</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {complaints.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="text.secondary" sx={{ py: 3 }}>
                            No complaints found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      complaints.map((complaint) => (
                        <TableRow key={complaint._id || complaint.id}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {complaint.callerId}
                            </Typography>
                          </TableCell>
                          <TableCell>{formatDateTime(complaint.submittedAt)}</TableCell>
                          <TableCell>
                            <Chip 
                              label={complaint.complaintType?.replace('_', ' ') || 'other'} 
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={complaint.status || 'open'} 
                              color={getComplaintStatusColor(complaint.status)} 
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={complaint.priority || 'medium'} 
                              color={getPriorityColor(complaint.priority)} 
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>
                            {complaint.assignedTo ? (
                              <Typography variant="body2" color="text.secondary">
                                {complaint.assignedTo}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                Unassigned
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton 
                                size="small" 
                                onClick={() => handleViewComplaint(complaint)}
                              >
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {complaintPagination?.pages > 1 && (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                  <Pagination 
                    count={complaintPagination.pages} 
                    page={complaintFilters.page} 
                    onChange={(e, page) => setComplaintFilters(prev => ({ ...prev, page }))} 
                    color="primary" 
                  />
                </Box>
              )}
            </>
          )}
        </Paper>
      )}

      {/* Transcript Dialog */}
      <Dialog open={transcriptDialog} onClose={() => setTranscriptDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Call Transcript - {selectedTranscript?.from || selectedTranscript?.callerId}
          {selectedTranscript?.callSid && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2, fontFamily: 'monospace' }}>
              {selectedTranscript.callSid}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {isLoadingTranscript ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {(fullTranscriptData?.transcript || selectedTranscript) && renderTranscriptContent(fullTranscriptData?.transcript || selectedTranscript)}
              
              {/* Summary */}
              {(fullTranscriptData?.transcript?.summary || selectedTranscript?.summary) && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>AI Summary</Typography>
                  <Typography variant="body2">{(fullTranscriptData?.transcript?.summary || selectedTranscript?.summary)}</Typography>
                </Box>
              )}

              {/* Provenance/KB Citations */}
              {fullTranscriptData?.provenance && fullTranscriptData.provenance.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Description color="primary" />
                        <Typography variant="subtitle2">Knowledge Base Citations</Typography>
                        <Chip label={fullTranscriptData.provenance.length} size="small" />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {fullTranscriptData.provenance.map((prov, idx) => (
                          <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <Box sx={{ width: '100%' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {prov.titles?.[0] || prov.results?.[0]?.fileName || 'Unknown Document'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDateTime(prov.timestamp)}
                                </Typography>
                              </Box>
                              {prov.query && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                  Query: {prov.query}
                                </Typography>
                              )}
                              {prov.similarityScores?.[0] !== undefined && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  Similarity: {(prov.similarityScores[0] * 100).toFixed(1)}%
                                </Typography>
                              )}
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

              {/* Escalation Timeline */}
              {fullTranscriptData?.escalations && fullTranscriptData.escalations.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Timeline color="warning" />
                        <Typography variant="subtitle2">Escalation Timeline</Typography>
                        <Chip label={fullTranscriptData.escalations.length} size="small" color="warning" />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {fullTranscriptData.escalations.map((esc, idx) => (
                          <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <Box sx={{ width: '100%' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {formatDateTime(esc.initiatedAt)}
                                </Typography>
                                {esc.status && (
                                  <Chip label={esc.status} size="small" color={esc.status === 'resolved' ? 'success' : 'warning'} />
                                )}
                              </Box>
                              {esc.reason && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  Reason: {esc.reason}
                                </Typography>
                              )}
                              {esc.handoverSummary && (
                                <Typography variant="body2" color="text.secondary">
                                  Handover: {esc.handoverSummary}
                                </Typography>
                              )}
                              {esc.targetNumber && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  Target: {esc.targetNumber}
                                </Typography>
                              )}
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

              {/* Complaint Details */}
              {fullTranscriptData?.complaints && fullTranscriptData.complaints.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Gavel color="error" />
                        <Typography variant="subtitle2">Complaints</Typography>
                        <Chip label={fullTranscriptData.complaints.length} size="small" color="error" />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {fullTranscriptData.complaints.map((complaint, idx) => (
                          <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <Box sx={{ width: '100%' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  Submitted: {formatDateTime(complaint.submittedAt)}
                                </Typography>
                                {complaint.status && (
                                  <Chip 
                                    label={complaint.status} 
                                    size="small" 
                                    color={
                                      complaint.status === 'resolved' ? 'success' :
                                      complaint.status === 'closed' ? 'default' :
                                      complaint.status === 'investigating' ? 'warning' : 'error'
                                    } 
                                  />
                                )}
                              </Box>
                              {complaint.complaintType && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                  Type: {complaint.complaintType}
                                </Typography>
                              )}
                              {complaint.complaintText && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                  {complaint.complaintText}
                                </Typography>
                              )}
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

              {/* Call Metadata */}
              {(fullTranscriptData?.transcript || selectedTranscript) && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Call Metadata</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Duration: {formatDuration((fullTranscriptData?.transcript || selectedTranscript)?.duration)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Language: {(fullTranscriptData?.transcript || selectedTranscript)?.language || 'en-GB'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Result: {(fullTranscriptData?.transcript || selectedTranscript)?.result || 'resolved'}
                    </Typography>
                    {((fullTranscriptData?.transcript || selectedTranscript)?.confidenceScores?.overall !== undefined) && (
                      <Typography variant="body2" color="text.secondary">
                        Confidence: {(((fullTranscriptData?.transcript || selectedTranscript)?.confidenceScores?.overall || 0) * 100).toFixed(1)}%
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {selectedTranscript?.recordingUrl && (
            <Button 
              startIcon={playingCallSid === selectedTranscript.callSid ? <Pause /> : <PlayArrow />}
              onClick={() => handlePlayRecording(selectedTranscript.callSid)}
              color={playingCallSid === selectedTranscript.callSid ? 'primary' : 'default'}
            >
              {playingCallSid === selectedTranscript.callSid ? 'Pause Recording' : 'Play Recording'}
            </Button>
          )}
          <Button onClick={() => {
            setTranscriptDialog(false);
            setSelectedTranscript(null);
          }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Export Format Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Transcripts</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="format-label">Export Format</InputLabel>
            <Select
              labelId="format-label"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              label="Export Format"
            >
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
          <Button onClick={confirmExport} variant="contained" disabled={exportMutation.isLoading}>
            {exportMutation.isLoading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complaint Dialog */}
      <Dialog open={complaintDialog} onClose={() => setComplaintDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Complaint</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="complaint-type-label">Complaint Type</InputLabel>
            <Select
              labelId="complaint-type-label"
              value={complaintType}
              onChange={(e) => setComplaintType(e.target.value)}
              label="Complaint Type"
            >
              <MenuItem value="service_quality">Service Quality</MenuItem>
              <MenuItem value="ai_understanding">AI Understanding</MenuItem>
              <MenuItem value="response_time">Response Time</MenuItem>
              <MenuItem value="technical_issue">Technical Issue</MenuItem>
              <MenuItem value="billing">Billing</MenuItem>
              <MenuItem value="booking">Booking</MenuItem>
              <MenuItem value="instructor_conduct">Instructor Conduct</MenuItem>
              <MenuItem value="safety_concern">Safety Concern</MenuItem>
              <MenuItem value="discrimination">Discrimination</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField
            multiline
            rows={4}
            fullWidth
            label="Complaint Details"
            placeholder="Describe your complaint..."
            value={complaintText}
            onChange={(e) => setComplaintText(e.target.value)}
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Your complaint will be sent to: <strong>complaints@universalmct.co.uk</strong> (for the attention of John McGregor, Manager)
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setComplaintDialog(false);
            setComplaintText('');
            setComplaintType('service_quality');
          }}>Cancel</Button>
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

      {/* Complaint Detail Dialog */}
      <Dialog open={complaintDetailDialog} onClose={() => setComplaintDetailDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Complaint Details
          {selectedComplaint?.complaint && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2, fontFamily: 'monospace' }}>
              ID: {selectedComplaint.complaint._id}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedComplaint?.complaint && (
            <>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'error.main' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Gavel color="error" />
                  <Typography variant="h6">Complaint Email</Typography>
                </Box>
                <Typography variant="body1" fontWeight="bold" color="error.main">
                  {selectedComplaint.complaint.complaintEmail || 'complaints@universalmct.co.uk'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  For the attention of John McGregor, Manager
                </Typography>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Complaint Information</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mt: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Caller ID</Typography>
                    <Typography variant="body2" fontFamily="monospace">{selectedComplaint.complaint.callerId}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Submitted</Typography>
                    <Typography variant="body2">{formatDateTime(selectedComplaint.complaint.submittedAt)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Type</Typography>
                    <Chip label={selectedComplaint.complaint.complaintType?.replace('_', ' ') || 'other'} size="small" />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Chip 
                      label={selectedComplaint.complaint.status} 
                      color={getComplaintStatusColor(selectedComplaint.complaint.status)} 
                      size="small" 
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Priority</Typography>
                    <Chip 
                      label={selectedComplaint.complaint.priority} 
                      color={getPriorityColor(selectedComplaint.complaint.priority)} 
                      size="small" 
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Assigned To</Typography>
                    <Typography variant="body2">
                      {selectedComplaint.complaint.assignedTo || 'Unassigned'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Complaint Text</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  {selectedComplaint.complaint.complaintText}
                </Typography>
              </Box>

              {selectedComplaint.complaint.resolution && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Resolution</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    {selectedComplaint.complaint.resolution}
                  </Typography>
                </Box>
              )}

              {selectedComplaint?.escalations && selectedComplaint.escalations.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Timeline color="warning" />
                        <Typography variant="subtitle2">Escalation Timeline</Typography>
                        <Chip label={selectedComplaint.escalations.length} size="small" color="warning" />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {selectedComplaint.escalations.map((esc, idx) => (
                          <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <Box sx={{ width: '100%' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {formatDateTime(esc.initiatedAt)}
                                </Typography>
                                <Chip 
                                  label={esc.escalationStatus || 'initiated'} 
                                  size="small" 
                                  color={esc.escalationStatus === 'completed' ? 'success' : 'warning'} 
                                />
                              </Box>
                              {esc.reason && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  Reason: {esc.reason.replace('_', ' ')}
                                </Typography>
                              )}
                              {esc.summary && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  Summary: {esc.summary}
                                </Typography>
                              )}
                              {esc.handoverSummary && (
                                <Typography variant="body2" color="text.secondary">
                                  Handover: {esc.handoverSummary}
                                </Typography>
                              )}
                              {esc.targetNumber && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  Target: {esc.targetNumber}
                                </Typography>
                              )}
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

              {selectedComplaint?.callRecord && (
                <Box sx={{ mt: 3 }}>
                  <Button 
                    variant="outlined" 
                    startIcon={<Visibility />}
                    onClick={() => {
                      setComplaintDetailDialog(false);
                      setSelectedTranscript(selectedComplaint.callRecord);
                      setTranscriptDialog(true);
                    }}
                  >
                    View Related Transcript
                  </Button>
                </Box>
              )}

              {canSeeAll && (
                <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button 
                    variant="outlined" 
                    onClick={() => {
                      setNewStatus(selectedComplaint.complaint.status);
                      setStatusUpdateDialog(true);
                    }}
                  >
                    Update Status
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={() => {
                      setNewAssignedTo(selectedComplaint.complaint.assignedTo || '');
                      setAssignDialog(true);
                    }}
                  >
                    Assign Manager
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={() => {
                      setNewPriority(selectedComplaint.complaint.priority);
                      setPriorityUpdateDialog(true);
                    }}
                  >
                    Update Priority
                  </Button>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComplaintDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusUpdateDialog} onClose={() => setStatusUpdateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Complaint Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="new-status-label">Status</InputLabel>
            <Select
              labelId="new-status-label"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              label="Status"
            >
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="investigating">Investigating</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>
          <TextField
            multiline
            rows={4}
            fullWidth
            label="Resolution Notes (optional)"
            value={newResolution}
            onChange={(e) => setNewResolution(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Add resolution notes..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusUpdateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateStatus} 
            variant="contained" 
            disabled={!newStatus || statusUpdateMutation.isLoading}
          >
            {statusUpdateMutation.isLoading ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Complaint to Manager</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Manager Email"
            value={newAssignedTo}
            onChange={(e) => setNewAssignedTo(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="e.g., john.mcgregor@universalmct.co.uk"
            helperText="Default: complaints@universalmct.co.uk (John McGregor, Manager)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAssign} 
            variant="contained" 
            disabled={!newAssignedTo.trim() || assignMutation.isLoading}
          >
            {assignMutation.isLoading ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Priority Update Dialog */}
      <Dialog open={priorityUpdateDialog} onClose={() => setPriorityUpdateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Complaint Priority</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="new-priority-label">Priority</InputLabel>
            <Select
              labelId="new-priority-label"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              label="Priority"
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriorityUpdateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdatePriority} 
            variant="contained" 
            disabled={!newPriority || priorityUpdateMutation.isLoading}
          >
            {priorityUpdateMutation.isLoading ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TranscriptsComplaintsPage;
