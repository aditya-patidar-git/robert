import React, { useState, useCallback } from 'react';
import {
  
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  CircularProgress,
  Typography as MuiTypography
} from '@mui/material';
import { SmartToy, Person, Description, Timeline, ExpandMore } from '@mui/icons-material';
import { useTranscriptsState } from './hooks/useTranscriptsState';
import TranscriptsTab from './tabs/TranscriptsTab';
import ComplaintsTab from './tabs/ComplaintsTab';
import { getComplaintPriority, COMPLAINT_TYPE_OPTIONS } from './constants';
import { getConfidenceColor, formatConfidenceScore } from './utils';
import transcriptService from '../../services/transcriptService';
import complaintService from '../../services/complaintService';
import { formatDateTime } from '../../utils/formatters';
import { useMutation } from '@tanstack/react-query';

function parseSummary(summary) {
  if (typeof summary !== 'string' || !summary.trim()) return null;
  try {
    const parsed = JSON.parse(summary);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {}
  return null;
}

const TranscriptsComplaintsPage = () => {
  const [currentTab, setCurrentTab] = useState(0);
  
  // Get all state and functions from the hook
  const state = useTranscriptsState();
  const {
    user,
    canSeeAll,
    filters,
    setFilters,
    complaintFilters,
    setComplaintFilters,
    selectedTranscript,
    setSelectedTranscript,
    transcriptDialog,
    setTranscriptDialog,
    complaintDialog,
    setComplaintDialog,
    complaintText,
    setComplaintText,
    complaintType,
    setComplaintType,
    deleteDialog,
    setDeleteDialog,
    transcriptToDelete,
    setTranscriptToDelete,
    exportFormat,
    setExportFormat,
    exportDialog,
    setExportDialog,
    playingAudio,
    setPlayingAudio,
    playingCallSid,
    setPlayingCallSid,
    selectedComplaint,
    setSelectedComplaint,
    complaintDetailDialog,
    setComplaintDetailDialog,
    statusUpdateDialog,
    setStatusUpdateDialog,
    assignDialog,
    setAssignDialog,
    priorityUpdateDialog,
    setPriorityUpdateDialog,
    newStatus,
    setNewStatus,
    newResolution,
    setNewResolution,
    newAssignedTo,
    setNewAssignedTo,
    newPriority,
    setNewPriority,
    transcripts,
    pagination,
    complaints,
    complaintPagination,
    isLoadingComplaints,
    fullTranscriptData,
    isLoadingTranscript,
    exportMutation,
    deleteMutation,
    queryClient,
    showSuccess,
    showError
  } = state;

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

  // Handlers
  const handleViewTranscript = useCallback((transcript) => {
    // Check consent before opening dialog
    if (transcript?.recordingConsent?.given === false) {
      showError('Transcript not available: The customer did not provide consent for call recording. In compliance with GDPR, transcripts are not stored when consent is not given.');
      return;
    }
    setSelectedTranscript(transcript);
    setTranscriptDialog(true);
  }, [setSelectedTranscript, setTranscriptDialog, showError]);

  const handlePlayRecording = useCallback(async (callSid) => {
    try {
      // Validate callSid
      if (!callSid) {
        showError('Call ID is required to play recording');
        return;
      }

      // Check for opt-out - look up transcript by callSid
      const transcript = transcripts.find(t => t.callSid === callSid);
      if (transcript?.recordingConsent?.given === false) {
        showError('Recording not available: The customer did not provide consent for call recording. In compliance with GDPR, we do not store recordings when consent is not given.');
        return;
      }

      // If already playing this recording, pause it
      if (playingCallSid === callSid && playingAudio) {
        playingAudio.pause();
        // Clean up blob URL if it exists
        if (playingAudio.src && playingAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(playingAudio.src);
        }
        setPlayingAudio(null);
        setPlayingCallSid(null);
        return;
      }

      // Stop any currently playing audio and clean up blob URLs
      if (playingAudio) {
        playingAudio.pause();
        playingAudio.currentTime = 0;
        // Clean up blob URL if it exists
        if (playingAudio.src && playingAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(playingAudio.src);
        }
        playingAudio.src = '';
      }

      // Get recording URL
      const audioUrl = await transcriptService.getRecordingUrl(callSid);
      
      if (!audioUrl) {
        showError('Recording URL could not be generated');
        return;
      }

      // Fetch audio as blob with authentication, then create blob URL for audio element
      // This is necessary because HTML5 audio elements can't send Authorization headers
      const token = localStorage.getItem('authToken');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      let audioBlobUrl = null;
      try {
        const audioResponse = await fetch(audioUrl, {
          method: 'GET',
          headers,
          credentials: 'include'
        });
        
        if (!audioResponse.ok) {
          if (audioResponse.status === 401 || audioResponse.status === 403) {
            showError('You do not have permission to access this recording.');
            return;
          } else if (audioResponse.status === 404) {
            const transcript = transcripts.find(t => t.callSid === callSid);
            if (transcript?.recordingConsent?.given === false) {
              showError('Recording not available: The customer did not provide consent for call recording. In compliance with GDPR, we do not store recordings when consent is not given.');
            } else {
              showError('Recording not found. The recording may not be available for this call.');
            }
            return;
          } else {
            showError(`Recording unavailable (${audioResponse.status}). Please try again later.`);
            return;
          }
        }
        
        // Get the audio as blob
        const audioBlob = await audioResponse.blob();
        
        // Check if blob is actually audio
        if (!audioBlob.type.startsWith('audio/')) {
          showError('Recording format not supported. Expected audio format.');
          return;
        }
        
        // Create blob URL for audio element
        audioBlobUrl = URL.createObjectURL(audioBlob);
      } catch (fetchError) {
        console.error('Error fetching audio:', fetchError);
        showError('Failed to load recording. Please try again.');
        return;
      }
      
      if (!audioBlobUrl) {
        showError('Failed to create audio source.');
        return;
      }

      // Create and configure audio element with blob URL
      const audio = new Audio(audioBlobUrl);
      
      // Set up event listeners before attempting to play
      audio.addEventListener('ended', () => {
        // Clean up blob URL when done
        if (audioBlobUrl) {
          URL.revokeObjectURL(audioBlobUrl);
        }
        setPlayingAudio(null);
        setPlayingCallSid(null);
      });
      
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e, audio.error);
        // Clean up blob URL on error
        if (audioBlobUrl) {
          URL.revokeObjectURL(audioBlobUrl);
        }
        let errorMessage = 'Failed to play recording.';
        
        if (audio.error) {
          switch (audio.error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorMessage = 'Playback was aborted.';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error while loading recording.';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorMessage = 'Recording format not supported by your browser.';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Recording format not supported.';
              break;
            default:
              errorMessage = 'The recording may not be available or the format is not supported.';
          }
        }
        
        showError(errorMessage);
        setPlayingAudio(null);
        setPlayingCallSid(null);
      });

      audio.addEventListener('loadstart', () => {
        // Audio is starting to load
      });

      audio.addEventListener('canplay', () => {
        // Audio is ready to play
      });

      // Attempt to play the audio
      try {
        await audio.play();
        setPlayingAudio(audio);
        setPlayingCallSid(callSid);
      } catch (playError) {
        // Clean up blob URL on play error
        if (audioBlobUrl) {
          URL.revokeObjectURL(audioBlobUrl);
        }
        console.error('Error playing audio:', playError);
        // Handle browser autoplay restrictions
        if (playError.name === 'NotAllowedError') {
          showError('Please interact with the page first to enable audio playback');
        } else if (playError.name === 'NotSupportedError') {
          showError('Audio format not supported by your browser');
        } else {
          showError('Failed to play recording. Please try again.');
        }
        setPlayingAudio(null);
        setPlayingCallSid(null);
      }
    } catch (error) {
      console.error('Error in handlePlayRecording:', error);
      // Check if error is due to opt-out
      const transcript = transcripts.find(t => t.callSid === callSid);
      if (transcript?.recordingConsent?.given === false) {
        showError('Recording not available: The customer did not provide consent for call recording. In compliance with GDPR, we do not store recordings when consent is not given.');
      } else {
        showError('Failed to play recording. Please check if the recording is available.');
      }
      setPlayingAudio(null);
      setPlayingCallSid(null);
    }
  }, [playingCallSid, playingAudio, showError, setPlayingAudio, setPlayingCallSid, transcripts]);

  const handleExport = useCallback((params = {}) => {
    // Check for opt-out if exporting a single transcript
    if (params.id) {
      const transcript = transcripts.find(t => (t.id === params.id || t._id === params.id));
      if (transcript?.recordingConsent?.given === false) {
        showError('Transcript not available for export: The customer did not provide consent for call recording. In compliance with GDPR, transcripts are not stored when consent is not given.');
        return;
      }
    }
    
    if (canSeeAll && !params.id) {
      setExportDialog(true);
    } else {
      exportMutation.mutate({ format: exportFormat, ...params });
    }
  }, [canSeeAll, exportFormat, exportMutation, setExportDialog, transcripts, showError]);

  const confirmExport = useCallback(() => {
    exportMutation.mutate({ format: exportFormat, ...filters });
  }, [exportFormat, filters, exportMutation]);

  const handleSubmitComplaint = useCallback(async () => {
    try {
      // Auto-set priority based on complaint type (high-risk types get 'urgent')
      const priority = getComplaintPriority(complaintType);
      
      await transcriptService.submitComplaint({
        callId: selectedTranscript?.callSid,
        complaintText,
        complaintType: complaintType,
        callerId: selectedTranscript?.from,
        priority
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
  }, [selectedTranscript, complaintText, complaintType, showSuccess, showError, setComplaintDialog, setComplaintText, setComplaintType, queryClient]);

  const handleDeleteTranscript = useCallback((transcript) => {
    setTranscriptToDelete(transcript);
    setDeleteDialog(true);
  }, [setTranscriptToDelete, setDeleteDialog]);

  const confirmDelete = useCallback(() => {
    if (transcriptToDelete) {
      deleteMutation.mutate(transcriptToDelete._id || transcriptToDelete.id);
    }
  }, [transcriptToDelete, deleteMutation]);

  const getChipColor = useCallback((status) => {
    switch (status) {
      case 'resolved': return 'success';
      case 'escalated': return 'warning';
      case 'voicemail': return 'info';
      case 'error': return 'error';
      default: return 'default';
    }
  }, []);

  const getComplaintStatusColor = useCallback((status) => {
    switch (status) {
      case 'resolved': return 'success';
      case 'closed': return 'default';
      case 'investigating': return 'warning';
      case 'open': return 'error';
      default: return 'default';
    }
  }, []);

  const getPriorityColor = useCallback((priority) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  }, []);

  const handleViewComplaint = useCallback(async (complaint) => {
    try {
      const data = await complaintService.getComplaint(complaint._id || complaint.id);
      setSelectedComplaint(data?.data ?? data);
      setComplaintDetailDialog(true);
    } catch (error) {
      showError('Failed to load complaint details');
    }
  }, [setSelectedComplaint, setComplaintDetailDialog, showError]);

  const handleUpdateStatus = useCallback(() => {
    if (selectedComplaint?.complaint?._id) {
      statusUpdateMutation.mutate({
        complaintId: selectedComplaint.complaint._id,
        status: newStatus,
        resolution: newResolution
      });
    }
  }, [selectedComplaint, newStatus, newResolution, statusUpdateMutation]);

  const handleAssign = useCallback(() => {
    if (selectedComplaint?.complaint?._id) {
      assignMutation.mutate({
        complaintId: selectedComplaint.complaint._id,
        assignedTo: newAssignedTo
      });
    }
  }, [selectedComplaint, newAssignedTo, assignMutation]);

  const handleUpdatePriority = useCallback(() => {
    if (selectedComplaint?.complaint?._id) {
      priorityUpdateMutation.mutate({
        complaintId: selectedComplaint.complaint._id,
        priority: newPriority
      });
    }
  }, [selectedComplaint, newPriority, priorityUpdateMutation]);

  const renderTranscriptContent = useCallback((transcript, parentData = null) => {
    // Handle multiple possible data structures
    let transcriptArray = null;
    
    if (Array.isArray(transcript)) {
      // If transcript is directly an array
      transcriptArray = transcript;
    } else if (transcript?.transcript && Array.isArray(transcript.transcript)) {
      // If transcript.transcript is an array
      transcriptArray = transcript.transcript;
    } else if (transcript?.turns && Array.isArray(transcript.turns)) {
      // If transcript.turns is an array
      transcriptArray = transcript.turns;
    } else if (transcript?.data?.transcript && Array.isArray(transcript.data.transcript)) {
      // If transcript.data.transcript is an array
      transcriptArray = transcript.data.transcript;
    }
    
    // Check for opt-out scenario - check both transcript object and parentData
    const recordingConsent = transcript?.recordingConsent || parentData?.recordingConsent || 
                             (parentData?.transcript ? parentData.transcript.recordingConsent : null);
    
    if (!transcriptArray || transcriptArray.length === 0) {
      // Check if empty due to opt-out
      if (recordingConsent?.given === false) {
        return (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="error" gutterBottom>
              Transcript Not Available
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              The customer did not provide consent for call recording and transcript storage.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              In compliance with GDPR regulations, we do not store transcripts when recording consent is not given.
            </Typography>
          </Box>
        );
      }
      return <Typography color="text.secondary">No transcript available</Typography>;
    }

    return (
      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
        {transcriptArray.map((turn, idx) => {
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
                  {turn.text || turn.content || turn.message || ''}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  }, []);

  // Prepare state and handlers for tabs
  const tabState = {
    ...state,
    statusUpdateMutation,
    assignMutation,
    priorityUpdateMutation
  };

  const tabHandlers = {
    handleViewTranscript,
    handlePlayRecording,
    handleExport,
    handleDeleteTranscript,
    handleViewComplaint,
    getChipColor,
    getComplaintStatusColor,
    getPriorityColor
  };

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1"
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '1.75rem', md: '2rem' },
            color: 'text.primary',
            mb: 1
          }}
        >
          Transcripts & Complaints
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.9375rem'
          }}
        >
          {canSeeAll
            ? 'Manage call transcripts, recordings, and customer complaints'
            : 'View your call transcripts and submit complaints'}
        </Typography>
      </Box>

      <Paper 
        elevation={0}
        sx={{ 
          mb: 3,
          borderRadius: 2
        }}
      >
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

      {/* Tab Content */}
      {currentTab === 0 && (
        <TranscriptsTab state={tabState} handlers={tabHandlers} />
      )}

      {currentTab === 1 && (
        <ComplaintsTab state={tabState} handlers={tabHandlers} />
      )}

      {/* Dialogs */}
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
              {/* Display transcript - try fullTranscriptData first, then fallback to selectedTranscript */}
              {(() => {
                // The backend returns: { transcript: CallRecord, escalations: [...], ... }
                // CallRecord has a transcript array field
                let transcriptToRender = null;
                let parentData = null;
                
                if (fullTranscriptData) {
                  // If fullTranscriptData has a transcript property (the CallRecord object)
                  if (fullTranscriptData.transcript) {
                    transcriptToRender = fullTranscriptData.transcript;
                    parentData = fullTranscriptData.transcript; // The CallRecord object
                  } else {
                    // If fullTranscriptData itself is the CallRecord
                    transcriptToRender = fullTranscriptData;
                    parentData = fullTranscriptData;
                  }
                } else if (selectedTranscript) {
                  transcriptToRender = selectedTranscript;
                  parentData = selectedTranscript;
                }
                
                if (transcriptToRender) {
                  return renderTranscriptContent(transcriptToRender, parentData);
                }
                
                // Check for opt-out in selectedTranscript or fullTranscriptData
                const recordingConsent = fullTranscriptData?.transcript?.recordingConsent || 
                                        fullTranscriptData?.recordingConsent || 
                                        selectedTranscript?.recordingConsent;

                if (recordingConsent?.given === false) {
                  return (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="h6" color="error" gutterBottom>
                        Transcript Not Available
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        The customer did not provide consent for call recording and transcript storage.
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        In compliance with GDPR regulations, we do not store transcripts when recording consent is not given.
                      </Typography>
                    </Box>
                  );
                }
                return <Typography color="text.secondary">No transcript available</Typography>;
              })()}
              
              {/* Display summary */}
              {(() => {
                const summaryRaw = fullTranscriptData?.transcript?.summary ?? fullTranscriptData?.summary ?? selectedTranscript?.summary;
                if (!summaryRaw) return null;
                const summaryObj = parseSummary(summaryRaw);
                return (
                  <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>AI Summary</Typography>
                    {summaryObj ? (
                      <Box component="dl" sx={{ m: 0, '& > *': { mb: 1.5 } }}>
                        {summaryObj.purpose != null && (
                          <>
                            <Typography component="dt" variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Purpose</Typography>
                            <Typography component="dd" variant="body2" sx={{ ml: 0, mt: 0.25 }}>{summaryObj.purpose}</Typography>
                          </>
                        )}
                        {summaryObj.outcome != null && (
                          <>
                            <Typography component="dt" variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Outcome</Typography>
                            <Typography component="dd" variant="body2" sx={{ ml: 0, mt: 0.25 }}>{summaryObj.outcome}</Typography>
                          </>
                        )}
                        {summaryObj.nextSteps != null && (
                          <>
                            <Typography component="dt" variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Next steps</Typography>
                            <Typography component="dd" variant="body2" sx={{ ml: 0, mt: 0.25 }}>{summaryObj.nextSteps}</Typography>
                          </>
                        )}
                        {Array.isArray(summaryObj.keyFacts) && summaryObj.keyFacts.length > 0 && (
                          <>
                            <Typography component="dt" variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Key facts</Typography>
                            <Box component="dd" sx={{ ml: 0, mt: 0.25 }}>
                              <List dense disablePadding sx={{ listStyleType: 'disc', pl: 2.5 }}>
                                {summaryObj.keyFacts.map((fact, i) => (
                                  <ListItem key={i} disablePadding sx={{ display: 'list-item', py: 0.25 }}>
                                    <Typography variant="body2">{fact}</Typography>
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          </>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2">{summaryRaw}</Typography>
                    )}
                  </Box>
                );
              })()}

              {/* Display confidence scores */}
              {(() => {
                const scores = fullTranscriptData?.transcript?.confidenceScores || 
                               fullTranscriptData?.confidenceScores || 
                               selectedTranscript?.confidenceScores;
                if (!scores) return null;
                
                return (
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {scores.overall !== undefined && (
                      <Chip 
                        label={`Overall: ${formatConfidenceScore(scores.overall)}`}
                        color={getConfidenceColor(scores.overall)}
                        size="small"
                      />
                    )}
                    {scores.understanding !== undefined && (
                      <Chip 
                        label={`Understanding: ${formatConfidenceScore(scores.understanding)}`}
                        color={getConfidenceColor(scores.understanding)}
                        size="small"
                      />
                    )}
                    {scores.transcription !== undefined && (
                      <Chip 
                        label={`Transcription: ${formatConfidenceScore(scores.transcription)}`}
                        color={getConfidenceColor(scores.transcription)}
                        size="small"
                      />
                    )}
                  </Box>
                );
              })()}

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
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTranscriptDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Complaint Submission Dialog */}
      <Dialog open={complaintDialog} onClose={() => setComplaintDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Complaint</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Complaint Type</InputLabel>
              <Select
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
              fullWidth
              multiline
              rows={4}
              label="Complaint Details"
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder="Please describe your complaint..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComplaintDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitComplaint} disabled={!complaintText.trim()}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Transcript</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this transcript? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={deleteMutation.isLoading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
        <DialogTitle>Export Transcripts</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Format</InputLabel>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              label="Format"
            >
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={confirmExport} disabled={exportMutation.isLoading}>
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complaint Detail Dialog */}
      <Dialog open={complaintDetailDialog} onClose={() => setComplaintDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Complaint Details</DialogTitle>
        <DialogContent>
          {selectedComplaint?.complaint && (
            <Box>
              <Typography variant="h6" gutterBottom>{selectedComplaint.complaint.complaintType}</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {selectedComplaint.complaint.complaintText}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={selectedComplaint.complaint.status} color={getComplaintStatusColor(selectedComplaint.complaint.status)} />
                <Chip label={selectedComplaint.complaint.priority} color={getPriorityColor(selectedComplaint.complaint.priority)} />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedComplaint?.callRecord && (
            <Button 
              onClick={() => {
                setSelectedTranscript(selectedComplaint.callRecord);
                setComplaintDetailDialog(false);
                setTranscriptDialog(true);
              }}
            >
              View Call Transcript
            </Button>
          )}
          <Button onClick={() => setComplaintDetailDialog(false)}>Close</Button>
          {canSeeAll && (
            <>
              <Button onClick={() => setStatusUpdateDialog(true)}>Update Status</Button>
              <Button onClick={() => setAssignDialog(true)}>Assign</Button>
              <Button onClick={() => setPriorityUpdateDialog(true)}>Update Priority</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusUpdateDialog} onClose={() => setStatusUpdateDialog(false)}>
        <DialogTitle>Update Complaint Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select
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
            fullWidth
            multiline
            rows={3}
            label="Resolution Notes"
            value={newResolution}
            onChange={(e) => setNewResolution(e.target.value)}
            placeholder="Optional resolution notes..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusUpdateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateStatus} disabled={!newStatus || statusUpdateMutation.isLoading}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)}>
        <DialogTitle>Assign Complaint</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Assign To"
            value={newAssignedTo}
            onChange={(e) => setNewAssignedTo(e.target.value)}
            placeholder="Enter user email or name"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssign} disabled={!newAssignedTo.trim() || assignMutation.isLoading}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Priority Update Dialog */}
      <Dialog open={priorityUpdateDialog} onClose={() => setPriorityUpdateDialog(false)}>
        <DialogTitle>Update Complaint Priority</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              label="Priority"
            >
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriorityUpdateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdatePriority} disabled={!newPriority || priorityUpdateMutation.isLoading}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TranscriptsComplaintsPage;
