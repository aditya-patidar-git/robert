import React from 'react';
import { Box, FormControl, FormHelperText, InputLabel, Select, MenuItem, FormControlLabel, Switch, Typography, Paper } from '@mui/material';
import { Controller } from 'react-hook-form';

/**
 * SIPBasicSettings Component
 * Basic SIP settings form section
 */
const SIPBasicSettings = ({ control, watch }) => {
  const sipEnabled = watch('sipSettings.openaiSipEnabled');
  const primaryPath = watch('sipSettings.primaryPath');
  const fallbackPath = watch('sipSettings.fallbackPath');

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
              flexWrap: { xs: 'wrap', md: 'nowrap' },
              width: '50%'
            }}
          >
            <Controller
              name="sipSettings.primaryPath"
              control={control}
              rules={{
                required: sipEnabled ? 'Primary path is required' : false,
                validate: (value) =>
                  sipEnabled && value && fallbackPath && value === fallbackPath
                    ? 'Primary and fallback path cannot be the same'
                    : true
              }}
              render={({ field, fieldState: { error } }) => (
                <FormControl sx={{ flex: 1, minWidth: 150 }} error={!!error}>
                  <InputLabel>Primary Path</InputLabel>
                  <Select {...field} label="Primary Path">
                    <MenuItem value="sip">SIP</MenuItem>
                    <MenuItem value="media_streams">Media Streams</MenuItem>
                  </Select>
                  {error?.message && <FormHelperText error>{error.message}</FormHelperText>}
                </FormControl>
              )}
            />

            <Controller
              name="sipSettings.fallbackPath"
              control={control}
              rules={{
                required: sipEnabled ? 'Fallback path is required' : false,
                validate: (value) =>
                  sipEnabled && value && primaryPath && value === primaryPath
                    ? 'Primary and fallback path cannot be the same'
                    : true
              }}
              render={({ field, fieldState: { error } }) => (
                <FormControl sx={{ flex: 1, minWidth: 150 }} error={!!error}>
                  <InputLabel>Fallback Path</InputLabel>
                  <Select {...field} label="Fallback Path">
                    <MenuItem value="sip">SIP</MenuItem>
                    <MenuItem value="media_streams">Media Streams</MenuItem>
                  </Select>
                  {error?.message && <FormHelperText error>{error.message}</FormHelperText>}
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

