import React from 'react';
import { Box, Grid, Typography, Paper, TextField, FormControlLabel, Switch } from '@mui/material';
import { Controller } from 'react-hook-form';

/**
 * GatewaySettingsPanel Component
 * Gateway settings panel
 */
const GatewaySettingsPanel = ({ control }) => {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Gateway Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure payment gateway settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Controller
            name="settings.currency"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Currency"
                fullWidth
                placeholder="GBP"
                helperText="Default currency code (e.g., GBP, USD, EUR)"
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="settings.paymentLinkExpiryHours"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Payment Link Expiry (Hours)"
                type="number"
                fullWidth
                inputProps={{ min: 1, max: 168 }}
                helperText="Hours until payment link expires (1-168)"
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="settings.webhookUrl"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Webhook URL"
                fullWidth
                placeholder="https://your-domain.com/api/payments/webhook"
                helperText="URL for payment gateway webhooks (optional)"
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="settings.testMode"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch {...field} checked={field.value !== false} />}
                label="Test Mode"
              />
            )}
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default GatewaySettingsPanel;

