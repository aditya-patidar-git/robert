import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Chip,
  Alert,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Build,
  Memory,
  Settings,
  Security,
  Speed,
  Storage,
  Save,
  Refresh,
  VolumeUp,
  Phone,
  Business,
  Lock,
  Visibility,
  Delete,
  Add,
  Edit,
  Warning,
  CheckCircle,
  ErrorOutline
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import { formatDateTime } from '../../utils/formatters';
import systemService from '../../services/systemService';
import configService from '../../services/configService';
import aiService from '../../services/aiService';
import mcpToolsService from '../../services/mcpToolsService';
import voiceService from '../../services/voiceService';
import ModelCapabilityRegistry from '../../components/config/ModelCapabilityRegistry';
import MCPToolsConfig from '../../components/config/MCPToolsConfig';
import AudioSettings from '../../components/config/AudioSettings';
import { useModelCapabilities } from '../../hooks/useModelCapabilities';
import { useAIModels } from '../../hooks/useAIModels';
import { useAudioConfig } from '../../hooks/useAudioConfig';
import { useTelephonyConfig } from '../../hooks/useTelephonyConfig';

const SystemConfigPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);

  const isOwner = user?.role === 'owner';


  // CRM Tasks state
  const [crmTasksConfig, setCrmTasksConfig] = useState({
    createBooking: { enabled: true, requireConfirmation: true },
    reschedule: { enabled: true, requireConfirmation: true },
    cancel: { enabled: true, requireConfirmation: true },
    updateRecord: { enabled: true, requireConfirmation: false },
    issueRefund: { enabled: false, requireConfirmation: true },
    dryRunEnforced: true,
    auditLogging: true
  });

  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      // MCP Tools settings
      mcpEnabled: true,
      mcpRateLimit: 100,
      mcpTimeout: 30,
      // System settings
      maxConcurrentCalls: 50,
      callTimeout: 300,
      retryAttempts: 3,
      logLevel: 'info',
      // Audio settings
      vadThreshold: 500,
      startPadding: 250,
      endPadding: 300,
      bargeInPolicy: 'pause',
      noiseSuppression: true,
      noiseSuppressionAlgorithm: 'basic',
      echoCancellation: true,
      automaticGainControl: false,
      audioQuality: 'high',
      energyThreshold: null,
      energyThresholdAutoCalibrate: true,
      // Telephony settings
      outboundCallerId: '+442045726060',
      // Privacy settings
      transcriptRetention: 90,
      recordingRetention: 90,
      metadataRetention: 365
    }
  });

  // Fetch system configuration
  const { data: systemConfig, isLoading: configLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => systemService.getSystemConfig(),
    onSuccess: (data) => {
      if (data) {
        Object.keys(data).forEach(key => {
          if (key in control._defaultValues) {
            setValue(key, data[key]);
          }
        });
      }
    }
  });


  // Use custom hooks for data fetching
  const { models, isLoading: modelsLoading } = useAIModels();
  const { capabilities: capabilitiesData, isLoading: capabilitiesLoading } = useModelCapabilities();
  const { isLoading: audioLoading } = useAudioConfig({ setValue, watch });
  const { config: telephonyConfig, isLoading: telephonyLoading } = useTelephonyConfig({ setValue, watch });

  // Fetch privacy configuration
  const { data: privacyConfigData, isLoading: privacyLoading } = useQuery({
    queryKey: ['privacy-config'],
    queryFn: () => configService.getPrivacyConfig()
  });

  // Update privacy form values when config is loaded
  useEffect(() => {
    if (privacyConfigData?.config) {
      const config = privacyConfigData.config;
      if (config.retentionSettings) {
        setValue('transcriptRetention', config.retentionSettings.transcriptRetention);
        setValue('recordingRetention', config.retentionSettings.recordingRetention);
        setValue('metadataRetention', config.retentionSettings.metadataRetention);
      }
    }
  }, [privacyConfigData, setValue]);

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: systemService.updateSystemConfig,
    onSuccess: () => {
      showSuccess('System configuration saved successfully');
      queryClient.invalidateQueries(['system-config']);
    },
    onError: () => showError('Failed to save system configuration')
  });

  // Use custom hooks for audio and telephony config
  const { saveConfig: saveAudioConfig, isSaving: isSavingAudio } = useAudioConfig({ setValue, watch });
  const { saveConfig: saveTelephonyConfig, isSaving: isSavingTelephony } = useTelephonyConfig({ setValue, watch });

  // Save privacy configuration mutation
  const savePrivacyConfigMutation = useMutation({
    mutationFn: configService.updatePrivacyConfig,
    onSuccess: () => {
      showSuccess('Privacy configuration saved successfully');
      queryClient.invalidateQueries(['privacy-config']);
    },
    onError: () => showError('Failed to save privacy configuration')
  });


  const onSubmit = (data) => {
    saveConfigMutation.mutate(data);
  };

  const handleSaveAudioConfig = (data) => {
    saveAudioConfig({
      vadThreshold: data.vadThreshold,
      startPadding: data.startPadding,
      endPadding: data.endPadding,
      bargeInPolicy: data.bargeInPolicy,
      noiseSuppression: data.noiseSuppression,
      noiseSuppressionAlgorithm: data.noiseSuppressionAlgorithm,
      echoCancellation: data.echoCancellation,
      automaticGainControl: data.automaticGainControl,
      audioQuality: data.audioQuality,
      energyThreshold: data.energyThreshold,
      energyThresholdAutoCalibrate: data.energyThresholdAutoCalibrate
    });
  };

  const handleSaveTelephonyConfig = (data) => {
    saveTelephonyConfig({
      outboundCallerId: data.outboundCallerId
    });
  };

  const handleSavePrivacyConfig = (data) => {
    const config = privacyConfigData?.config || {};
    savePrivacyConfigMutation.mutate({
      ...config,
      retentionSettings: {
        transcriptRetention: data.transcriptRetention,
        recordingRetention: data.recordingRetention,
        metadataRetention: data.metadataRetention
      }
    });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          System Configuration
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure MCP tools, model capabilities, and system-wide settings
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="MCP Tools" icon={<Build />} iconPosition="start" />
          <Tab label="Model Capability Registry" icon={<Memory />} iconPosition="start" />
          <Tab label="Audio Settings" icon={<VolumeUp />} iconPosition="start" />
          <Tab label="Telephony Settings" icon={<Phone />} iconPosition="start" />
          <Tab label="CRM Tasks" icon={<Business />} iconPosition="start" />
          <Tab label="Security & Privacy" icon={<Lock />} iconPosition="start" />
          <Tab label="General Settings" icon={<Settings />} iconPosition="start" />
        </Tabs>
      </Paper>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Tab A: MCP Tools */}
        {currentTab === 0 && (
          <Box>
            {/* MCP Controls */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
                MCP System Controls
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Model Context Protocol (MCP) tools configuration and rate limiting
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="mcpEnabled"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="Enable MCP Tools System"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Global Rate Limit: {watch('mcpRateLimit')} calls/sec
                  </Typography>
                  <Controller
                    name="mcpRateLimit"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        {...field}
                        min={10}
                        max={1000}
                        step={10}
                        marks={[
                          { value: 10, label: '10' },
                          { value: 100, label: '100' },
                          { value: 500, label: '500' },
                          { value: 1000, label: '1000' }
                        ]}
                        valueLabelDisplay="auto"
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* MCP Tools Registry */}
            <MCPToolsConfig showSystemControls={false} />
          </Box>
        )}

        {/* Tab B: Model Capability Registry */}
        {currentTab === 1 && (
          <Box>
            <ModelCapabilityRegistry mode="full" />
          </Box>
        )}

        {/* Tab C: Audio Settings */}
        {currentTab === 2 && (
          <form onSubmit={handleSubmit(handleSaveAudioConfig)}>
            <Box>
              {audioLoading ? (
                <LinearProgress sx={{ mb: 2 }} />
              ) : (
                <AudioSettings control={control} watch={watch} layout="compact" />
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save />}
                  disabled={isSavingAudio}
                >
                  {isSavingAudio ? 'Saving...' : 'Save Audio Config'}
                </Button>
              </Box>
            </Box>
          </form>
        )}

        {/* Tab D: Telephony Settings */}
        {currentTab === 3 && (
          <form onSubmit={handleSubmit(handleSaveTelephonyConfig)}>
            <Box>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Telephony Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure phone numbers, routing, transfer numbers, after-hours policy, and voicemail settings
                </Typography>

                {telephonyLoading ? (
                  <LinearProgress sx={{ mb: 2 }} />
                ) : (
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="outboundCallerId"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Outbound Caller ID"
                            placeholder="+442045726060"
                          />
                        )}
                      />
                    </Grid>

                    {telephonyConfig && (
                      <>
                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle1" gutterBottom>
                            Phone Numbers
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Number</TableCell>
                                  <TableCell>Route</TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>Description</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {telephonyConfig.numbers?.map((number, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{number.number}</TableCell>
                                    <TableCell>
                                      <Chip label={number.route} size="small" />
                                    </TableCell>
                                    <TableCell>
                                      <Chip 
                                        label={number.status} 
                                        size="small"
                                        color={number.status === 'active' ? 'success' : 'default'}
                                      />
                                    </TableCell>
                                    <TableCell>{number.description || 'N/A'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>

                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle1" gutterBottom>
                            Transfer Numbers
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Number</TableCell>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Department</TableCell>
                                  <TableCell>Status</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {telephonyConfig.transferNumbers?.map((transfer, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{transfer.number}</TableCell>
                                    <TableCell>{transfer.name || 'N/A'}</TableCell>
                                    <TableCell>{transfer.department || 'N/A'}</TableCell>
                                    <TableCell>
                                      <Chip 
                                        label={transfer.isActive ? 'Active' : 'Inactive'} 
                                        size="small"
                                        color={transfer.isActive ? 'success' : 'default'}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>

                        {telephonyConfig.afterHoursPolicy && (
                          <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" gutterBottom>
                              After-Hours Policy
                            </Typography>
                            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="body2">
                                <strong>Enabled:</strong> {telephonyConfig.afterHoursPolicy.enabled ? 'Yes' : 'No'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Hours:</strong> {telephonyConfig.afterHoursPolicy.startTime} - {telephonyConfig.afterHoursPolicy.endTime}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Timezone:</strong> {telephonyConfig.afterHoursPolicy.timezone}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Action:</strong> {telephonyConfig.afterHoursPolicy.action}
                              </Typography>
                            </Box>
                          </Grid>
                        )}

                        {telephonyConfig.voicemailSettings && (
                          <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" gutterBottom>
                              Voicemail Settings
                            </Typography>
                            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="body2">
                                <strong>Enabled:</strong> {telephonyConfig.voicemailSettings.enabled ? 'Yes' : 'No'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Max Duration:</strong> {telephonyConfig.voicemailSettings.maxDuration}s
                              </Typography>
                              <Typography variant="body2">
                                <strong>Email Notification:</strong> {telephonyConfig.voicemailSettings.emailNotification ? 'Yes' : 'No'}
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
                    disabled={isSavingTelephony}
                  >
                    {isSavingTelephony ? 'Saving...' : 'Save Telephony Config'}
                  </Button>
                </Box>
              </Paper>
            </Box>
          </form>
        )}

        {/* Tab E: CRM Tasks */}
        {currentTab === 4 && (
          <Box>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                CRM Tasks Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure which CRM tasks are enabled and whether they require human confirmation
              </Typography>

              <Grid container spacing={3}>
                {Object.entries(crmTasksConfig).filter(([key]) => key !== 'dryRunEnforced' && key !== 'auditLogging').map(([taskKey, taskConfig]) => (
                  <Grid item xs={12} md={6} key={taskKey}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom textTransform="capitalize">
                          {taskKey.replace(/([A-Z])/g, ' $1').trim()}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={taskConfig.enabled}
                                onChange={(e) => {
                                  setCrmTasksConfig(prev => ({
                                    ...prev,
                                    [taskKey]: { ...prev[taskKey], enabled: e.target.checked }
                                  }));
                                }}
                              />
                            }
                            label="Enabled"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={taskConfig.requireConfirmation}
                                onChange={(e) => {
                                  setCrmTasksConfig(prev => ({
                                    ...prev,
                                    [taskKey]: { ...prev[taskKey], requireConfirmation: e.target.checked }
                                  }));
                                }}
                                disabled={!taskConfig.enabled}
                              />
                            }
                            label="Require Human Confirmation"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>
                    General Settings
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={crmTasksConfig.dryRunEnforced}
                          onChange={(e) => {
                            setCrmTasksConfig(prev => ({
                              ...prev,
                              dryRunEnforced: e.target.checked
                            }));
                          }}
                        />
                      }
                      label="Enforce Dry-Run Before Execution"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={crmTasksConfig.auditLogging}
                          onChange={(e) => {
                            setCrmTasksConfig(prev => ({
                              ...prev,
                              auditLogging: e.target.checked
                            }));
                          }}
                        />
                      }
                      label="Enable Audit Logging"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={() => {
                    // TODO: Implement save to backend when CRM config endpoint is available
                    showSuccess('CRM tasks configuration saved (Note: Backend endpoint pending)');
                  }}
                >
                  Save CRM Tasks Config
                </Button>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Tab F: Security & Privacy */}
        {currentTab === 5 && (
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
        )}

        {/* Tab G: General Settings */}
        {currentTab === 6 && (
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
              >
                {saveConfigMutation.isLoading ? 'Saving...' : 'Save Configuration'}
              </Button>
            </Box>
          </Box>
        )}
      </form>
    </Container>
  );
};

export default SystemConfigPage;