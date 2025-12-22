import React from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch, Typography, Paper } from '@mui/material';
import { Controller } from 'react-hook-form';

/**
 * SIPBasicSettings Component
 * Basic SIP settings form section
 */
const SIPBasicSettings = ({ control, watch }) => {
  const sipEnabled = watch('sipSettings.openaiSipEnabled');

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Basic SIP Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure basic SIP connection settings
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Controller
            name="sipSettings.openaiSipEnabled"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch {...field} checked={field.value || false} />}
                label="Enable OpenAI SIP"
              />
            )}
          />
        </Box>

        {sipEnabled && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              gap: 2,
              flexWrap: { xs: 'wrap', md: 'nowrap' }
            }}
          >
            <Controller
              name="sipSettings.primaryPath"
              control={control}
              render={({ field }) => (
                <FormControl sx={{ flex: 1, minWidth: 150 }}>
                  <InputLabel>Primary Path</InputLabel>
                  <Select {...field} label="Primary Path">
                    <MenuItem value="sip">SIP</MenuItem>
                    <MenuItem value="media_streams">Media Streams</MenuItem>
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="sipSettings.fallbackPath"
              control={control}
              render={({ field }) => (
                <FormControl sx={{ flex: 1, minWidth: 150 }}>
                  <InputLabel>Fallback Path</InputLabel>
                  <Select {...field} label="Fallback Path">
                    <MenuItem value="sip">SIP</MenuItem>
                    <MenuItem value="media_streams">Media Streams</MenuItem>
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="sipSettings.codec"
              control={control}
              render={({ field }) => (
                <FormControl sx={{ flex: 1, minWidth: 150 }}>
                  <InputLabel>Codec</InputLabel>
                  <Select {...field} label="Codec">
                    <MenuItem value="opus">Opus</MenuItem>
                    <MenuItem value="pcm">PCM</MenuItem>
                    <MenuItem value="g722">G.722</MenuItem>
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="sipSettings.region"
              control={control}
              render={({ field }) => (
                <FormControl sx={{ flex: 1, minWidth: 150 }}>
                  <InputLabel>Region</InputLabel>
                  <Select {...field} label="Region">
                    <MenuItem value="europe">Europe</MenuItem>
                    <MenuItem value="us-east">US East</MenuItem>
                    <MenuItem value="us-west">US West</MenuItem>
                    <MenuItem value="asia-pacific">Asia Pacific</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default SIPBasicSettings;

