import React, { useState } from 'react';
import { Box, Paper, Typography, Card, CardContent, Chip, Button, LinearProgress, CircularProgress } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { useToast } from '../../../components/common/ToastProvider';
import ModelVoiceSelection from '../../../components/config/ModelVoiceSelection';
import LanguageVoiceMapping from '../../../components/config/LanguageVoiceMapping';
import voiceService from '../../../services/voiceService';

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
      
      // Use voice's language for translation if available
      const languageCode = voice.language || 'en-US';
      const sampleText = 'Good afternoon! This is Robert from Universal Motorcycle Training. I\'d like to help you with your motorcycle training needs. We offer comprehensive courses covering everything from basic handling to advanced techniques. Our schedule is flexible, and we can arrange lessons at your convenience. Would you like to book a lesson or perhaps enquire about our available courses? Please feel free to ask me any questions you might have.';
      
      // Call preview API - translate if not English
      const previewResult = await voiceService.previewVoice(voice.id, sampleText, { 
        translateTo: languageCode 
      });
      
      // Extract audio URL from response
      const audioUrl = previewResult?.audioUrl || previewResult?.url || 
                      previewResult?.preview?.audioUrl || previewResult?.preview?.url ||
                      previewResult?.data?.audioUrl || previewResult?.data?.url ||
                      previewResult?.data?.preview?.audioUrl || previewResult?.data?.preview?.url;
      
      if (!audioUrl) {
        console.error('🔴 [QUICK_VOICE_PREVIEW] No audio URL in response:', previewResult);
        showError('Preview generated but audio URL not found');
        setPreviewingVoice(null);
        return;
      }
      
      // Build full audio URL
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
      const fullAudioUrl = audioUrl.startsWith('http') 
        ? audioUrl 
        : `${API_BASE}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
      
      // Get auth token
      const token = localStorage.getItem('authToken');
      
      // Fetch audio as blob with authentication
      const response = await fetch(fullAudioUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Create and play audio element
      const audio = new Audio(blobUrl);
      
      // Cleanup on end
      const handleEnded = () => {
        URL.revokeObjectURL(blobUrl);
        setPreviewingVoice(null);
      };
      
      // Handle errors
      const handleError = (e) => {
        console.error('🔴 [QUICK_VOICE_PREVIEW] Audio playback error:', e);
        URL.revokeObjectURL(blobUrl);
        setPreviewingVoice(null);
        showError('Failed to play audio preview');
      };
      
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // Play immediately
      await audio.play();
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
      <LanguageVoiceMapping />

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
            {(Array.isArray(voicesData) ? voicesData : (voicesData?.voices || [])).map((voice) => {
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



