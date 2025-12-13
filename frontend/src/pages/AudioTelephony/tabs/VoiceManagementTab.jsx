import React from 'react';
import { Box, Paper, Typography, Card, CardContent, Chip, Button, LinearProgress } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import ModelVoiceSelection from '../../../components/config/ModelVoiceSelection';
import LanguageVoiceMapping from '../../../components/config/LanguageVoiceMapping';

const VoiceManagementTab = ({ state, handlers }) => {
  const {
    control,
    watch,
    voicesData,
    voicesLoading
  } = state;

  const { handleVoicePreview } = handlers || {};

  // Safety check and wrapper for voice preview with detailed logging
  const handlePreviewClick = (voice) => {
    console.log('🔵 [VOICE_PREVIEW] Preview button clicked');
    console.log('🔵 [VOICE_PREVIEW] Voice object:', voice);
    console.log('🔵 [VOICE_PREVIEW] Handler available:', !!handleVoicePreview);
    console.log('🔵 [VOICE_PREVIEW] Handler type:', typeof handleVoicePreview);
    
    if (!handleVoicePreview) {
      console.error('🔴 [VOICE_PREVIEW] handleVoicePreview handler is not available');
      console.error('🔴 [VOICE_PREVIEW] Handlers object:', handlers);
      return;
    }
    
    if (!voice) {
      console.error('🔴 [VOICE_PREVIEW] No voice object provided');
      return;
    }
    
    if (!voice.id) {
      console.error('🔴 [VOICE_PREVIEW] Voice object missing id property:', voice);
      return;
    }
    
    console.log('✅ [VOICE_PREVIEW] Calling handleVoicePreview with voice:', {
      id: voice.id,
      name: voice.name,
      language: voice.language
    });
    
    try {
      handleVoicePreview(voice);
      console.log('✅ [VOICE_PREVIEW] handleVoicePreview called successfully');
    } catch (error) {
      console.error('🔴 [VOICE_PREVIEW] Error calling handleVoicePreview:', error);
    }
  };

  return (
    <Box>
      {/* Primary Model Selection */}
      <ModelVoiceSelection 
        control={control}
        watch={watch}
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
            {(Array.isArray(voicesData) ? voicesData : (voicesData?.voices || [])).map((voice) => (
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
                      startIcon={<PlayArrow />}
                      onClick={() => handlePreviewClick(voice)}
                      disabled={!handleVoicePreview}
                    >
                      Preview
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default VoiceManagementTab;



