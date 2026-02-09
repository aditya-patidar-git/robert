import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import transcriptService from '../../../services/transcriptService';
import complaintService from '../../../services/complaintService';
import { canAttemptPlayback } from '../utils';

export const useTranscriptsState = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const canSeeAll = user?.role === 'owner' || user?.role === 'admin';

  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    result: '',
    consentStatus: '',
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

  // Queries
  const { data: transcriptData, isLoading: isLoadingTranscripts } = useQuery({
    queryKey: ['transcripts', user?.id, filters],
    queryFn: async () => {
      const response = await transcriptService.getAllTranscripts(filters);
      if (response.success && response.data) {
        if (response.data.transcripts && response.data.pagination) {
          return response.data;
        }
        return { transcripts: response.data, pagination: null };
      }
      return response.data || response;
    }
  });

  const transcripts = transcriptData?.transcripts || [];
  const pagination = transcriptData?.pagination;

  useEffect(() => {
    const list = transcriptData?.transcripts;
    if (!list?.length) return;
    const callSids = list.filter((t) => t.callSid && canAttemptPlayback(t)).map((t) => t.callSid);
    if (callSids.length === 0) return;
    transcriptService.ensureRecordings(callSids).catch(() => {});
  }, [transcriptData?.transcripts, filters.page]);

  const { data: complaintData, isLoading: isLoadingComplaints } = useQuery({
    queryKey: ['complaints', complaintFilters],
    queryFn: async () => {
      const response = await complaintService.getAllComplaints(complaintFilters);
      if (response.success && response.data) {
        if (response.data.complaints && response.data.pagination) {
          return response.data;
        }
        return { complaints: response.data, pagination: null };
      }
      return response.data || response;
    }
  });

  const complaints = complaintData?.complaints || [];
  const complaintPagination = complaintData?.pagination;

  const { data: fullTranscriptData, isLoading: isLoadingTranscript } = useQuery({
    queryKey: ['transcript', selectedTranscript?._id || selectedTranscript?.id],
    queryFn: async () => {
      const response = await transcriptService.getTranscript(selectedTranscript?._id || selectedTranscript?.id);
      if (response.success && response.data) {
        if (response.data.transcript || response.data.escalations || response.data.complaints || response.data.provenance) {
          return response.data;
        }
        return { transcript: response.data, escalations: [], complaints: [], provenance: [] };
      }
      return response.data || response;
    },
    enabled: !!selectedTranscript && transcriptDialog && !!(selectedTranscript?._id || selectedTranscript?.id)
  });

  // Mutations
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
    onError: (error, variables) => {
      // Check if error indicates opt-out scenario
      const errorMessage = error?.response?.data?.error || error?.message || '';
      if (errorMessage.includes('not available') || errorMessage.includes('opt') || errorMessage.includes('consent')) {
        showError('Transcript not available - customer opted out of recording consent');
      } else {
        showError('Failed to export transcripts');
      }
      setExportDialog(false);
    }
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

  return {
    // Auth
    user,
    canSeeAll,
    
    // State
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
    
    // Queries
    transcripts,
    pagination,
    complaints,
    complaintPagination,
    isLoadingTranscripts,
    isLoadingComplaints,
    fullTranscriptData,
    isLoadingTranscript,
    
    // Mutations
    exportMutation,
    deleteMutation,
    
    // Query client
    queryClient,
    
    // Toast
    showSuccess,
    showError
  };
};



