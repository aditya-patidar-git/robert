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
import { Save, PlayArrow, VolumeUp, Mic, Phone, Headset } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { useAudioTelephonyState } from './hooks/useAudioTelephonyState';
import AudioSettingsTab from './tabs/AudioSettingsTab';
import VoiceManagementTab from './tabs/VoiceManagementTab';
import TelephonyRoutingTab from './tabs/TelephonyRoutingTab';
import CallQualityTab from './tabs/CallQualityTab';
import PhoneNumberForm from './components/PhoneNumberForm';
import TransferNumberForm from './components/TransferNumberForm';
import configService from '../../services/configService';
import voiceService from '../../services/voiceService';
import { useQueryClient } from '@tanstack/react-query';

const AudioTelephonyPage = () => {
  const [activeTab, setActiveTab] = useState(0);
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
    mutationFn: () => {
      const transferNumbers = watch('transferNumbers') || [];
      return configService.updateTelephonyConfig({ transferNumbers });
    },
    onSuccess: () => {
      showSuccess('Transfer number added successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setAddTransferNumberDialog(false);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to add transfer number');
    }
  });

  const updateTransferNumberMutation = useMutation({
    mutationFn: () => {
      const transferNumbers = watch('transferNumbers') || [];
      return configService.updateTelephonyConfig({ transferNumbers });
    },
    onSuccess: () => {
      showSuccess('Transfer number updated successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setEditTransferNumberDialog(false);
      setTransferNumberToEdit(null);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to update transfer number');
    }
  });

  // Handlers
  const onSubmit = useCallback((data) => {
    saveConfigMutation.mutate(data);
  }, [saveConfigMutation]);

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
    
    const previewText = text || selectedVoice.sampleText || 'Hello, this is a voice preview.';
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
    
    // Fetch audio as blob with authentication
    const fetchAudio = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
        const fullAudioUrl = previewAudioUrl.startsWith('http') 
          ? previewAudioUrl 
          : `${API_BASE}${previewAudioUrl.startsWith('/') ? '' : '/'}${previewAudioUrl}`;
        
        console.log('🔵 [VOICE_PREVIEW] Fetching audio from:', fullAudioUrl);
        
        // Get auth token from localStorage
        const token = localStorage.getItem('authToken');
        if (!token) {
          console.error('🔴 [VOICE_PREVIEW] No auth token found');
          showError('Authentication required to play audio');
          return;
        }
        
        // Fetch audio with authentication
        const response = await fetch(fullAudioUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        }
        
        // Convert to blob
        const blob = await response.blob();
        console.log('✅ [VOICE_PREVIEW] Audio blob created, size:', blob.size, 'type:', blob.type);
        
        // Create blob URL
        const blobUrl = URL.createObjectURL(blob);
        console.log('✅ [VOICE_PREVIEW] Blob URL created:', blobUrl);
        
        // Store blob URL in ref for cleanup
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = blobUrl;
        
        // Wait for audio element to be available, then set src
        const checkAudioElement = setInterval(() => {
          if (audioRef.current) {
            clearInterval(checkAudioElement);
            
            const audio = audioRef.current;
            audio.src = blobUrl;
            console.log('🔵 [VOICE_PREVIEW] Audio element found, blob URL set, setting up event listeners');
            
            // Set up event listeners
            const handleCanPlay = () => {
              console.log('✅ [VOICE_PREVIEW] Audio can play - starting playback');
              setIsPlaying(true);
              audio.play().catch(error => {
                console.error('🔴 [VOICE_PREVIEW] Error playing audio:', error);
                showError('Failed to play audio preview. Please check your browser audio settings.');
                setIsPlaying(false);
              });
            };
            
            const handleEnded = () => {
              console.log('✅ [VOICE_PREVIEW] Audio playback ended');
              setIsPlaying(false);
            };
            
            const handleError = (e) => {
              console.error('🔴 [VOICE_PREVIEW] Audio playback error:', e);
              console.error('🔴 [VOICE_PREVIEW] Audio error details:', {
                error: audio.error,
                errorCode: audio.error?.code,
                errorMessage: audio.error?.message,
                networkState: audio.networkState,
                readyState: audio.readyState
              });
              
              let errorMessage = 'Failed to play audio preview.';
              if (audio.error) {
                switch (audio.error.code) {
                  case MediaError.MEDIA_ERR_ABORTED:
                    errorMessage = 'Audio playback was aborted.';
                    break;
                  case MediaError.MEDIA_ERR_NETWORK:
                    errorMessage = 'Network error while loading audio.';
                    break;
                  case MediaError.MEDIA_ERR_DECODE:
                    errorMessage = 'Audio format not supported by your browser.';
                    break;
                  case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = 'Audio format not supported.';
                    break;
                  default:
                    errorMessage = 'The audio may not be available or the format is not supported.';
                }
              }
              
              showError(errorMessage);
              setIsPlaying(false);
            };
            
            const handleLoadStart = () => {
              console.log('🔵 [VOICE_PREVIEW] Audio loading started');
            };
            
            const handleLoadedData = () => {
              console.log('🔵 [VOICE_PREVIEW] Audio data loaded');
            };
            
            const handlePlaying = () => {
              console.log('✅ [VOICE_PREVIEW] Audio is now playing');
            };
            
            const handlePause = () => {
              console.log('🔵 [VOICE_PREVIEW] Audio paused');
              setIsPlaying(false);
            };
            
            audio.addEventListener('canplay', handleCanPlay);
            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('error', handleError);
            audio.addEventListener('loadstart', handleLoadStart);
            audio.addEventListener('loadeddata', handleLoadedData);
            audio.addEventListener('playing', handlePlaying);
            audio.addEventListener('pause', handlePause);
            
            // Start loading the audio
            console.log('🔵 [VOICE_PREVIEW] Starting to load audio from blob URL');
            audio.load();
          }
        }, 100);
        
        // Cleanup interval after 5 seconds if element not found
        setTimeout(() => clearInterval(checkAudioElement), 5000);
        
      } catch (error) {
        console.error('🔴 [VOICE_PREVIEW] Error fetching audio:', error);
        showError(`Failed to load audio: ${error.message}`);
      }
    };
    
    fetchAudio();
    
    // Cleanup function
    return () => {
      console.log('🔵 [VOICE_PREVIEW] Cleaning up audio element');
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
    addPhoneNumberMutation.mutate(numberData);
  }, [addPhoneNumberMutation]);

  const handleEditNumber = useCallback((number, numberData) => {
    updatePhoneNumberMutation.mutate({ number, data: numberData });
  }, [updatePhoneNumberMutation]);

  const handleDeleteNumber = useCallback((number) => {
    removePhoneNumberMutation.mutate(number);
  }, [removePhoneNumberMutation]);

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
    setValue('transferNumbers', [...transferNumbers, transferNumberData]);
    addTransferNumberMutation.mutate();
  }, [watch, setValue, addTransferNumberMutation]);

  const handleEditTransferNumber = useCallback((index, transferNumberData) => {
    const transferNumbers = watch('transferNumbers') || [];
    const updated = [...transferNumbers];
    updated[index] = transferNumberData;
    setValue('transferNumbers', updated);
    updateTransferNumberMutation.mutate();
  }, [watch, setValue, updateTransferNumberMutation]);

  const handleDeleteTransferNumber = useCallback((index) => {
    const transferNumbers = watch('transferNumbers') || [];
    const updated = transferNumbers.filter((_, i) => i !== index);
    setValue('transferNumbers', updated);
    updateTransferNumberMutation.mutate();
  }, [watch, setValue, updateTransferNumberMutation]);

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
          <Tab label="Call Quality" icon={<Headset />} iconPosition="start" />
        </Tabs>
      </Paper>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Tab Content */}
        {activeTab === 0 && (
          <AudioSettingsTab state={tabState} handlers={tabHandlers} />
        )}

        {activeTab === 1 && (
          <VoiceManagementTab state={tabState} handlers={tabHandlers} />
        )}

        {activeTab === 2 && (
          <TelephonyRoutingTab state={tabState} handlers={tabHandlers} />
        )}

        {activeTab === 3 && (
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

      {/* Dialogs */}
      {/* Voice Preview Dialog */}
      <Dialog open={voicePreviewDialog} onClose={() => setVoicePreviewDialog(false)} maxWidth="sm" fullWidth>
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
                defaultValue={selectedVoice.sampleText || 'Hello, this is a voice preview.'}
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
              {process.env.NODE_ENV === 'development' && previewAudioUrl && (
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
              const text = textField?.value || selectedVoice?.sampleText || 'Hello, this is a voice preview.';
              handlePlayPreview(text);
            }}
            disabled={voicePreviewMutation.isLoading || !selectedVoice}
          >
            {voicePreviewMutation.isLoading ? 'Generating...' : previewAudioUrl ? 'Regenerate Preview' : 'Generate Preview'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Phone Number Dialog */}
      <Dialog open={addNumberDialog} onClose={() => setAddNumberDialog(false)} maxWidth="sm" fullWidth>
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
      <Dialog open={editNumberDialog} onClose={() => {
        setEditNumberDialog(false);
        setNumberToEdit(null);
      }} maxWidth="sm" fullWidth>
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
      <Dialog open={deleteNumberDialog} onClose={() => {
        setDeleteNumberDialog(false);
        setNumberToDelete(null);
      }}>
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
            onClick={() => handleDeleteNumber(numberToDelete?.number)}
            disabled={removePhoneNumberMutation.isLoading}
          >
            {removePhoneNumberMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Transfer Number Dialog */}
      <Dialog open={addTransferNumberDialog} onClose={() => setAddTransferNumberDialog(false)} maxWidth="sm" fullWidth>
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
      <Dialog open={editTransferNumberDialog} onClose={() => {
        setEditTransferNumberDialog(false);
        setTransferNumberToEdit(null);
      }} maxWidth="sm" fullWidth>
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
