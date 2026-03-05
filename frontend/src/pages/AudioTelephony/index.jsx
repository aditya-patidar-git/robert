import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert
} from '@mui/material';
import { Save, PlayArrow, VolumeUp, Mic, Phone, Headset, Settings } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { useAudioTelephonyState } from './hooks/useAudioTelephonyState';
import AudioSettingsTab from './tabs/AudioSettingsTab';
import VoiceManagementTab from './tabs/VoiceManagementTab';
import TelephonyRoutingTab from './tabs/TelephonyRoutingTab';
import CallQualityTab from './tabs/CallQualityTab';
import SIPConfigurationTab from './tabs/SIPConfigurationTab';
import PhoneNumberForm from './components/PhoneNumberForm';
import TransferNumberForm from './components/TransferNumberForm';
import ConfigSyncStatus from '../../components/common/ConfigSyncStatus';
import ConfirmSaveDialog from '../../components/common/ConfirmSaveDialog';
import { AGENT_AFFECTING_WARNINGS } from '../../constants/agentAffectingWarnings';
import configService from '../../services/configService';
import voiceService from '../../services/voiceService';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_VOICE_PREVIEW_TEXT } from '../../constants/voicePreview';

const AudioTelephonyPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [confirmMainSaveOpen, setConfirmMainSaveOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [confirmPhoneNumberOpen, setConfirmPhoneNumberOpen] = useState(false);
  const [pendingPhoneAction, setPendingPhoneAction] = useState(null);
  const [confirmTransferNumberOpen, setConfirmTransferNumberOpen] = useState(false);
  const [pendingTransferAction, setPendingTransferAction] = useState(null);
  const queryClient = useQueryClient();
  
  // Get all state and functions from the hook
  const state = useAudioTelephonyState();
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    showSuccess,
    showError,
    saveConfigMutation,
    voicePreviewMutation,
    addNumberDialog,
    setAddNumberDialog,
    editNumberDialog,
    setEditNumberDialog,
    deleteNumberDialog,
    setDeleteNumberDialog,
    numberToEdit,
    setNumberToEdit,
    numberToDelete,
    setNumberToDelete,
    addTransferNumberDialog,
    setAddTransferNumberDialog,
    editTransferNumberDialog,
    setEditTransferNumberDialog,
    transferNumberToEdit,
    setTransferNumberToEdit,
    voicePreviewDialog,
    setVoicePreviewDialog,
    selectedVoice,
    setSelectedVoice,
    previewAudioUrl,
    setPreviewAudioUrl,
    previewAudioElement,
    setPreviewAudioElement,
    isPlaying,
    setIsPlaying
  } = state;
  
  // Audio element ref for playback
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null); // Store blob URL for cleanup
  const intervalRef = useRef(null); // Store interval for cleanup

  // Fix accessibility issue: blur any focused elements when dialogs open
  useEffect(() => {
    const hasOpenDialog = voicePreviewDialog || addNumberDialog || editNumberDialog || 
                         deleteNumberDialog || addTransferNumberDialog || editTransferNumberDialog;
    
    if (hasOpenDialog) {
      // Blur any focused elements in the background to prevent aria-hidden issues
      const activeElement = document.activeElement;
      if (activeElement && activeElement !== document.body && 
          activeElement.tagName === 'BUTTON' && 
          !activeElement.closest('[role="dialog"]')) {
        activeElement.blur();
      }
    }
  }, [voicePreviewDialog, addNumberDialog, editNumberDialog, deleteNumberDialog, 
      addTransferNumberDialog, editTransferNumberDialog]);

  // Phone number mutations
  const addPhoneNumberMutation = useMutation({
    mutationFn: configService.addPhoneNumber,
    onSuccess: () => {
      showSuccess('Phone number added successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setAddNumberDialog(false);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to add phone number');
    }
  });

  const updatePhoneNumberMutation = useMutation({
    mutationFn: ({ number, data }) => configService.updatePhoneNumber(number, data),
    onSuccess: () => {
      showSuccess('Phone number updated successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setEditNumberDialog(false);
      setNumberToEdit(null);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to update phone number');
    }
  });

  const removePhoneNumberMutation = useMutation({
    mutationFn: configService.removePhoneNumber,
    onSuccess: () => {
      showSuccess('Phone number removed successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setDeleteNumberDialog(false);
      setNumberToDelete(null);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to remove phone number');
    }
  });

  const addTransferNumberMutation = useMutation({
    mutationFn: (transferNumbers) => {
      return configService.updateTelephonyConfig({ transferNumbers });
    },
    onSuccess: async (response) => {
      showSuccess('Transfer number added successfully');
      // Invalidate and refetch to get updated data
      queryClient.invalidateQueries(['telephony-config']);
      // Wait a bit for the refetch to complete, then ensure form is updated
      setTimeout(() => {
        queryClient.refetchQueries(['telephony-config']).then(() => {
          console.log('✅ [TRANSFER_NUMBERS] Refetch completed after add');
        });
      }, 100);
      setAddTransferNumberDialog(false);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to add transfer number');
    }
  });

  const updateTransferNumberMutation = useMutation({
    mutationFn: (transferNumbers) => {
      return configService.updateTelephonyConfig({ transferNumbers });
    },
    onSuccess: async () => {
      showSuccess('Transfer number updated successfully');
      // Invalidate and refetch to get updated data
      queryClient.invalidateQueries(['telephony-config']);
      // Wait a bit for the refetch to complete, then ensure form is updated
      setTimeout(() => {
        queryClient.refetchQueries(['telephony-config']).then(() => {
          console.log('✅ [TRANSFER_NUMBERS] Refetch completed after update');
        });
      }, 100);
      setEditTransferNumberDialog(false);
      setTransferNumberToEdit(null);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to update transfer number');
    }
  });

  // Handlers
  const onSubmit = useCallback((data) => {
    setPendingFormData(data);
    setConfirmMainSaveOpen(true);
  }, []);

  const handleConfirmMainSave = useCallback(() => {
    if (pendingFormData) {
      saveConfigMutation.mutate(pendingFormData);
      setConfirmMainSaveOpen(false);
      setPendingFormData(null);
    }
  }, [pendingFormData, saveConfigMutation]);

  const handleVoicePreview = useCallback((voice) => {
    console.log('🔵 [VOICE_PREVIEW] handleVoicePreview called with voice:', voice);
    if (!voice) {
      console.error('🔴 [VOICE_PREVIEW] No voice provided to handleVoicePreview');
      return;
    }
    if (!voice.id) {
      console.error('🔴 [VOICE_PREVIEW] Voice object missing id:', voice);
      return;
    }
    console.log('✅ [VOICE_PREVIEW] Setting selected voice and opening dialog');
    setSelectedVoice(voice);
    setVoicePreviewDialog(true);
    // Clear previous audio URL when opening dialog
    setPreviewAudioUrl(null);
  }, [setSelectedVoice, setVoicePreviewDialog, setPreviewAudioUrl]);

  const handlePlayPreview = useCallback((text) => {
    console.log('🔵 [VOICE_PREVIEW] handlePlayPreview called:', { 
      selectedVoice, 
      text,
      hasSelectedVoice: !!selectedVoice,
      voiceId: selectedVoice?.id 
    });
    
    if (!selectedVoice) {
      console.error('🔴 [VOICE_PREVIEW] No selected voice for preview');
      showError('No voice selected');
      return;
    }
    
    // Get primary model ID from form state
    const primaryModelId = watch('selectedModelId') || watch('selectedModel');
    console.log('🔵 [VOICE_PREVIEW] Primary model ID:', primaryModelId);
    
    const previewText = text || selectedVoice.sampleText || DEFAULT_VOICE_PREVIEW_TEXT;
    console.log('🔵 [VOICE_PREVIEW] Calling mutation with:', { 
      voiceId: selectedVoice.id, 
      text: previewText,
      modelId: primaryModelId
    });
    
    voicePreviewMutation.mutate({ 
      voiceId: selectedVoice.id, 
      text: previewText,
      modelId: primaryModelId
    });
  }, [selectedVoice, voicePreviewMutation, showError, watch]);
  
  // Handle audio playback when previewAudioUrl is set
  useEffect(() => {
    if (!previewAudioUrl) {
      console.log('🔵 [VOICE_PREVIEW] No audio URL to play');
      return;
    }
    
    console.log('🔵 [VOICE_PREVIEW] Audio URL available, setting up playback:', previewAudioUrl);
    
    // Clean up previous audio element
    if (audioRef.current) {
      console.log('🔵 [VOICE_PREVIEW] Cleaning up previous audio element');
      audioRef.current.pause();
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current.src = '';
      audioRef.current = null;
    }
    
    const playFromBlobUrl = (blobUrl) => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = blobUrl;
      intervalRef.current = setInterval(() => {
        if (!audioRef.current) return;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        const audio = audioRef.current;
        audio.src = blobUrl;
        const handleCanPlay = () => {
          setIsPlaying(true);
          audio.play().catch(err => {
            showError('Failed to play audio preview. Please check your browser audio settings.');
            setIsPlaying(false);
          });
        };
        const handleEnded = () => setIsPlaying(false);
        const handleError = (e) => {
          if (!audio.src || audio.src === '') return;
          let msg = 'Failed to play audio preview.';
          if (audio.error) {
            switch (audio.error.code) {
              case MediaError.MEDIA_ERR_ABORTED: msg = 'Audio playback was aborted.'; break;
              case MediaError.MEDIA_ERR_NETWORK: msg = 'Network error while loading audio.'; break;
              case MediaError.MEDIA_ERR_DECODE: msg = 'Audio format not supported by your browser.'; break;
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = 'Audio format not supported.'; break;
            }
          }
          showError(msg);
          setIsPlaying(false);
        };
        const handlePause = () => setIsPlaying(false);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.addEventListener('pause', handlePause);
        audio.load();
      }, 100);
      setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 5000);
    };

    if (previewAudioUrl.startsWith('blob:')) {
      playFromBlobUrl(previewAudioUrl);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }

    const fetchAudio = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002';
        const fullAudioUrl = previewAudioUrl.startsWith('http')
          ? previewAudioUrl
          : `${API_BASE}${previewAudioUrl.startsWith('/') ? '' : '/'}${previewAudioUrl}`;
        const token = localStorage.getItem('authToken');
        if (!token) {
          showError('Authentication required to play audio');
          return;
        }
        const response = await fetch(fullAudioUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        playFromBlobUrl(blobUrl);
      } catch (error) {
        console.error('🔴 [VOICE_PREVIEW] Error fetching audio:', error);
        showError(`Failed to load audio: ${error.message}`);
      }
    };

    fetchAudio();
    
    // Cleanup function
    return () => {
      console.log('🔵 [VOICE_PREVIEW] Cleaning up audio element');
      
      // Clear interval if still running
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [previewAudioUrl, setIsPlaying, showError]);
  
  // Cleanup audio when dialog closes
  useEffect(() => {
    if (!voicePreviewDialog) {
      console.log('🔵 [VOICE_PREVIEW] Dialog closed, cleaning up audio');
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setPreviewAudioElement(null);
      setPreviewAudioUrl(null);
      setIsPlaying(false);
    }
  }, [voicePreviewDialog, setIsPlaying, setPreviewAudioElement, setPreviewAudioUrl]);

  const handleAddNumber = useCallback((numberData) => {
    setPendingPhoneAction({ type: 'add', data: numberData });
    setConfirmPhoneNumberOpen(true);
  }, []);

  const handleEditNumber = useCallback((number, numberData) => {
    setPendingPhoneAction({ type: 'edit', number, data: numberData });
    setConfirmPhoneNumberOpen(true);
  }, []);

  const handleDeleteNumber = useCallback((number) => {
    removePhoneNumberMutation.mutate(number);
  }, [removePhoneNumberMutation]);

  const handleConfirmPhoneNumber = useCallback(() => {
    if (!pendingPhoneAction) return;
    if (pendingPhoneAction.type === 'add') {
      addPhoneNumberMutation.mutate(pendingPhoneAction.data);
      setAddNumberDialog(false);
    } else if (pendingPhoneAction.type === 'edit') {
      updatePhoneNumberMutation.mutate({ number: pendingPhoneAction.number, data: pendingPhoneAction.data });
      setEditNumberDialog(false);
      setNumberToEdit(null);
    } else if (pendingPhoneAction.type === 'delete') {
      removePhoneNumberMutation.mutate(pendingPhoneAction.number);
      setDeleteNumberDialog(false);
      setNumberToDelete(null);
    }
    setConfirmPhoneNumberOpen(false);
    setPendingPhoneAction(null);
  }, [pendingPhoneAction, addPhoneNumberMutation, updatePhoneNumberMutation, removePhoneNumberMutation, setAddNumberDialog, setEditNumberDialog, setNumberToEdit, setDeleteNumberDialog, setNumberToDelete]);

  const handleOpenEditNumber = useCallback((number) => {
    setNumberToEdit(number);
    setEditNumberDialog(true);
  }, [setNumberToEdit, setEditNumberDialog]);

  const handleOpenDeleteNumber = useCallback((number) => {
    setNumberToDelete(number);
    setDeleteNumberDialog(true);
  }, [setNumberToDelete, setDeleteNumberDialog]);

  const handleAddTransferNumber = useCallback((transferNumberData) => {
    const transferNumbers = watch('transferNumbers') || [];
    const updated = [...transferNumbers, transferNumberData];
    setPendingTransferAction({ type: 'add', updated });
    setConfirmTransferNumberOpen(true);
  }, [watch]);

  const handleEditTransferNumber = useCallback((index, transferNumberData) => {
    const transferNumbers = watch('transferNumbers') || [];
    const updated = [...transferNumbers];
    updated[index] = transferNumberData;
    setPendingTransferAction({ type: 'edit', updated });
    setConfirmTransferNumberOpen(true);
  }, [watch]);

  const handleDeleteTransferNumber = useCallback((index) => {
    const transferNumbers = watch('transferNumbers') || [];
    const updated = transferNumbers.filter((_, i) => i !== index);
    setPendingTransferAction({ type: 'delete', updated });
    setConfirmTransferNumberOpen(true);
  }, [watch]);

  const handleConfirmTransferNumber = useCallback(() => {
    if (!pendingTransferAction) return;
    const { updated } = pendingTransferAction;
    setValue('transferNumbers', updated, { shouldDirty: true });
    if (pendingTransferAction.type === 'add') {
      addTransferNumberMutation.mutate(updated);
      setAddTransferNumberDialog(false);
    } else if (pendingTransferAction.type === 'edit') {
      updateTransferNumberMutation.mutate(updated);
      setEditTransferNumberDialog(false);
      setTransferNumberToEdit(null);
    } else {
      updateTransferNumberMutation.mutate(updated);
    }
    setConfirmTransferNumberOpen(false);
    setPendingTransferAction(null);
  }, [pendingTransferAction, setValue, addTransferNumberMutation, updateTransferNumberMutation, setAddTransferNumberDialog, setEditTransferNumberDialog, setTransferNumberToEdit]);

  const handleOpenEditTransferNumber = useCallback((index) => {
    const transferNumbers = watch('transferNumbers') || [];
    setTransferNumberToEdit({ index, data: transferNumbers[index] });
    setEditTransferNumberDialog(true);
  }, [watch, setTransferNumberToEdit, setEditTransferNumberDialog]);

  // Prepare state and handlers for tabs
  const tabState = state;
  const tabHandlers = {
    handleVoicePreview,
    handleOpenEditNumber,
    handleOpenDeleteNumber,
    handleEditNumber,
    setAddNumberDialog,
    setAddTransferNumberDialog,
    handleOpenEditTransferNumber,
    handleDeleteTransferNumber
  };

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
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
          Audio & Telephony Configuration
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.9375rem'
          }}
        >
          Configure voice processing settings, telephony routing, and call management
        </Typography>
        <Box sx={{ mt: 1 }}>
          <ConfigSyncStatus configType="telephony" showDetails={true} />
        </Box>
      </Box>

      {/* Tabs Navigation */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3,
          borderRadius: 2
        }}
      >
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Audio Settings" icon={<VolumeUp />} iconPosition="start" />
          <Tab label="Voice Management" icon={<Mic />} iconPosition="start" />
          <Tab label="Telephony Routing" icon={<Phone />} iconPosition="start" />
          <Tab label="SIP Configuration" icon={<Settings />} iconPosition="start" />
          <Tab label="Call Quality" icon={<Headset />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 3 ? (
        // SIPConfigurationTab has its own form management
        <SIPConfigurationTab />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          {activeTab === 0 && (
            <AudioSettingsTab state={tabState} handlers={tabHandlers} />
          )}

          {activeTab === 1 && (
            <VoiceManagementTab state={tabState} handlers={tabHandlers} />
          )}

          {activeTab === 2 && (
            <TelephonyRoutingTab state={tabState} handlers={tabHandlers} />
          )}

          {activeTab === 4 && (
            <CallQualityTab state={tabState} handlers={tabHandlers} />
          )}

          {/* Save Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={<Save />}
              disabled={saveConfigMutation.isLoading}
              sx={{ minWidth: 150 }}
            >
              {saveConfigMutation.isLoading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Box>
        </form>
      )}

      {/* Dialogs */}
      {/* Voice Preview Dialog */}
      <Dialog 
        open={voicePreviewDialog} 
        onClose={() => setVoicePreviewDialog(false)} 
        maxWidth="sm" 
        fullWidth
        disableAutoFocus={false}
        disableEnforceFocus={false}
      >
        <DialogTitle>Voice Preview</DialogTitle>
        <DialogContent>
          {selectedVoice && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedVoice.name} ({selectedVoice.language})
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedVoice.description}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                defaultValue={selectedVoice.sampleText || DEFAULT_VOICE_PREVIEW_TEXT}
                label="Preview Text"
                sx={{ mt: 2 }}
                onChange={(e) => {
                  setSelectedVoice({ ...selectedVoice, sampleText: e.target.value });
                }}
              />
              
              {/* Audio Player */}
              {previewAudioUrl && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Audio Preview
                  </Typography>
                  <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <audio
                      ref={audioRef}
                      controls
                      style={{ width: '100%' }}
                      onPlay={() => {
                        console.log('✅ [VOICE_PREVIEW] Audio play event');
                        setIsPlaying(true);
                      }}
                      onPause={() => {
                        console.log('🔵 [VOICE_PREVIEW] Audio pause event');
                        setIsPlaying(false);
                      }}
                      onEnded={() => {
                        console.log('✅ [VOICE_PREVIEW] Audio ended event');
                        setIsPlaying(false);
                      }}
                      onError={(e) => {
                        // Ignore errors from empty src (expected during cleanup)
                        if (!audioRef.current?.src || audioRef.current.src === '') {
                          return;
                        }
                        console.error('🔴 [VOICE_PREVIEW] Audio element error:', e);
                        if (audioRef.current?.error) {
                          console.error('🔴 [VOICE_PREVIEW] Audio error code:', audioRef.current.error.code);
                        }
                      }}
                    >
                      Your browser does not support the audio element.
                    </audio>
                    {isPlaying && (
                      <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                        Playing...
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              
              {/* Debug Info (only in development) */}
              {import.meta.env.DEV && previewAudioUrl && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="caption" component="div">
                    Debug: Audio URL = {previewAudioUrl}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoicePreviewDialog(false)}>Close</Button>
          <Button 
            variant="contained" 
            startIcon={<PlayArrow />}
            onClick={() => {
              const textField = document.querySelector('textarea[aria-label="Preview Text"]');
              const text = textField?.value || selectedVoice?.sampleText || DEFAULT_VOICE_PREVIEW_TEXT;
              handlePlayPreview(text);
            }}
            disabled={voicePreviewMutation.isLoading || !selectedVoice}
          >
            {voicePreviewMutation.isLoading ? 'Generating...' : previewAudioUrl ? 'Regenerate Preview' : 'Generate Preview'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Phone Number Dialog */}
      <Dialog 
        open={addNumberDialog} 
        onClose={() => setAddNumberDialog(false)} 
        maxWidth="sm" 
        fullWidth
        disableAutoFocus={false}
        disableEnforceFocus={false}
      >
        <DialogTitle>Add Phone Number</DialogTitle>
        <DialogContent>
          <PhoneNumberForm
            onSubmit={handleAddNumber}
            onCancel={() => setAddNumberDialog(false)}
            isLoading={addPhoneNumberMutation.isLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Phone Number Dialog */}
      <Dialog 
        open={editNumberDialog} 
        onClose={() => {
          setEditNumberDialog(false);
          setNumberToEdit(null);
        }} 
        maxWidth="sm" 
        fullWidth
        disableAutoFocus={false}
        disableEnforceFocus={false}
      >
        <DialogTitle>Edit Phone Number</DialogTitle>
        <DialogContent>
          {numberToEdit && (
            <PhoneNumberForm
              initialData={numberToEdit}
              onSubmit={(data) => handleEditNumber(numberToEdit.number, data)}
              onCancel={() => {
                setEditNumberDialog(false);
                setNumberToEdit(null);
              }}
              isLoading={updatePhoneNumberMutation.isLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Phone Number Confirmation Dialog */}
      <Dialog 
        open={deleteNumberDialog} 
        onClose={() => {
          setDeleteNumberDialog(false);
          setNumberToDelete(null);
        }}
        disableAutoFocus={false}
        disableEnforceFocus={false}
      >
        <DialogTitle>Delete Phone Number</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete phone number <strong>{numberToDelete?.number}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteNumberDialog(false);
            setNumberToDelete(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setPendingPhoneAction({ type: 'delete', number: numberToDelete?.number });
              setConfirmPhoneNumberOpen(true);
              setDeleteNumberDialog(false);
              setNumberToDelete(null);
            }}
            disabled={removePhoneNumberMutation.isLoading}
          >
            {removePhoneNumberMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Agent-affecting confirmation dialogs */}
      <ConfirmSaveDialog
        open={confirmMainSaveOpen}
        onClose={() => { setConfirmMainSaveOpen(false); setPendingFormData(null); }}
        onConfirm={() => { handleConfirmMainSave(); }}
        title={AGENT_AFFECTING_WARNINGS.AUDIO_TELEPHONY.title}
        message={AGENT_AFFECTING_WARNINGS.AUDIO_TELEPHONY.message}
        effects={AGENT_AFFECTING_WARNINGS.AUDIO_TELEPHONY.effects}
        confirmLabel="Save"
      />
      <ConfirmSaveDialog
        open={confirmPhoneNumberOpen}
        onClose={() => { setConfirmPhoneNumberOpen(false); setPendingPhoneAction(null); }}
        onConfirm={handleConfirmPhoneNumber}
        title={AGENT_AFFECTING_WARNINGS.PHONE_NUMBER.title}
        message={AGENT_AFFECTING_WARNINGS.PHONE_NUMBER.message}
        effects={AGENT_AFFECTING_WARNINGS.PHONE_NUMBER.effects}
        confirmLabel="Continue"
      />
      <ConfirmSaveDialog
        open={confirmTransferNumberOpen}
        onClose={() => { setConfirmTransferNumberOpen(false); setPendingTransferAction(null); }}
        onConfirm={handleConfirmTransferNumber}
        title={AGENT_AFFECTING_WARNINGS.PHONE_NUMBER.title}
        message={AGENT_AFFECTING_WARNINGS.PHONE_NUMBER.message}
        effects={AGENT_AFFECTING_WARNINGS.PHONE_NUMBER.effects}
        confirmLabel="Continue"
      />

      {/* Add Transfer Number Dialog */}
      <Dialog 
        open={addTransferNumberDialog} 
        onClose={() => setAddTransferNumberDialog(false)} 
        maxWidth="sm" 
        fullWidth
        disableAutoFocus={false}
        disableEnforceFocus={false}
      >
        <DialogTitle>Add Transfer Number</DialogTitle>
        <DialogContent>
          <TransferNumberForm
            onSubmit={handleAddTransferNumber}
            onCancel={() => setAddTransferNumberDialog(false)}
            isLoading={addTransferNumberMutation.isLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Transfer Number Dialog */}
      <Dialog 
        open={editTransferNumberDialog} 
        onClose={() => {
          setEditTransferNumberDialog(false);
          setTransferNumberToEdit(null);
        }} 
        maxWidth="sm" 
        fullWidth
        disableAutoFocus={false}
        disableEnforceFocus={false}
      >
        <DialogTitle>Edit Transfer Number</DialogTitle>
        <DialogContent>
          {transferNumberToEdit && (
            <TransferNumberForm
              initialData={transferNumberToEdit.data}
              onSubmit={(data) => handleEditTransferNumber(transferNumberToEdit.index, data)}
              onCancel={() => {
                setEditTransferNumberDialog(false);
                setTransferNumberToEdit(null);
              }}
              isLoading={updateTransferNumberMutation.isLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AudioTelephonyPage;
