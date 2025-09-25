import React, { useState } from 'react';
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
  Divider
} from '@mui/material';
import {
  Build,
  Memory,
  Settings,
  Security,
  Speed,
  Storage,
  Save
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import systemService from '../../services/systemService';
import configService from '../../services/configService';

const SystemConfigPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);

  const isOwner = user?.role === 'owner';

  const { control, handleSubmit, watch } = useForm({
    defaultValues: {
      // MCP Tools settings
      mcpEnabled: true,
      mcpRateLimit: 100,
      mcpTimeout: 30,
      // System settings
      maxConcurrentCalls: 50,
      callTimeout: 300,
      retryAttempts: 3,
      logLevel: 'info'
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
            control._formValues[key] = data[key];
          }
        });
      }
    }
  });

  // Fetch MCP tools
  const { data: mcpTools = [], isLoading: mcpLoading } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: systemService.getMCPTools
  });

  // Fetch available models
  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['available-models'],
    queryFn: systemService.getAvailableModels
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: systemService.updateSystemConfig,
    onSuccess: () => {
      showSuccess('System configuration saved successfully');
      queryClient.invalidateQueries(['system-config']);
    },
    onError: () => showError('Failed to save system configuration')
  });

  // Toggle MCP tool mutation
  const toggleMCPMutation = useMutation({
    mutationFn: ({ toolName, enabled }) => 
      systemService.executeMCPTool(enabled ? 'enable' : 'disable', { tool: toolName }),
    onSuccess: () => {
      showSuccess('MCP tool status updated');
      queryClient.invalidateQueries(['mcp-tools']);
    },
    onError: () => showError('Failed to update MCP tool status')
  });

  const onSubmit = (data) => {
    saveConfigMutation.mutate(data);
  };

  const handleMCPToggle = (toolName, enabled) => {
    toggleMCPMutation.mutate({ toolName, enabled });
  };

  // Mock MCP tools data
  const mockMCPTools = [
    {
      id: 'tool_001',
      name: 'web-scraper',
      description: 'Web scraping capabilities for data extraction',
      enabled: true,
      rateLimit: 100,
      status: 'active'
    },
    {
      id: 'tool_002',
      name: 'file-processor',
      description: 'File processing and document analysis',
      enabled: false,
      rateLimit: 50,
      status: 'inactive'
    },
    {
      id: 'tool_003',
      name: 'api-connector',
      description: 'Generic API connection and integration',
      enabled: true,
      rateLimit: 200,
      status: 'active'
    }
  ];

  // Mock model capabilities
  const mockModels = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'OpenAI',
      capabilities: ['text', 'conversation'],
      streaming: true,
      status: 'available'
    },
    {
      id: 'claude-3',
      name: 'Claude 3',
      provider: 'Anthropic',
      capabilities: ['text', 'conversation', 'analysis'],
      streaming: true,
      status: 'available'
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'Google',
      capabilities: ['text', 'conversation', 'vision'],
      streaming: false,
      status: 'limited'
    }
  ];

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
        >
          <Tab label="MCP Tools" icon={<Build />} iconPosition="start" />
          <Tab label="Model Capability Registry" icon={<Memory />} iconPosition="start" />
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
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Available MCP Tools ({mockMCPTools.length})
                </Typography>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Tool Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Rate Limit</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Enabled</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mockMCPTools.map((tool) => (
                      <TableRow key={tool.id}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {tool.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{tool.description}</TableCell>
                        <TableCell>{tool.rateLimit}/sec</TableCell>
                        <TableCell>
                          <Chip
                            label={tool.status}
                            color={tool.status === 'active' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={tool.enabled}
                            onChange={(e) => handleMCPToggle(tool.name, e.target.checked)}
                            disabled={toggleMCPMutation.isLoading}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        )}

        {/* Tab B: Model Capability Registry */}
        {currentTab === 1 && (
          <Paper>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Supported Models & Capabilities
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Read-only registry of available AI models and their capabilities
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                {mockModels.map((model) => (
                  <Grid item xs={12} md={6} lg={4} key={model.id}>
                    <Card variant="outlined">
                      <CardHeader
                        title={model.name}
                        subheader={model.provider}
                        action={
                          <Chip
                            label={model.status}
                            color={model.status === 'available' ? 'success' : 'warning'}
                            size="small"
                          />
                        }
                      />
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Capabilities:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                          {model.capabilities.map((cap) => (
                            <Chip
                              key={cap}
                              label={cap}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Streaming: {model.streaming ? 'Supported' : 'Not supported'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Paper>
        )}

        {/* Tab C: General Settings */}
        {currentTab === 2 && (
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