import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Slider,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  Divider
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { Save } from '@mui/icons-material';
import { useToast } from '../../components/common/ToastProvider';
import configService from '../../services/configService';
import telephonyService from '../../services/telephonyService';

const AudioTelephonyPage = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const { control, handleSubmit, watch } = useForm({
    defaultValues: {
      vadThreshold: 800,
      startPadding: 300,
      endPadding: 700,
      bargeInPolicy: 'pause',
      outboundCallerId: '+1234567890',
      numbers: []
    }
  });

  // Fetch audio configuration
  const { data: audioConfig, isLoading: audioLoading } = useQuery({
    queryKey: ['audio-config'],
    queryFn: configService.getAudioConfig,
    onSuccess: (data) => {
      if (data) {
        Object.keys(data).forEach(key => {
          if (key in control._defaultValues) {
            control._formValues[key] = data[key];
          }
        });
      }
    }
  });

  // Fetch telephony configuration
  const { data: telephonyConfig, isLoading: telephonyLoading } = useQuery({
    queryKey: ['telephony-config'],
    queryFn: configService.getTelephonyConfig,
    onSuccess: (data) => {
      if (data?.numbers) {
        control._formValues.numbers = data.numbers;
      }
      if (data?.outboundCallerId) {
        control._formValues.outboundCallerId = data.outboundCallerId;
      }
    }
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data) => {
      await Promise.all([
        configService.updateAudioConfig({
          vadThreshold: data.vadThreshold,
          startPadding: data.startPadding,
          endPadding: data.endPadding,
          bargeInPolicy: data.bargeInPolicy
        }),
        configService.updateTelephonyConfig({
          numbers: data.numbers,
          outboundCallerId: data.outboundCallerId
        })
      ]);
    },
    onSuccess: () => {
      showSuccess('Configuration saved successfully');
      queryClient.invalidateQueries(['audio-config']);
      queryClient.invalidateQueries(['telephony-config']);
    },
    onError: () => showError('Failed to save configuration')
  });

  const onSubmit = (data) => {
    saveConfigMutation.mutate(data);
  };

  const updateNumberRoute = (index, route) => {
    const currentNumbers = watch('numbers');
    const updatedNumbers = [...currentNumbers];
    updatedNumbers[index] = { ...updatedNumbers[index], route };
    control._formValues.numbers = updatedNumbers;
  };

  // Mock provisioned numbers for demonstration
  const provisionedNumbers = telephonyConfig?.numbers || [
    { number: '+1234567890', route: 'ai_agent', status: 'active' },
    { number: '+1987654321', route: 'transfer', status: 'active' },
    { number: '+1555666777', route: 'voicemail', status: 'inactive' }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Audio & Telephony Configuration
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure voice processing settings and telephony routing
        </Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Section A: Audio Controls */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
            Audio Controls
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure voice activity detection and audio processing parameters
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 4 }}>
            {/* VAD Threshold */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                VAD Threshold: {watch('vadThreshold')}ms
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Voice Activity Detection sensitivity (100-2000ms)
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
                  />
                )}
              />
            </Box>

            {/* Start Padding */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Start Padding: {watch('startPadding')}ms
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Audio capture padding before speech detection
              </Typography>
              <Controller
                name="startPadding"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    fullWidth
                    inputProps={{ min: 0, max: 1000, step: 50 }}
                    helperText="0-1000ms"
                  />
                )}
              />
            </Box>

            {/* End Padding */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                End Padding: {watch('endPadding')}ms
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Audio capture padding after speech ends
              </Typography>
              <Controller
                name="endPadding"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    fullWidth
                    inputProps={{ min: 0, max: 1500, step: 50 }}
                    helperText="0-1500ms"
                  />
                )}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Barge-in Policy */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Barge-in Policy
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              How the system should handle interruptions during AI speech
            </Typography>
            <Controller
              name="bargeInPolicy"
              control={control}
              render={({ field }) => (
                <RadioGroup {...field} row>
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
        </Paper>

        {/* Section B: Telephony Routing */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
            Telephony Routing
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure routing for provisioned phone numbers
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Phone Number</TableCell>
                  <TableCell>Route Assignment</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {provisionedNumbers.map((number, index) => (
                  <TableRow key={number.number}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {number.number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select
                          value={number.route || 'ai_agent'}
                          onChange={(e) => updateNumberRoute(index, e.target.value)}
                        >
                          <MenuItem value="ai_agent">AI Agent</MenuItem>
                          <MenuItem value="transfer">Transfer to Human</MenuItem>
                          <MenuItem value="voicemail">Voicemail</MenuItem>
                          <MenuItem value="after_hours">After-hours Message</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={number.status === 'active' ? 'success.main' : 'text.secondary'}
                      >
                        {number.status}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {provisionedNumbers.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No provisioned numbers found. Contact your administrator to provision phone numbers.
            </Alert>
          )}
        </Paper>

        {/* Section C: CLI Presentation */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
            CLI Presentation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure the caller ID for outbound calls
          </Typography>

          <Box sx={{ maxWidth: 400 }}>
            <Controller
              name="outboundCallerId"
              control={control}
              rules={{
                required: 'Caller ID is required',
                pattern: {
                  value: /^\+?[1-9]\d{1,14}$/,
                  message: 'Enter a valid phone number'
                }
              }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  label="Outbound Caller ID"
                  fullWidth
                  placeholder="+1234567890"
                  error={!!error}
                  helperText={error?.message || 'Global caller ID for all outbound calls'}
                  inputProps={{ 
                    pattern: '[+]?[0-9]*',
                    title: 'Enter a valid phone number with country code'
                  }}
                />
              )}
            />
          </Box>
        </Paper>

        {/* Save Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<Save />}
            disabled={saveConfigMutation.isLoading}
            sx={{ minWidth: 150 }}
          >
            {saveConfigMutation.isLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </Box>
      </form>
    </Container>
  );
};

export default AudioTelephonyPage;