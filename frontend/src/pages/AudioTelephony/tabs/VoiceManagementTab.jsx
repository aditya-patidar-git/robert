import React from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, Chip, Button, LinearProgress } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import ModelVoiceSelection from '../../../components/config/ModelVoiceSelection';
import ModelCapabilityRegistry from '../../../components/config/ModelCapabilityRegistry';
import LanguageVoiceMapping from '../../../components/config/LanguageVoiceMapping';

const VoiceManagementTab = ({ state, handlers }) => {
  const {
    control,
    watch,
    fallbackChain,
    setFallbackChain,
    voicesData,
    voicesLoading
  } = state;

  const { handleVoicePreview } = handlers;

  return (
    <Box>
      {/* Primary Model Selection and Fallback Chain */}
      <ModelVoiceSelection 
        control={control}
        watch={watch}
        fallbackChain={fallbackChain}
        setFallbackChain={setFallbackChain}
        showFallbackChain={true}
        showDefaultVoice={true}
      />

      {/* Model Capability Registry */}
      <ModelCapabilityRegistry 
        mode="simplified" 
        selectedModelId={watch('selectedModel')} 
        fallbackChain={fallbackChain} 
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
          <Grid container spacing={3}>
            {(Array.isArray(voicesData) ? voicesData : (voicesData?.voices || [])).map((voice) => (
              <Grid item xs={12} md={6} lg={4} key={voice.id}>
                <Card sx={{ 
                  border: watch('defaultVoice')?.id === voice.id ? 2 : 1,
                  borderColor: watch('defaultVoice')?.id === voice.id ? 'primary.main' : 'divider'
                }}>
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
                        onClick={() => handleVoicePreview(voice)}
                      >
                        Preview
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </Box>
  );
};

export default VoiceManagementTab;



