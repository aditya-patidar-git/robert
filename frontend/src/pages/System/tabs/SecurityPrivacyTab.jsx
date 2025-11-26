import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Slider,
  Alert,
  Divider,
  Button,
  LinearProgress
} from '@mui/material';
import { Save } from '@mui/icons-material';
import { Controller } from 'react-hook-form';

const SecurityPrivacyTab = ({
  control,
  watch,
  privacyConfigData,
  privacyLoading,
  savePrivacyConfigMutation,
  handleSubmit,
  handleSavePrivacyConfig
}) => {
  return (
    <form onSubmit={handleSubmit(handleSavePrivacyConfig)}>
      <Box>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Security & Privacy Settings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure data retention, privacy settings, and consent scripts
          </Typography>

          {privacyLoading ? (
            <LinearProgress sx={{ mb: 2 }} />
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Data Retention (Days)
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Transcript Retention: {watch('transcriptRetention')} days
                </Typography>
                <Controller
                  name="transcriptRetention"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={7}
                      max={365}
                      step={7}
                      marks={[
                        { value: 7, label: '7d' },
                        { value: 90, label: '90d' },
                        { value: 180, label: '180d' },
                        { value: 365, label: '365d' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Recording Retention: {watch('recordingRetention')} days
                </Typography>
                <Controller
                  name="recordingRetention"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={7}
                      max={180}
                      step={7}
                      marks={[
                        { value: 7, label: '7d' },
                        { value: 90, label: '90d' },
                        { value: 180, label: '180d' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Metadata Retention: {watch('metadataRetention')} days
                </Typography>
                <Controller
                  name="metadataRetention"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={30}
                      max={730}
                      step={30}
                      marks={[
                        { value: 30, label: '30d' },
                        { value: 365, label: '365d' },
                        { value: 730, label: '730d' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  )}
                />
              </Grid>

              {privacyConfigData?.config && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Consent Script
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      {privacyConfigData.config.consentScript || 'No consent script configured'}
                    </Alert>
                  </Grid>

                  {privacyConfigData.config.consentSettings && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>
                        Consent Settings
                      </Typography>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2">
                          <strong>Opt-out Allowed:</strong> {privacyConfigData.config.consentSettings.optOutAllowed ? 'Yes' : 'No'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Require Explicit Consent:</strong> {privacyConfigData.config.consentSettings.requireExplicitConsent ? 'Yes' : 'No'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Opt-out Email Route:</strong> {privacyConfigData.config.consentSettings.optOutEmailRoute || 'N/A'}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              disabled={savePrivacyConfigMutation.isLoading}
            >
              {savePrivacyConfigMutation.isLoading ? 'Saving...' : 'Save Privacy Config'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </form>
  );
};

export default SecurityPrivacyTab;


