import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  Box,
  Paper,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  TextField,
  RadioGroup,
  Radio,
  Card,
  CardContent,
  Stack,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Info
} from '@mui/icons-material';

const AudioSettings = ({ 
  control,
  watch,
  readOnly = false,
  layout = 'default' // 'default' | 'compact'
}) => {
  // If control is not provided, we can't render
  if (!control) {
    return null;
  }

  if (layout === 'compact') {
    // Compact layout (for System page)
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Audio Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure voice activity detection, audio quality, and barge-in settings
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              VAD Threshold: {watch('vadThreshold')}ms
            </Typography>
            <Controller
              name="vadThreshold"
              control={control}
              render={({ field }) => (
                <Slider
                  {...field}
                  min={100}
                  max={2000}
                  step={50}
                  marks={[
                    { value: 100, label: '100ms' },
                    { value: 500, label: '500ms' },
                    { value: 1000, label: '1000ms' },
                    { value: 2000, label: '2000ms' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={readOnly}
                  aria-label="Voice Activity Detection Threshold"
                />
              )}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Start Padding: {watch('startPadding')}ms
            </Typography>
            <Controller
              name="startPadding"
              control={control}
              render={({ field }) => (
                <Slider
                  {...field}
                  min={0}
                  max={1000}
                  step={50}
                  marks={[
                    { value: 0, label: '0ms' },
                    { value: 250, label: '250ms' },
                    { value: 500, label: '500ms' },
                    { value: 1000, label: '1000ms' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={readOnly}
                  aria-label="Start Padding"
                />
              )}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              End Padding: {watch('endPadding')}ms
            </Typography>
            <Controller
              name="endPadding"
              control={control}
              render={({ field }) => (
                <Slider
                  {...field}
                  min={0}
                  max={1500}
                  step={50}
                  marks={[
                    { value: 0, label: '0ms' },
                    { value: 300, label: '300ms' },
                    { value: 500, label: '500ms' },
                    { value: 1500, label: '1500ms' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={readOnly}
                  aria-label="End Padding"
                />
              )}
            />
          </Box>

          <Box>
            <Controller
              name="bargeInPolicy"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Barge-in Policy</InputLabel>
                  <Select {...field} label="Barge-in Policy" disabled={readOnly}>
                    <MenuItem value="pause">Pause</MenuItem>
                    <MenuItem value="stop">Stop</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Box>

          <Box>
            <Controller
              name="noiseSuppression"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} disabled={readOnly} />}
                  label="Noise Suppression"
                />
              )}
            />
          </Box>

          <Box>
            <Controller
              name="noiseSuppressionAlgorithm"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Noise Suppression Algorithm</InputLabel>
                  <Select {...field} label="Noise Suppression Algorithm" disabled={readOnly}>
                    <MenuItem value="basic">Basic</MenuItem>
                    <MenuItem value="rnnoise">RNNoise</MenuItem>
                    <MenuItem value="webrtc">WebRTC</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Box>

          <Box>
            <Controller
              name="echoCancellation"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} disabled={readOnly} />}
                  label="Echo Cancellation"
                />
              )}
            />
          </Box>

          <Box>
            <Controller
              name="automaticGainControl"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} disabled={readOnly} />}
                  label="Automatic Gain Control"
                />
              )}
            />
          </Box>

          <Box>
            <Controller
              name="audioQuality"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Audio Quality</InputLabel>
                  <Select {...field} label="Audio Quality" disabled={readOnly}>
                    <MenuItem value="standard">Standard</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="premium">Premium</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Box>

          <Box>
            <Controller
              name="energyThresholdAutoCalibrate"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} disabled={readOnly} />}
                  label="Auto-calibrate Energy Threshold"
                />
              )}
            />
          </Box>
        </Box>
      </Paper>
    );
  }

  // Default layout (for AudioTelephony page - more detailed)
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
        Audio Processing Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure voice activity detection and audio processing parameters
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
        {/* VAD Settings */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '3 3 0%' }, minWidth: 0 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Voice Activity Detection
              </Typography>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  VAD Threshold: {watch('vadThreshold')}ms
                </Typography>
                <Controller
                  name="vadThreshold"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={100}
                      max={2000}
                      step={100}
                      marks={[
                        { value: 100, label: '100ms' },
                        { value: 500, label: '500ms' },
                        { value: 1000, label: '1s' },
                        { value: 1500, label: '1.5s' },
                        { value: 2000, label: '2s' }
                      ]}
                      valueLabelDisplay="auto"
                      disabled={readOnly}
                      aria-label="Voice Activity Detection Threshold"
                    />
                  )}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Energy Threshold */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '4 4 0%' }, minWidth: 0 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Energy Threshold
                </Typography>
                <Tooltip title="Adaptive threshold for line noise detection. When auto-calibrate is enabled, the system adjusts the threshold at the start of each call based on detected background noise levels.">
                  <IconButton size="small">
                    <Info fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Adaptive threshold for line noise detection. Auto-calibration adjusts per call start.
              </Typography>
              <Stack spacing={2}>
                <Controller
                  name="energyThresholdAutoCalibrate"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} disabled={readOnly} />}
                      label="Auto-calibrate per call"
                    />
                  )}
                />
                {!watch('energyThresholdAutoCalibrate') && (
                  <Box>
                    <Controller
                      name="energyThreshold"
                      control={control}
                      render={({ field }) => (
                        <Slider
                          {...field}
                          value={field.value || 50}
                          min={0}
                          max={100}
                          step={5}
                          marks={[
                            { value: 0, label: '0' },
                            { value: 50, label: '50' },
                            { value: 100, label: '100' }
                          ]}
                          valueLabelDisplay="auto"
                          disabled={readOnly || watch('energyThresholdAutoCalibrate')}
                        />
                      )}
                    />
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Barge-in Policy */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '3 3 0%' }, minWidth: 0 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Barge-in Policy
              </Typography>
              <Box>
                <Controller
                  name="bargeInPolicy"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup {...field} disabled={readOnly}>
                      <FormControlLabel
                        value="pause"
                        control={<Radio />}
                        label="Pause (Resume after interruption)"
                      />
                      <FormControlLabel
                        value="stop"
                        control={<Radio />}
                        label="Stop (Cancel current speech)"
                      />
                    </RadioGroup>
                  )}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
        {/* Audio Quality */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Audio Quality Settings
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Audio Quality
                </Typography>
                <Controller
                  name="audioQuality"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <Select {...field} disabled={readOnly}>
                        <MenuItem value="standard">Standard</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="premium">Premium</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>
              <Stack spacing={1.5}>
                <Controller
                  name="noiseSuppression"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} disabled={readOnly} />}
                      label="Noise Suppression"
                    />
                  )}
                />
                {watch('noiseSuppression') && (
                  <Box sx={{ ml: 4, mt: 1.5 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Algorithm
                    </Typography>
                    <Controller
                      name="noiseSuppressionAlgorithm"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth size="small">
                          <Select {...field} disabled={readOnly}>
                            <MenuItem value="basic">Basic</MenuItem>
                            <MenuItem value="rnnoise">RNNoise</MenuItem>
                            <MenuItem value="webrtc">WebRTC NS</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Box>
                )}
                <Controller
                  name="echoCancellation"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} disabled={readOnly} />}
                      label="Echo Cancellation (AEC)"
                    />
                  )}
                />
                <Controller
                  name="automaticGainControl"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} disabled={readOnly} />}
                      label="Automatic Gain Control (AGC)"
                    />
                  )}
                />
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Padding Settings */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Audio Padding
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Start Padding (ms)
                  </Typography>
                  <Controller
                    name="startPadding"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        label="Start Padding (ms)"
                        inputProps={{ min: 0, max: 1000, step: 50 }}
                        helperText="Audio capture padding before speech detection"
                        disabled={readOnly}
                      />
                    )}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    End Padding (ms)
                  </Typography>
                  <Controller
                    name="endPadding"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        label="End Padding (ms)"
                        inputProps={{ min: 0, max: 1500, step: 50 }}
                        helperText="Audio capture padding after speech ends"
                        disabled={readOnly}
                      />
                    )}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Paper>
  );
};

export default AudioSettings;

