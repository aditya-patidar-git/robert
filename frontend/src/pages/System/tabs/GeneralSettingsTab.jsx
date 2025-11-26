import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Slider,
  TextField,
  Button,
  Alert
} from '@mui/material';
import { Save, Security } from '@mui/icons-material';
import { Controller } from 'react-hook-form';

const GeneralSettingsTab = ({
  control,
  watch,
  isOwner,
  saveConfigMutation,
  handleSubmit,
  onSubmit
}) => {
  return (
    <Box>
      {/* System Parameters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
          System Parameters
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure general system timeouts and limits
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Max Concurrent Calls: {watch('maxConcurrentCalls')}
            </Typography>
            <Controller
              name="maxConcurrentCalls"
              control={control}
              render={({ field }) => (
                <Slider
                  {...field}
                  min={10}
                  max={200}
                  step={10}
                  marks={[
                    { value: 10, label: '10' },
                    { value: 50, label: '50' },
                    { value: 100, label: '100' },
                    { value: 200, label: '200' }
                  ]}
                  valueLabelDisplay="auto"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Call Timeout: {watch('callTimeout')}s
            </Typography>
            <Controller
              name="callTimeout"
              control={control}
              render={({ field }) => (
                <Slider
                  {...field}
                  min={60}
                  max={1800}
                  step={60}
                  marks={[
                    { value: 60, label: '1m' },
                    { value: 300, label: '5m' },
                    { value: 600, label: '10m' },
                    { value: 1800, label: '30m' }
                  ]}
                  valueLabelDisplay="auto"
                />
              )}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Owner-Only Advanced Settings */}
      {isOwner && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Security color="error" />
            <Typography variant="h5" component="h2" fontWeight="bold" color="error">
              Owner-Only Advanced Configuration
            </Typography>
          </Box>
          <Alert severity="warning" sx={{ mb: 3 }}>
            These settings can affect system stability. Use with caution.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Controller
                name="logLevel"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="System Log Level"
                    SelectProps={{ native: true }}
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Retry Attempts: {watch('retryAttempts')}
              </Typography>
              <Controller
                name="retryAttempts"
                control={control}
                render={({ field }) => (
                  <Slider
                    {...field}
                    min={0}
                    max={10}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                  />
                )}
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          startIcon={<Save />}
          disabled={saveConfigMutation.isLoading}
          sx={{ minWidth: 150 }}
          onClick={handleSubmit(onSubmit)}
        >
          {saveConfigMutation.isLoading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </Box>
    </Box>
  );
};

export default GeneralSettingsTab;


