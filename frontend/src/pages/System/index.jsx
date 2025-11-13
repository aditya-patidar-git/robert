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

const SystemConfigPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);

  const isOwner = user?.role === 'owner';

  // MCP Tools state for domain management
  const [editingDomains, setEditingDomains] = useState({});
  const [newDomainInputs, setNewDomainInputs] = useState({});
  const [rateLimitValues, setRateLimitValues] = useState({});

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
    queryFn: systemService.getSystemConfig,
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

  // Fetch MCP tools - using real API
  const { data: fetchedMcpTools = [], isLoading: mcpLoading, refetch: refetchMcpTools } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: mcpToolsService.getAllTools
  });

  // Update local state when MCP tools are fetched
  useEffect(() => {
    if (fetchedMcpTools && fetchedMcpTools.length > 0) {
      const domainsState = {};
      const rateLimitState = {};
      fetchedMcpTools.forEach(tool => {
        domainsState[tool.name] = [...(tool.domains || [])];
        rateLimitState[tool.name] = tool.rateLimit?.limit || 100;
      });
      setEditingDomains(domainsState);
      setRateLimitValues(rateLimitState);
    }
  }, [fetchedMcpTools]);

  // Fetch available models - using real API
  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => aiService.getModels(),
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  // Fetch model capabilities
  const { data: capabilitiesData, isLoading: capabilitiesLoading } = useQuery({
    queryKey: ['model-capabilities'],
    queryFn: aiService.getModelCapabilities,
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  // Fetch audio configuration
  const { data: audioConfigData, isLoading: audioLoading } = useQuery({
    queryKey: ['audio-config'],
    queryFn: configService.getAudioConfig
  });

  // Update audio form values when config is loaded
  useEffect(() => {
    if (audioConfigData?.config) {
      const config = audioConfigData.config;
      setValue('vadThreshold', config.vadThreshold);
      setValue('startPadding', config.startPadding);
      setValue('endPadding', config.endPadding);
      setValue('bargeInPolicy', config.bargeInPolicy);
      setValue('noiseSuppression', config.noiseSuppression);
      setValue('noiseSuppressionAlgorithm', config.noiseSuppressionAlgorithm || 'basic');
      setValue('echoCancellation', config.echoCancellation);
      setValue('automaticGainControl', config.automaticGainControl || false);
      setValue('audioQuality', config.audioQuality);
      setValue('energyThreshold', config.energyThreshold);
      setValue('energyThresholdAutoCalibrate', config.energyThresholdAutoCalibrate !== undefined ? config.energyThresholdAutoCalibrate : true);
    }
  }, [audioConfigData, setValue]);

  // Fetch telephony configuration
  const { data: telephonyConfigData, isLoading: telephonyLoading } = useQuery({
    queryKey: ['telephony-config'],
    queryFn: configService.getTelephonyConfig
  });

  // Update telephony form values when config is loaded
  useEffect(() => {
    if (telephonyConfigData?.config) {
      const config = telephonyConfigData.config;
      setValue('outboundCallerId', config.outboundCallerId || '+442045726060');
    }
  }, [telephonyConfigData, setValue]);

  // Fetch privacy configuration
  const { data: privacyConfigData, isLoading: privacyLoading } = useQuery({
    queryKey: ['privacy-config'],
    queryFn: configService.getPrivacyConfig
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

  // Save audio configuration mutation
  const saveAudioConfigMutation = useMutation({
    mutationFn: configService.updateAudioConfig,
    onSuccess: () => {
      showSuccess('Audio configuration saved successfully');
      queryClient.invalidateQueries(['audio-config']);
    },
    onError: () => showError('Failed to save audio configuration')
  });

  // Save telephony configuration mutation
  const saveTelephonyConfigMutation = useMutation({
    mutationFn: configService.updateTelephonyConfig,
    onSuccess: () => {
      showSuccess('Telephony configuration saved successfully');
      queryClient.invalidateQueries(['telephony-config']);
    },
    onError: () => showError('Failed to save telephony configuration')
  });

  // Save privacy configuration mutation
  const savePrivacyConfigMutation = useMutation({
    mutationFn: configService.updatePrivacyConfig,
    onSuccess: () => {
      showSuccess('Privacy configuration saved successfully');
      queryClient.invalidateQueries(['privacy-config']);
    },
    onError: () => showError('Failed to save privacy configuration')
  });

  // MCP Tools Handlers
  const handleToggleTool = async (toolName, enabled) => {
    try {
      if (enabled) {
        await mcpToolsService.enableTool(toolName);
      } else {
        await mcpToolsService.disableTool(toolName);
      }
      showSuccess(`Tool ${toolName} ${enabled ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to ${enabled ? 'enable' : 'disable'} tool ${toolName}`);
    }
  };

  const handleUpdateRateLimit = async (toolName, newLimit) => {
    try {
      if (newLimit < 1 || newLimit > 1000) {
        showError('Rate limit must be between 1 and 1000');
        return;
      }
      await mcpToolsService.updateRateLimit(toolName, newLimit);
      showSuccess(`Rate limit updated for ${toolName}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to update rate limit for ${toolName}`);
    }
  };

  const handleAddDomain = useCallback((toolName, domain) => {
    if (!domain || domain.trim() === '') {
      showError('Domain cannot be empty');
      return;
    }
    
    // Basic domain validation
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain.trim())) {
      showError('Invalid domain format');
      return;
    }

    setEditingDomains(prev => {
      const currentDomains = prev[toolName] || [];
      if (currentDomains.includes(domain.trim())) {
        showError('Domain already exists');
        return prev;
      }
      const updatedDomains = [...currentDomains, domain.trim()];
      return { ...prev, [toolName]: updatedDomains };
    });
    setNewDomainInputs(prev => ({ ...prev, [toolName]: '' }));
  }, [showError]);

  const handleRemoveDomain = useCallback((toolName, domainToRemove) => {
    setEditingDomains(prev => {
      const currentDomains = prev[toolName] || [];
      const updatedDomains = currentDomains.filter(d => d !== domainToRemove);
      return { ...prev, [toolName]: updatedDomains };
    });
  }, []);

  const handleSaveDomains = async (toolName) => {
    try {
      const domains = editingDomains[toolName] || [];
      await mcpToolsService.updateDomainAllowlist(toolName, domains);
      showSuccess(`Domain allowlist updated for ${toolName}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to update domain allowlist for ${toolName}`);
    }
  };

  const onSubmit = (data) => {
    saveConfigMutation.mutate(data);
  };

  const handleSaveAudioConfig = (data) => {
    const config = audioConfigData?.config || {};
    saveAudioConfigMutation.mutate({
      ...config,
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
    const config = telephonyConfigData?.config || {};
    saveTelephonyConfigMutation.mutate({
      ...config,
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
            <Paper>
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  Available MCP Tools ({fetchedMcpTools.length})
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => refetchMcpTools()}
                  disabled={mcpLoading}
                >
                  Refresh
                </Button>
              </Box>
              {mcpLoading ? (
                <LinearProgress sx={{ mb: 2 }} />
              ) : fetchedMcpTools.length === 0 ? (
                <Alert severity="info" sx={{ m: 2 }}>
                  No MCP tools found. Tools will be discovered on system startup.
                </Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Tool</strong></TableCell>
                        <TableCell><strong>Description</strong></TableCell>
                        <TableCell align="center"><strong>Enabled</strong></TableCell>
                        <TableCell><strong>Rate Limit</strong></TableCell>
                        <TableCell><strong>Domain Allowlist</strong></TableCell>
                        <TableCell><strong>Usage Stats</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {fetchedMcpTools.map((tool) => {
                        const toolDomains = editingDomains[tool.name] || tool.domains || [];
                        const newDomainInput = newDomainInputs[tool.name] || '';
                        const rateLimitValue = rateLimitValues[tool.name] ?? tool.rateLimit?.limit ?? 100;
                        
                        return (
                          <TableRow key={tool.name}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium" fontFamily="monospace">
                                {tool.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Tooltip title={tool.description || 'No description available'}>
                                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {tool.description || 'N/A'}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="center">
                              <Switch
                                checked={tool.enabled}
                                onChange={(e) => handleToggleTool(tool.name, e.target.checked)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                  type="number"
                                  value={rateLimitValue}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value)) {
                                      setRateLimitValues(prev => ({ ...prev, [tool.name]: value }));
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value) && value !== tool.rateLimit?.limit) {
                                      handleUpdateRateLimit(tool.name, value);
                                    }
                                  }}
                                  inputProps={{
                                    min: 1,
                                    max: 1000,
                                    style: { textAlign: 'center', width: '80px' }
                                  }}
                                  size="small"
                                  sx={{ width: '100px' }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  /min
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ minWidth: 250 }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                  {toolDomains.length > 0 ? (
                                    toolDomains.map((domain, idx) => (
                                      <Chip
                                        key={idx}
                                        label={domain}
                                        size="small"
                                        onDelete={() => handleRemoveDomain(tool.name, domain)}
                                        color="primary"
                                        variant="outlined"
                                      />
                                    ))
                                  ) : (
                                    <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                      All domains allowed
                                    </Typography>
                                  )}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <TextField
                                    placeholder="Add domain"
                                    value={newDomainInput}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setNewDomainInputs(prev => {
                                        if (prev[tool.name] === value) return prev;
                                        return { ...prev, [tool.name]: value };
                                      });
                                    }}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        handleAddDomain(tool.name, newDomainInput);
                                      }
                                    }}
                                    size="small"
                                    sx={{ flex: 1 }}
                                  />
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleAddDomain(tool.name, newDomainInput)}
                                    disabled={!newDomainInput.trim()}
                                  >
                                    Add
                                  </Button>
                                  {(() => {
                                    const originalDomains = tool.domains || [];
                                    const hasChanges = toolDomains.length !== originalDomains.length || 
                                      toolDomains.some((domain, idx) => domain !== (originalDomains[idx] || ''));
                                    return hasChanges ? (
                                      <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => handleSaveDomains(tool.name)}
                                      >
                                        Save
                                      </Button>
                                    ) : null;
                                  })()}
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="caption" display="block">
                                  Used: {tool.usageCount || 0} times
                                </Typography>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {tool.lastUsed ? formatDateTime(tool.lastUsed) : 'Never'}
                                </Typography>
                                {tool.rateLimit && (
                                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Current: {tool.rateLimit.current}/{tool.rateLimit.limit}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Box>
        )}

        {/* Tab B: Model Capability Registry */}
        {currentTab === 1 && (
          <Box>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Model Capability Registry
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => {
                    queryClient.invalidateQueries(['model-capabilities']);
                    queryClient.invalidateQueries(['ai-models']);
                  }}
                  disabled={capabilitiesLoading || modelsLoading}
                >
                  Refresh
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Dynamic registry of available AI models discovered from OpenAI API. Auto-refreshes every 5 minutes.
              </Typography>

              {capabilitiesLoading || modelsLoading ? (
                <LinearProgress sx={{ mb: 2 }} />
              ) : (() => {
                const allCapabilities = capabilitiesData?.capabilities || [];
                const allModels = models || [];
                
                // Combine models and capabilities
                const modelsWithCapabilities = allModels.map(model => {
                  const capabilities = allCapabilities.find(cap => cap.id === model.id);
                  return {
                    ...model,
                    ...capabilities
                  };
                });

                if (modelsWithCapabilities.length === 0) {
                  return (
                    <Alert severity="info">
                      No models found. Models will be discovered on system startup.
                    </Alert>
                  );
                }

                return (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Model Name</strong></TableCell>
                          <TableCell align="right"><strong>Context Limit</strong></TableCell>
                          <TableCell align="center"><strong>Tools</strong></TableCell>
                          <TableCell align="center"><strong>Audio</strong></TableCell>
                          <TableCell align="center"><strong>Realtime</strong></TableCell>
                          <TableCell align="center"><strong>File Search</strong></TableCell>
                          <TableCell align="center"><strong>Details</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {modelsWithCapabilities.map((model) => (
                          <TableRow 
                            key={model.id}
                            sx={{ 
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {model.name || model.id}
                                </Typography>
                                {model.capabilities?.realtime && (
                                  <Chip 
                                    label="Realtime" 
                                    size="small" 
                                    color="primary"
                                    variant="outlined"
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              {model.contextLimit || model.context_limit 
                                ? (model.contextLimit || model.context_limit).toLocaleString() 
                                : 'N/A'}
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={model.supportsTools ? 'Yes' : 'No'} 
                                color={model.supportsTools ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={model.supportsAudio ? 'Yes' : 'No'} 
                                color={model.supportsAudio ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={model.capabilities?.realtime ? 'Yes' : 'No'} 
                                color={model.capabilities?.realtime ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={model.capabilities?.fileSearch ? 'Yes' : 'No'} 
                                color={model.capabilities?.fileSearch ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip 
                                title={
                                  <Box>
                                    <Typography variant="caption" display="block" fontWeight="bold">
                                      Additional Details:
                                    </Typography>
                                    {model.defaultTemperature && (
                                      <Typography variant="caption" display="block">
                                        Default Temp: {model.defaultTemperature}
                                      </Typography>
                                    )}
                                    {model.defaultTopP && (
                                      <Typography variant="caption" display="block">
                                        Default Top-P: {model.defaultTopP}
                                      </Typography>
                                    )}
                                    {model.rateLimits && (
                                      <>
                                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                          Rate Limits:
                                        </Typography>
                                        <Typography variant="caption" display="block">
                                          • {model.rateLimits.requestsPerMinute || 'N/A'} req/min
                                        </Typography>
                                        <Typography variant="caption" display="block">
                                          • {model.rateLimits.tokensPerMinute?.toLocaleString() || 'N/A'} tokens/min
                                        </Typography>
                                      </>
                                    )}
                                    {model.knownLimitations && model.knownLimitations.length > 0 && (
                                      <>
                                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }} fontWeight="bold">
                                          Limitations:
                                        </Typography>
                                        {model.knownLimitations.map((limitation, idx) => (
                                          <Typography key={idx} variant="caption" display="block">
                                            • {limitation}
                                          </Typography>
                                        ))}
                                      </>
                                    )}
                                  </Box>
                                }
                              >
                                <IconButton size="small">
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              })()}
            </Paper>
          </Box>
        )}

        {/* Tab C: Audio Settings */}
        {currentTab === 2 && (
          <form onSubmit={handleSubmit(handleSaveAudioConfig)}>
            <Box>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Audio Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure voice activity detection, audio quality, and barge-in settings
                </Typography>

                {audioLoading ? (
                  <LinearProgress sx={{ mb: 2 }} />
                ) : (
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
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
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
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
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
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
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="bargeInPolicy"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Barge-in Policy</InputLabel>
                            <Select {...field} label="Barge-in Policy">
                              <MenuItem value="pause">Pause</MenuItem>
                              <MenuItem value="stop">Stop</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="noiseSuppression"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Switch {...field} checked={field.value} />}
                            label="Noise Suppression"
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="noiseSuppressionAlgorithm"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Noise Suppression Algorithm</InputLabel>
                            <Select {...field} label="Noise Suppression Algorithm">
                              <MenuItem value="basic">Basic</MenuItem>
                              <MenuItem value="rnnoise">RNNoise</MenuItem>
                              <MenuItem value="webrtc">WebRTC</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="echoCancellation"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Switch {...field} checked={field.value} />}
                            label="Echo Cancellation"
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="automaticGainControl"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Switch {...field} checked={field.value} />}
                            label="Automatic Gain Control"
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="audioQuality"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Audio Quality</InputLabel>
                            <Select {...field} label="Audio Quality">
                              <MenuItem value="standard">Standard</MenuItem>
                              <MenuItem value="high">High</MenuItem>
                              <MenuItem value="premium">Premium</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="energyThresholdAutoCalibrate"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Switch {...field} checked={field.value} />}
                            label="Auto-calibrate Energy Threshold"
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<Save />}
                    disabled={saveAudioConfigMutation.isLoading}
                  >
                    {saveAudioConfigMutation.isLoading ? 'Saving...' : 'Save Audio Config'}
                  </Button>
                </Box>
              </Paper>
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

                    {telephonyConfigData?.config && (
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
                                {telephonyConfigData.config.numbers?.map((number, idx) => (
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
                                {telephonyConfigData.config.transferNumbers?.map((transfer, idx) => (
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

                        {telephonyConfigData.config.afterHoursPolicy && (
                          <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" gutterBottom>
                              After-Hours Policy
                            </Typography>
                            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="body2">
                                <strong>Enabled:</strong> {telephonyConfigData.config.afterHoursPolicy.enabled ? 'Yes' : 'No'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Hours:</strong> {telephonyConfigData.config.afterHoursPolicy.startTime} - {telephonyConfigData.config.afterHoursPolicy.endTime}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Timezone:</strong> {telephonyConfigData.config.afterHoursPolicy.timezone}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Action:</strong> {telephonyConfigData.config.afterHoursPolicy.action}
                              </Typography>
                            </Box>
                          </Grid>
                        )}

                        {telephonyConfigData.config.voicemailSettings && (
                          <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" gutterBottom>
                              Voicemail Settings
                            </Typography>
                            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="body2">
                                <strong>Enabled:</strong> {telephonyConfigData.config.voicemailSettings.enabled ? 'Yes' : 'No'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Max Duration:</strong> {telephonyConfigData.config.voicemailSettings.maxDuration}s
                              </Typography>
                              <Typography variant="body2">
                                <strong>Email Notification:</strong> {telephonyConfigData.config.voicemailSettings.emailNotification ? 'Yes' : 'No'}
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
                    disabled={saveTelephonyConfigMutation.isLoading}
                  >
                    {saveTelephonyConfigMutation.isLoading ? 'Saving...' : 'Save Telephony Config'}
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