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
  Divider,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel as MuiFormControlLabel,
  Tabs,
  Tab,
  LinearProgress
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { 
  Save, 
  PlayArrow, 
  Stop, 
  Add, 
  Edit, 
  Delete, 
  Phone, 
  Settings, 
  VolumeUp,
  Mic,
  Headset,
  Refresh
} from '@mui/icons-material';
import { useToast } from '../../components/common/ToastProvider';
import configService from '../../services/configService';
import telephonyService from '../../services/telephonyService';
import voiceService from '../../services/voiceService';

const AudioTelephonyPage = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [addNumberDialog, setAddNumberDialog] = useState(false);
  const [voicePreviewDialog, setVoicePreviewDialog] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      vadThreshold: 500,
      startPadding: 250,
      endPadding: 300,
      bargeInPolicy: 'pause',
      noiseSuppression: true,
      echoCancellation: true,
      audioQuality: 'high',
      defaultVoice: { id: 'ash', name: 'Ash', language: 'en-GB' },
      temperature: 0.4,
      topP: 1.0,
      maxTokens: 150,
      speechRate: 1.0,
      outboundCallerId: '+442045726060',
      numbers: []
    }
  });

  // Fetch audio configuration
  const { data: audioConfig, isLoading: audioLoading } = useQuery({
    queryKey: ['audio-config'],
    queryFn: configService.getAudioConfig,
    onSuccess: (data) => {
      if (data?.config) {
        const config = data.config;
        setValue('vadThreshold', config.vadThreshold);
        setValue('startPadding', config.startPadding);
        setValue('endPadding', config.endPadding);
        setValue('bargeInPolicy', config.bargeInPolicy);
        setValue('noiseSuppression', config.noiseSuppression);
        setValue('echoCancellation', config.echoCancellation);
        setValue('audioQuality', config.audioQuality);
        setValue('defaultVoice', config.defaultVoice);
        setValue('temperature', config.temperature);
        setValue('topP', config.topP);
        setValue('maxTokens', config.maxTokens);
        setValue('speechRate', config.speechRate);
      }
    }
  });

  // Fetch telephony configuration
  const { data: telephonyConfig, isLoading: telephonyLoading } = useQuery({
    queryKey: ['telephony-config'],
    queryFn: configService.getTelephonyConfig,
    onSuccess: (data) => {
      if (data?.config) {
        const config = data.config;
        setValue('numbers', config.numbers || []);
        setValue('outboundCallerId', config.outboundCallerId);
      }
    }
  });

  // Fetch available voices
  const { data: voicesData, isLoading: voicesLoading } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices(),
    onSuccess: (data) => {
      if (data?.voices?.length > 0) {
        const defaultVoice = data.voices.find(v => v.isDefault) || data.voices[0];
        setSelectedVoice(defaultVoice);
      }
    }
  });

  // Fetch audio metrics
  const { data: audioMetrics } = useQuery({
    queryKey: ['audio-metrics'],
    queryFn: configService.getAudioMetrics,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data) => {
      await Promise.all([
        configService.updateAudioConfig({
          vadThreshold: data.vadThreshold,
          startPadding: data.startPadding,
          endPadding: data.endPadding,
          bargeInPolicy: data.bargeInPolicy,
          noiseSuppression: data.noiseSuppression,
          echoCancellation: data.echoCancellation,
          audioQuality: data.audioQuality,
          defaultVoice: data.defaultVoice,
          temperature: data.temperature,
          topP: data.topP,
          maxTokens: data.maxTokens,
          speechRate: data.speechRate
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

  // Voice preview mutation
  const voicePreviewMutation = useMutation({
    mutationFn: ({ voiceId, text }) => voiceService.previewVoice(voiceId, text),
    onSuccess: (data) => {
      // Handle voice preview - in a real app, this would play audio
      console.log('Voice preview:', data);
      showSuccess('Voice preview generated');
    },
    onError: () => showError('Failed to generate voice preview')
  });

  const onSubmit = (data) => {
    saveConfigMutation.mutate(data);
  };

  const handleVoicePreview = (voice) => {
    setSelectedVoice(voice);
    setVoicePreviewDialog(true);
  };

  const handlePlayPreview = (text) => {
    if (selectedVoice) {
      voicePreviewMutation.mutate({ voiceId: selectedVoice.id, text });
    }
  };

  const handleAddNumber = (numberData) => {
    // Implementation for adding phone number
    console.log('Adding number:', numberData);
    setAddNumberDialog(false);
  };

  const provisionedNumbers = watch('numbers') || [];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Audio & Telephony Configuration
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure voice processing settings, telephony routing, and call management
        </Typography>
      </Box>

      {/* Tabs Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Audio Settings" icon={<VolumeUp />} />
          <Tab label="Voice Management" icon={<Mic />} />
          <Tab label="Telephony Routing" icon={<Phone />} />
          <Tab label="Call Quality" icon={<Headset />} />
        </Tabs>
      </Paper>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Tab 1: Audio Settings */}
        {activeTab === 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
              Audio Processing Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure voice activity detection and audio processing parameters
            </Typography>

            <Grid container spacing={4}>
              {/* VAD Settings */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Voice Activity Detection
                    </Typography>
                    <Box sx={{ mb: 3 }}>
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
                          />
                        )}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Audio Quality */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Audio Quality Settings
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Controller
                        name="audioQuality"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Audio Quality</InputLabel>
                            <Select {...field}>
                              <MenuItem value="standard">Standard</MenuItem>
                              <MenuItem value="high">High</MenuItem>
                              <MenuItem value="premium">Premium</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Box>
                    <Controller
                      name="noiseSuppression"
                      control={control}
                      render={({ field }) => (
                        <MuiFormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="Noise Suppression"
                        />
                      )}
                    />
                    <Controller
                      name="echoCancellation"
                      control={control}
                      render={({ field }) => (
                        <MuiFormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="Echo Cancellation"
                        />
                      )}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Padding Settings */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Audio Padding
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Controller
                        name="startPadding"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Start Padding (ms)"
                            type="number"
                            fullWidth
                            inputProps={{ min: 0, max: 1000, step: 50 }}
                            helperText="Audio capture padding before speech detection"
                          />
                        )}
                      />
                    </Box>
                    <Controller
                      name="endPadding"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="End Padding (ms)"
                          type="number"
                          fullWidth
                          inputProps={{ min: 0, max: 1500, step: 50 }}
                          helperText="Audio capture padding after speech ends"
                        />
                      )}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Barge-in Policy */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Barge-in Policy
                    </Typography>
                    <Controller
                      name="bargeInPolicy"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup {...field}>
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
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Tab 2: Voice Management */}
        {activeTab === 1 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
              Voice Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select and configure AI voices for different languages and scenarios
            </Typography>

            {voicesLoading ? (
              <LinearProgress />
            ) : (
              <Grid container spacing={3}>
                {voicesData?.voices?.map((voice) => (
                  <Grid item xs={12} md={6} lg={4} key={voice.id}>
                    <Card sx={{ 
                      border: selectedVoice?.id === voice.id ? 2 : 1,
                      borderColor: selectedVoice?.id === voice.id ? 'primary.main' : 'divider'
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">{voice.name}</Typography>
                          {voice.isDefault && <Chip label="Default" color="primary" size="small" />}
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {voice.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                          <Chip label={voice.language} size="small" />
                          <Chip label={voice.gender} size="small" />
                          <Chip label={voice.provider} size="small" />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            startIcon={<PlayArrow />}
                            onClick={() => handleVoicePreview(voice)}
                          >
                            Preview
                          </Button>
                          <Button
                            size="small"
                            variant={selectedVoice?.id === voice.id ? "contained" : "outlined"}
                            onClick={() => setSelectedVoice(voice)}
                          >
                            {selectedVoice?.id === voice.id ? "Selected" : "Select"}
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        )}

        {/* Tab 3: Telephony Routing */}
        {activeTab === 2 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" component="h2" fontWeight="bold">
                Telephony Routing
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setAddNumberDialog(true)}
              >
                Add Number
              </Button>
            </Box>
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
                    <TableCell>Actions</TableCell>
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
                            onChange={(e) => {
                              const updatedNumbers = [...provisionedNumbers];
                              updatedNumbers[index] = { ...updatedNumbers[index], route: e.target.value };
                              setValue('numbers', updatedNumbers);
                            }}
                          >
                            <MenuItem value="ai_agent">AI Agent</MenuItem>
                            <MenuItem value="transfer">Transfer to Human</MenuItem>
                            <MenuItem value="voicemail">Voicemail</MenuItem>
                            <MenuItem value="after_hours">After-hours Message</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={number.status} 
                          color={number.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small">
                          <Edit />
                        </IconButton>
                        <IconButton size="small" color="error">
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {provisionedNumbers.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No provisioned numbers found. Add a phone number to get started.
              </Alert>
            )}

            {/* CLI Presentation */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom>
              CLI Presentation
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
                    placeholder="+442045726060"
                    error={!!error}
                    helperText={error?.message || 'Global caller ID for all outbound calls'}
                  />
                )}
              />
            </Box>
          </Paper>
        )}

        {/* Tab 4: Call Quality */}
        {activeTab === 3 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
              Call Quality Metrics
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Real-time audio quality monitoring and performance metrics
            </Typography>

            {audioMetrics?.metrics && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h4" color="primary">
                        {audioMetrics.metrics.averageLatency}ms
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Average Latency
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h4" color="success.main">
                        {audioMetrics.metrics.mosScore}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        MOS Score
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h4" color="warning.main">
                        {audioMetrics.metrics.packetLoss}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Packet Loss
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h4" color="info.main">
                        {audioMetrics.metrics.jitter}ms
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Jitter
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Paper>
        )}

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

      {/* Voice Preview Dialog */}
      <Dialog open={voicePreviewDialog} onClose={() => setVoicePreviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Voice Preview</DialogTitle>
        <DialogContent>
          {selectedVoice && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedVoice.name} ({selectedVoice.language})
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedVoice.description}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                defaultValue={selectedVoice.sampleText}
                label="Preview Text"
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoicePreviewDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            startIcon={<PlayArrow />}
            onClick={() => handlePlayPreview(selectedVoice?.sampleText)}
            disabled={voicePreviewMutation.isLoading}
          >
            {voicePreviewMutation.isLoading ? 'Generating...' : 'Play Preview'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AudioTelephonyPage;