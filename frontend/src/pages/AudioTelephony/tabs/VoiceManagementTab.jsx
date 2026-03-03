import React, { useState } from 'react';
import { Box, Paper, Typography, Card, CardContent, Chip, Button, LinearProgress, CircularProgress } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { useToast } from '../../../components/common/ToastProvider';
import ModelVoiceSelection from '../../../components/config/ModelVoiceSelection';
import LanguageVoiceMapping from '../../../components/config/LanguageVoiceMapping';
import voiceService from '../../../services/voiceService';
import { filterValidRealtimeVoices } from '../../../constants/validVoices';
import { DEFAULT_VOICE_PREVIEW_TEXT } from '../../../constants/voicePreview';

const VoiceManagementTab = ({ state, handlers }) => {
  const {
    control,
    watch,
    setValue,
    voicesData,
    voicesLoading
  } = state;

  const { handleVoicePreview } = handlers || {};
  const { showSuccess, showError } = useToast();
  const [previewingVoice, setPreviewingVoice] = useState(null);

  // Quick preview handler - direct audio playback without dialog
  const handleQuickPreview = async (voice) => {
    if (!voice || !voice.id) {
      showError('Invalid voice selected');
      return;
    }

    try {
      setPreviewingVoice(voice.id);
      
      // Use voice's language for translation if available (default to British English)
      const languageCode = voice.language || 'en-GB';
      
      // Get the selected primary model from form state
      const selectedModel = watch('selectedModel');
      
      const sampleText = DEFAULT_VOICE_PREVIEW_TEXT;
      
      // Call preview API with selected primary model and language
      const previewResult = await voiceService.previewVoice(voice.id, sampleText, {
        translateTo: languageCode,
        modelId: selectedModel
      });

      const preview = previewResult?.preview || previewResult?.data?.preview || previewResult?.data || previewResult;
      const audioData = preview?.audioData;
      const audioUrl = preview?.audioUrl || preview?.url ||
        previewResult?.audioUrl || previewResult?.url;

      const playBlobUrl = (blobUrl) => {
        const audio = new Audio(blobUrl);
        const handleEnded = () => {
          URL.revokeObjectURL(blobUrl);
          setPreviewingVoice(null);
        };
        const handleError = (e) => {
          console.error('🔴 [QUICK_VOICE_PREVIEW] Audio playback error:', e);
          URL.revokeObjectURL(blobUrl);
          setPreviewingVoice(null);
          showError('Failed to play audio preview');
        };
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.play();
      };

      if (audioData && typeof audioData === 'string' && audioData.length > 0) {
        const binary = atob(audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        playBlobUrl(blobUrl);
        showSuccess(`Playing preview for ${voice.name}...`);
        return;
      }

      if (!audioUrl) {
        showError('Preview generated but audio not found in response');
        setPreviewingVoice(null);
        return;
      }

      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002';
      const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${API_BASE}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
      const token = localStorage.getItem('authToken');
      const response = await fetch(fullAudioUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      playBlobUrl(blobUrl);
      showSuccess(`Playing preview for ${voice.name}...`);
      
    } catch (error) {
      console.error('🔴 [QUICK_VOICE_PREVIEW] Error:', error);
      showError(error.message || 'Failed to preview voice');
      setPreviewingVoice(null);
    }
  };

  return (
    <Box>
      {/* Primary Model Selection */}
      <ModelVoiceSelection 
        control={control}
        watch={watch}
        setValue={setValue}
        showFallbackChain={false}
        showDefaultVoice={false}
      />

      {/* Language/Voice Mapping Configuration */}
      <LanguageVoiceMapping selectedModelId={watch('selectedModel')} />

      {/* Available Voices Grid */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Available Voices
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Browse and preview all available AI voices
        </Typography>

        {voicesLoading ? (
          <LinearProgress />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)'
              },
              gap: 3
            }}
          >
            {filterValidRealtimeVoices(
              Array.isArray(voicesData) ? voicesData : (voicesData?.voices || [])
            ).map((voice) => {
              const isPreviewing = previewingVoice === voice.id;
              
              return (
                <Card 
                  key={voice.id}
                  sx={{ 
                    border: watch('defaultVoice')?.id === voice.id ? 2 : 1,
                    borderColor: watch('defaultVoice')?.id === voice.id ? 'primary.main' : 'divider'
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">{voice.name}</Typography>
                      {voice.isDefault && <Chip label="Default" color="primary" size="small" />}
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {voice.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Chip label={voice.language} size="small" />
                      <Chip label={voice.gender} size="small" />
                      <Chip label={voice.provider} size="small" />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={isPreviewing ? <CircularProgress size={16} /> : <PlayArrow />}
                        onClick={() => handleQuickPreview(voice)}
                        disabled={isPreviewing}
                      >
                        {isPreviewing ? 'Generating...' : 'Preview'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default VoiceManagementTab;



