import React from 'react';
import { Grid, Typography, Paper, TextField } from '@mui/material';
import { Controller } from 'react-hook-form';

/**
 * SIPCredentialsForm Component
 * SIP credentials form section (OpenAI SIP endpoint is a URL, not a secret)
 */
const SIPCredentialsForm = ({ control, watch }) => {
  const sipEnabled = watch('sipSettings.openaiSipEnabled');

  if (!sipEnabled) {
    return null;
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        SIP Credentials
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure the OpenAI SIP endpoint. Twilio credentials are in env; the OpenAI SIP webhook URL is configured in the OpenAI platform.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Controller
            name="sipSettings.openaiSipEndpoint"
            control={control}
            rules={{
              required: sipEnabled ? 'OpenAI SIP endpoint is required when SIP is enabled' : false
            }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="OpenAI SIP Endpoint"
                fullWidth
                placeholder="sip://endpoint@openai.com"
                error={!!error}
                helperText={error?.message || 'OpenAI SIP endpoint URL (sip://... or https://...)'}
              />
            )}
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SIPCredentialsForm;

