import React from 'react';
import { Box, Grid, TextField, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch, Typography, Paper } from '@mui/material';
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

      <Grid container spacing={3}>
        <Grid item xs={12}>
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
        </Grid>

        {sipEnabled && (
          <>
            <Grid item xs={12} md={6}>
              <Controller
                name="sipSettings.primaryPath"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Primary Path</InputLabel>
                    <Select {...field} label="Primary Path">
                      <MenuItem value="sip">SIP</MenuItem>
                      <MenuItem value="media_streams">Media Streams</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="sipSettings.fallbackPath"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Fallback Path</InputLabel>
                    <Select {...field} label="Fallback Path">
                      <MenuItem value="sip">SIP</MenuItem>
                      <MenuItem value="media_streams">Media Streams</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="sipSettings.codec"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Codec</InputLabel>
                    <Select {...field} label="Codec">
                      <MenuItem value="opus">Opus</MenuItem>
                      <MenuItem value="pcm">PCM</MenuItem>
                      <MenuItem value="g722">G.722</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="sipSettings.region"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Region"
                    fullWidth
                    placeholder="europe"
                    helperText="SIP region (e.g., europe, us-east)"
                  />
                )}
              />
            </Grid>
          </>
        )}
      </Grid>
    </Paper>
  );
};

export default SIPBasicSettings;

