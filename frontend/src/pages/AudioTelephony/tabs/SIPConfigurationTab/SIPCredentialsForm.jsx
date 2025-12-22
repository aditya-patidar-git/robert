import React from 'react';
import { Box, Grid, Typography, Paper, TextField } from '@mui/material';
import { Controller } from 'react-hook-form';
import MaskedInput from '../../../../components/common/MaskedInput';

/**
 * SIPCredentialsForm Component
 * SIP credentials form section with masked inputs
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
        Configure OpenAI SIP endpoint and Twilio SIP trunk credentials
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Controller
            name="sipSettings.openaiSipEndpoint"
            control={control}
            rules={{
              required: 'OpenAI SIP endpoint is required when SIP is enabled'
            }}
            render={({ field, fieldState: { error } }) => (
              <MaskedInput
                {...field}
                type="apiKey"
                label="OpenAI SIP Endpoint"
                fullWidth
                placeholder="sip://endpoint@openai.com"
                error={!!error}
                helperText={error?.message || 'OpenAI SIP endpoint URL (sip://... or https://...)'}
                showToggle={false}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="sipSettings.openaiSipWebhookUrl"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="OpenAI SIP Webhook URL"
                fullWidth
                placeholder="https://your-domain.com/api/sip/call-accept"
                error={!!error}
                helperText={error?.message || 'Webhook URL for OpenAI to send SIP events'}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="sipSettings.twilioSipTrunkSid"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Twilio SIP Trunk SID"
                fullWidth
                placeholder="TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                helperText="Twilio Elastic SIP Trunk SID (optional)"
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="sipSettings.twilioSipUsername"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Twilio SIP Username"
                fullWidth
                placeholder="username"
                helperText="Twilio SIP trunk username (optional)"
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="sipSettings.twilioSipPassword"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <MaskedInput
                {...field}
                type="password"
                label="Twilio SIP Password"
                fullWidth
                placeholder="Enter password"
                error={!!error}
                helperText={error?.message || 'Twilio SIP trunk password (optional)'}
              />
            )}
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SIPCredentialsForm;

