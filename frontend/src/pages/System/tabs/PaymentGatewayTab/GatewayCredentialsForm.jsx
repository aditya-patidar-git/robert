import React from 'react';
import { Box, Grid, Typography, Paper, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Controller } from 'react-hook-form';
import MaskedInput from '../../../../components/common/MaskedInput';

/**
 * GatewayCredentialsForm Component
 * Gateway-specific credentials form with masked inputs
 */
const GatewayCredentialsForm = ({ control, watch }) => {
  const gatewayType = watch('gatewayType');

  if (!gatewayType) {
    return null;
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Gateway Credentials
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your {gatewayType} credentials
      </Typography>

      <Grid container spacing={3}>
        {gatewayType === 'stripe' && (
          <>
            <Grid item xs={12}>
              <Controller
                name="credentials.stripeSecretKey"
                control={control}
                rules={{ required: 'Stripe secret key is required' }}
                render={({ field, fieldState: { error } }) => (
                  <MaskedInput
                    {...field}
                    type="apiKey"
                    label="Stripe Secret Key"
                    fullWidth
                    placeholder="sk_test_..."
                    error={!!error}
                    helperText={error?.message || 'Stripe secret key (starts with sk_test_ or sk_live_)'}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="credentials.stripePublishableKey"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Stripe Publishable Key"
                    fullWidth
                    placeholder="pk_test_..."
                    helperText="Stripe publishable key (starts with pk_test_ or pk_live_)"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="credentials.stripeWebhookSecret"
                control={control}
                render={({ field }) => (
                  <MaskedInput
                    {...field}
                    type="secret"
                    label="Stripe Webhook Secret"
                    fullWidth
                    placeholder="whsec_..."
                    helperText="Stripe webhook signing secret (optional)"
                  />
                )}
              />
            </Grid>
          </>
        )}

        {gatewayType === 'paypal' && (
          <>
            <Grid item xs={12} md={6}>
              <Controller
                name="credentials.paypalClientId"
                control={control}
                rules={{ required: 'PayPal client ID is required' }}
                render={({ field, fieldState: { error } }) => (
                  <MaskedInput
                    {...field}
                    type="apiKey"
                    label="PayPal Client ID"
                    fullWidth
                    error={!!error}
                    helperText={error?.message || 'PayPal client ID'}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="credentials.paypalClientSecret"
                control={control}
                rules={{ required: 'PayPal client secret is required' }}
                render={({ field, fieldState: { error } }) => (
                  <MaskedInput
                    {...field}
                    type="password"
                    label="PayPal Client Secret"
                    fullWidth
                    error={!!error}
                    helperText={error?.message || 'PayPal client secret'}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="credentials.paypalMode"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>PayPal Mode</InputLabel>
                    <Select {...field} label="PayPal Mode">
                      <MenuItem value="sandbox">Sandbox (Testing)</MenuItem>
                      <MenuItem value="live">Live (Production)</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
          </>
        )}

        {gatewayType === 'square' && (
          <>
            <Grid item xs={12}>
              <Controller
                name="credentials.squareApplicationId"
                control={control}
                rules={{ required: 'Square application ID is required' }}
                render={({ field, fieldState: { error } }) => (
                  <MaskedInput
                    {...field}
                    type="apiKey"
                    label="Square Application ID"
                    fullWidth
                    error={!!error}
                    helperText={error?.message || 'Square application ID'}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="credentials.squareAccessToken"
                control={control}
                rules={{ required: 'Square access token is required' }}
                render={({ field, fieldState: { error } }) => (
                  <MaskedInput
                    {...field}
                    type="password"
                    label="Square Access Token"
                    fullWidth
                    error={!!error}
                    helperText={error?.message || 'Square access token'}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="credentials.squareLocationId"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Square Location ID"
                    fullWidth
                    placeholder="Location ID"
                    helperText="Square location ID (optional)"
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

export default GatewayCredentialsForm;

