import React from 'react';
import { Box, Button, LinearProgress } from '@mui/material';
import { Save } from '@mui/icons-material';
import AudioSettings from '../../../components/config/AudioSettings';

const AudioSettingsTab = ({ 
  control, 
  watch, 
  audioLoading, 
  isSavingAudio, 
  handleSubmit, 
  handleSaveAudioConfig 
}) => {
  return (
    <form onSubmit={handleSubmit(handleSaveAudioConfig)}>
      <Box>
        {audioLoading ? (
          <LinearProgress sx={{ mb: 2 }} />
        ) : (
          <AudioSettings control={control} watch={watch} layout="compact" />
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
            disabled={isSavingAudio}
          >
            {isSavingAudio ? 'Saving...' : 'Save Audio Config'}
          </Button>
        </Box>
      </Box>
    </form>
  );
};

export default AudioSettingsTab;


