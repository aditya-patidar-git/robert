import React from 'react';
import { Box } from '@mui/material';
import AudioSettings from '../../../components/config/AudioSettings';

const AudioSettingsTab = ({ state }) => {
  const { control, watch } = state;

  return (
    <Box>
      <AudioSettings control={control} watch={watch} layout="default" />
    </Box>
  );
};

export default AudioSettingsTab;



