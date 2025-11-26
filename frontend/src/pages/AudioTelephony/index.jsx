import React, { useState, useCallback } from 'react';
import {
  Container,
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
  TextField
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
    setSelectedVoice
  } = state;

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
    setSelectedVoice(voice);
    setVoicePreviewDialog(true);
  }, [setSelectedVoice, setVoicePreviewDialog]);

  const handlePlayPreview = useCallback((text) => {
    if (selectedVoice) {
      voicePreviewMutation.mutate({ voiceId: selectedVoice.id, text: text || selectedVoice.sampleText || 'Hello, this is a voice preview.' });
    }
  }, [selectedVoice, voicePreviewMutation]);

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
                defaultValue={selectedVoice.sampleText}
                label="Preview Text"
                sx={{ mt: 2 }}
                onChange={(e) => {
                  setSelectedVoice({ ...selectedVoice, sampleText: e.target.value });
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoicePreviewDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            startIcon={<PlayArrow />}
            onClick={() => handlePlayPreview(selectedVoice?.sampleText)}
            disabled={voicePreviewMutation.isLoading}
          >
            {voicePreviewMutation.isLoading ? 'Generating...' : 'Play Preview'}
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
    </Container>
  );
};

export default AudioTelephonyPage;
