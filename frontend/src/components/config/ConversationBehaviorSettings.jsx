import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  FormControlLabel,
  Switch,
  TextField,
  Card,
  CardContent,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Chip
} from '@mui/material';
import {
  Add,
  Delete,
  Info
} from '@mui/icons-material';
import ConfirmSaveDialog from '../common/ConfirmSaveDialog';
import { AGENT_AFFECTING_WARNINGS } from '../../constants/agentAffectingWarnings';

const ConversationBehaviorSettings = ({ 
  config,
  onUpdate,
  isLoading = false
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState(config || {
    progressIndicators: {
      enabled: true,
      acknowledgmentThresholdMs: 2000,
      updateIntervalMs: 5000,
      acknowledgmentMessages: ["Let me check that for you.", "I'm looking into that now.", "Just a moment, please."],
      updateMessages: ["This is taking a bit longer than usual, please hold on.", "I'm still working on that, just a moment.", "Almost there, please bear with me."]
    },
    silenceDetection: {
      enabled: true,
      silenceThresholdMs: 15000,
      proactiveMessages: ["Are you still there?", "Is there anything else I can help you with?", "Would you like me to continue?"],
      maxProactiveAttempts: 2
    },
    conversationFlow: {
      userSpeakingWindowMs: 6000,
      adaptivePacing: true,
      adaptationWindowSize: 5,
      minAdaptiveWindowMs: 3000,
      maxAdaptiveWindowMs: 15000,
      minResponseDelayMs: 300,
      maxResponseDelayMs: 2000,
      speechContinuation: {
        enabled: true,
        gracePeriodMs: 1500,
        pauseDetectionMs: 800,
        maxGracePeriodExtensions: 2
      }
    },
    errorHandling: {
      retryEnabled: true,
      maxRetries: 2,
      retryBackoffMs: 1000,
      userFriendlyErrorMessages: true
    },
    qualityMetrics: {
      enabled: true,
      trackLatency: true,
      trackInterruptions: true,
      trackToolSuccess: true
    },
    proactiveAssistance: {
      enabled: true,
      hesitationThresholdMs: 3000,
      enableFollowUpSuggestions: true,
      suggestionDelayMs: 2000
    }
  });

  // Update local config when prop changes
  React.useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleChange = (path, value) => {
    const keys = path.split('.');
    setLocalConfig(prev => {
      const newConfig = { ...prev };
      let current = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const handleArrayAdd = (path, defaultValue = '') => {
    const keys = path.split('.');
    setLocalConfig(prev => {
      const newConfig = { ...prev };
      let current = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      const array = current[keys[keys.length - 1]] || [];
      current[keys[keys.length - 1]] = [...array, defaultValue];
      return newConfig;
    });
  };

  const handleArrayRemove = (path, index) => {
    const keys = path.split('.');
    setLocalConfig(prev => {
      const newConfig = { ...prev };
      let current = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      const array = current[keys[keys.length - 1]] || [];
      current[keys[keys.length - 1]] = array.filter((_, i) => i !== index);
      return newConfig;
    });
  };

  const handleArrayChange = (path, index, value) => {
    const keys = path.split('.');
    setLocalConfig(prev => {
      const newConfig = { ...prev };
      let current = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      const array = [...(current[keys[keys.length - 1]] || [])];
      array[index] = value;
      current[keys[keys.length - 1]] = array;
      return newConfig;
    });
  };

  const handleSave = () => {
    if (onUpdate) {
      setConfirmOpen(true);
    }
  };

  const handleConfirmSave = () => {
    if (onUpdate) {
      return onUpdate(localConfig);
    }
  };

  return (
    <Box>
      {/* Progress Indicators Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Progress Indicators</Typography>
          <Tooltip title="Provide feedback to callers during long-running tool operations">
            <IconButton size="small" sx={{ ml: 1 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure how the agent provides feedback during tool execution
        </Typography>

        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.progressIndicators?.enabled ?? true}
                onChange={(e) => handleChange('progressIndicators.enabled', e.target.checked)}
                disabled={isLoading}
              />
            }
            label="Enable Progress Indicators"
          />

          {localConfig.progressIndicators?.enabled && (
            <>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Acknowledgment Threshold: {localConfig.progressIndicators.acknowledgmentThresholdMs}ms
                </Typography>
                <Slider
                  value={localConfig.progressIndicators.acknowledgmentThresholdMs || 2000}
                  onChange={(e, value) => handleChange('progressIndicators.acknowledgmentThresholdMs', value)}
                  min={0}
                  max={10000}
                  step={500}
                  marks={[
                    { value: 0, label: '0ms' },
                    { value: 2000, label: '2s' },
                    { value: 5000, label: '5s' },
                    { value: 10000, label: '10s' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Send acknowledgment message after this delay
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Update Interval: {localConfig.progressIndicators.updateIntervalMs}ms
                </Typography>
                <Slider
                  value={localConfig.progressIndicators.updateIntervalMs || 5000}
                  onChange={(e, value) => handleChange('progressIndicators.updateIntervalMs', value)}
                  min={1000}
                  max={30000}
                  step={1000}
                  marks={[
                    { value: 1000, label: '1s' },
                    { value: 5000, label: '5s' },
                    { value: 10000, label: '10s' },
                    { value: 30000, label: '30s' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Send periodic updates every N milliseconds
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">Acknowledgment Messages</Typography>
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => handleArrayAdd('progressIndicators.acknowledgmentMessages', '')}
                    disabled={isLoading}
                  >
                    Add
                  </Button>
                </Box>
                {(localConfig.progressIndicators.acknowledgmentMessages || []).map((msg, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={msg}
                      onChange={(e) => handleArrayChange('progressIndicators.acknowledgmentMessages', index, e.target.value)}
                      disabled={isLoading}
                    />
                    <IconButton
                      onClick={() => handleArrayRemove('progressIndicators.acknowledgmentMessages', index)}
                      disabled={isLoading}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">Update Messages</Typography>
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => handleArrayAdd('progressIndicators.updateMessages', '')}
                    disabled={isLoading}
                  >
                    Add
                  </Button>
                </Box>
                {(localConfig.progressIndicators.updateMessages || []).map((msg, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={msg}
                      onChange={(e) => handleArrayChange('progressIndicators.updateMessages', index, e.target.value)}
                      disabled={isLoading}
                    />
                    <IconButton
                      onClick={() => handleArrayRemove('progressIndicators.updateMessages', index)}
                      disabled={isLoading}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Stack>
      </Paper>

      {/* Silence Detection Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Silence Detection</Typography>
          <Tooltip title="Proactively engage callers during extended silence periods">
            <IconButton size="small" sx={{ ml: 1 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure proactive engagement when callers are silent
        </Typography>

        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.silenceDetection?.enabled ?? true}
                onChange={(e) => handleChange('silenceDetection.enabled', e.target.checked)}
                disabled={isLoading}
              />
            }
            label="Enable Silence Detection"
          />

          {localConfig.silenceDetection?.enabled && (
            <>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Silence Threshold: {localConfig.silenceDetection.silenceThresholdMs}ms
                </Typography>
                <Slider
                  value={localConfig.silenceDetection.silenceThresholdMs || 15000}
                  onChange={(e, value) => handleChange('silenceDetection.silenceThresholdMs', value)}
                  min={5000}
                  max={60000}
                  step={1000}
                  marks={[
                    { value: 5000, label: '5s' },
                    { value: 15000, label: '15s' },
                    { value: 30000, label: '30s' },
                    { value: 60000, label: '60s' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Trigger proactive message after this silence duration
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Max Proactive Attempts: {localConfig.silenceDetection.maxProactiveAttempts}
                </Typography>
                <Slider
                  value={localConfig.silenceDetection.maxProactiveAttempts || 2}
                  onChange={(e, value) => handleChange('silenceDetection.maxProactiveAttempts', value)}
                  min={0}
                  max={5}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Maximum proactive messages per call
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">Proactive Messages</Typography>
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => handleArrayAdd('silenceDetection.proactiveMessages', '')}
                    disabled={isLoading}
                  >
                    Add
                  </Button>
                </Box>
                {(localConfig.silenceDetection.proactiveMessages || []).map((msg, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={msg}
                      onChange={(e) => handleArrayChange('silenceDetection.proactiveMessages', index, e.target.value)}
                      disabled={isLoading}
                    />
                    <IconButton
                      onClick={() => handleArrayRemove('silenceDetection.proactiveMessages', index)}
                      disabled={isLoading}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Stack>
      </Paper>

      {/* Conversation Flow Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Conversation Flow</Typography>
          <Tooltip title="Configure turn-taking and response timing">
            <IconButton size="small" sx={{ ml: 1 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure how the agent manages conversation pacing and turn-taking
        </Typography>

        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              User Speaking Window: {localConfig.conversationFlow?.userSpeakingWindowMs}ms
            </Typography>
            <Slider
              value={localConfig.conversationFlow?.userSpeakingWindowMs || 6000}
              onChange={(e, value) => handleChange('conversationFlow.userSpeakingWindowMs', value)}
              min={1000}
              max={30000}
              step={1000}
              marks={[
                { value: 1000, label: '1s' },
                { value: 6000, label: '6s' },
                { value: 15000, label: '15s' },
                { value: 30000, label: '30s' }
              ]}
              valueLabelDisplay="auto"
              disabled={isLoading}
            />
            <Typography variant="caption" color="text.secondary">
              Time window for user to speak after agent finishes
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={localConfig.conversationFlow?.adaptivePacing ?? true}
                onChange={(e) => handleChange('conversationFlow.adaptivePacing', e.target.checked)}
                disabled={isLoading}
              />
            }
            label="Adaptive Pacing"
          />

          {/* Adaptive Pacing Detail Settings */}
          {localConfig.conversationFlow?.adaptivePacing && (
            <Box sx={{ pl: 3, borderLeft: '2px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Adaptive Pacing Settings
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Adaptation Window Size: {localConfig.conversationFlow?.adaptationWindowSize || 5} turns
                </Typography>
                <Slider
                  value={localConfig.conversationFlow?.adaptationWindowSize || 5}
                  onChange={(e, value) => handleChange('conversationFlow.adaptationWindowSize', value)}
                  min={3}
                  max={20}
                  step={1}
                  marks={[
                    { value: 3, label: '3' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Number of conversation turns to analyze for pacing adaptation
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Min Adaptive Window: {localConfig.conversationFlow?.minAdaptiveWindowMs || 3000}ms
                </Typography>
                <Slider
                  value={localConfig.conversationFlow?.minAdaptiveWindowMs || 3000}
                  onChange={(e, value) => handleChange('conversationFlow.minAdaptiveWindowMs', value)}
                  min={1000}
                  max={10000}
                  step={500}
                  marks={[
                    { value: 1000, label: '1s' },
                    { value: 3000, label: '3s' },
                    { value: 5000, label: '5s' },
                    { value: 10000, label: '10s' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Minimum adaptive speaking window duration
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Max Adaptive Window: {localConfig.conversationFlow?.maxAdaptiveWindowMs || 15000}ms
                </Typography>
                <Slider
                  value={localConfig.conversationFlow?.maxAdaptiveWindowMs || 15000}
                  onChange={(e, value) => handleChange('conversationFlow.maxAdaptiveWindowMs', value)}
                  min={5000}
                  max={30000}
                  step={1000}
                  marks={[
                    { value: 5000, label: '5s' },
                    { value: 15000, label: '15s' },
                    { value: 30000, label: '30s' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Maximum adaptive speaking window duration
                </Typography>
              </Box>
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Min Response Delay: {localConfig.conversationFlow?.minResponseDelayMs}ms
            </Typography>
            <Slider
              value={localConfig.conversationFlow?.minResponseDelayMs || 300}
              onChange={(e, value) => handleChange('conversationFlow.minResponseDelayMs', value)}
              min={0}
              max={2000}
              step={100}
              marks={[
                { value: 0, label: '0ms' },
                { value: 300, label: '300ms' },
                { value: 1000, label: '1s' },
                { value: 2000, label: '2s' }
              ]}
              valueLabelDisplay="auto"
              disabled={isLoading}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Max Response Delay: {localConfig.conversationFlow?.maxResponseDelayMs}ms
            </Typography>
            <Slider
              value={localConfig.conversationFlow?.maxResponseDelayMs || 2000}
              onChange={(e, value) => handleChange('conversationFlow.maxResponseDelayMs', value)}
              min={500}
              max={5000}
              step={100}
              marks={[
                { value: 500, label: '500ms' },
                { value: 2000, label: '2s' },
                { value: 3500, label: '3.5s' },
                { value: 5000, label: '5s' }
              ]}
              valueLabelDisplay="auto"
              disabled={isLoading}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Speech Continuation Settings */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="medium">Speech Continuation</Typography>
              <Tooltip title="Allow brief pauses in user speech without triggering agent response">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Detect natural pauses vs. end of speech to avoid interrupting users mid-thought
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={localConfig.conversationFlow?.speechContinuation?.enabled ?? true}
                  onChange={(e) => handleChange('conversationFlow.speechContinuation.enabled', e.target.checked)}
                  disabled={isLoading}
                />
              }
              label="Enable Speech Continuation"
            />

            {localConfig.conversationFlow?.speechContinuation?.enabled && (
              <Box sx={{ pl: 3, mt: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Grace Period: {localConfig.conversationFlow?.speechContinuation?.gracePeriodMs || 1500}ms
                  </Typography>
                  <Slider
                    value={localConfig.conversationFlow?.speechContinuation?.gracePeriodMs || 1500}
                    onChange={(e, value) => handleChange('conversationFlow.speechContinuation.gracePeriodMs', value)}
                    min={500}
                    max={5000}
                    step={100}
                    marks={[
                      { value: 500, label: '500ms' },
                      { value: 1500, label: '1.5s' },
                      { value: 3000, label: '3s' },
                      { value: 5000, label: '5s' }
                    ]}
                    valueLabelDisplay="auto"
                    disabled={isLoading}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Time to wait for user to continue speaking after a pause
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Pause Detection: {localConfig.conversationFlow?.speechContinuation?.pauseDetectionMs || 800}ms
                  </Typography>
                  <Slider
                    value={localConfig.conversationFlow?.speechContinuation?.pauseDetectionMs || 800}
                    onChange={(e, value) => handleChange('conversationFlow.speechContinuation.pauseDetectionMs', value)}
                    min={300}
                    max={2000}
                    step={100}
                    marks={[
                      { value: 300, label: '300ms' },
                      { value: 800, label: '800ms' },
                      { value: 1500, label: '1.5s' },
                      { value: 2000, label: '2s' }
                    ]}
                    valueLabelDisplay="auto"
                    disabled={isLoading}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Silence duration to consider as a pause (vs. finished speaking)
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Max Grace Extensions: {localConfig.conversationFlow?.speechContinuation?.maxGracePeriodExtensions || 2}
                  </Typography>
                  <Slider
                    value={localConfig.conversationFlow?.speechContinuation?.maxGracePeriodExtensions || 2}
                    onChange={(e, value) => handleChange('conversationFlow.speechContinuation.maxGracePeriodExtensions', value)}
                    min={0}
                    max={5}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    disabled={isLoading}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Maximum number of times to extend grace period for continued speech
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Proactive Assistance Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Proactive Assistance</Typography>
          <Tooltip title="Intelligently offer help based on conversation patterns like hesitation or confusion">
            <IconButton size="small" sx={{ ml: 1 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Analyze conversation patterns to proactively assist callers who may be hesitating or confused
        </Typography>

        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.proactiveAssistance?.enabled ?? true}
                onChange={(e) => handleChange('proactiveAssistance.enabled', e.target.checked)}
                disabled={isLoading}
              />
            }
            label="Enable Proactive Assistance"
          />

          {localConfig.proactiveAssistance?.enabled && (
            <>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Hesitation Threshold: {localConfig.proactiveAssistance?.hesitationThresholdMs || 3000}ms
                </Typography>
                <Slider
                  value={localConfig.proactiveAssistance?.hesitationThresholdMs || 3000}
                  onChange={(e, value) => handleChange('proactiveAssistance.hesitationThresholdMs', value)}
                  min={1000}
                  max={10000}
                  step={500}
                  marks={[
                    { value: 1000, label: '1s' },
                    { value: 3000, label: '3s' },
                    { value: 5000, label: '5s' },
                    { value: 10000, label: '10s' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Duration of hesitation before offering proactive assistance
                </Typography>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.proactiveAssistance?.enableFollowUpSuggestions ?? true}
                    onChange={(e) => handleChange('proactiveAssistance.enableFollowUpSuggestions', e.target.checked)}
                    disabled={isLoading}
                  />
                }
                label="Enable Follow-Up Suggestions"
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Suggestion Delay: {localConfig.proactiveAssistance?.suggestionDelayMs || 2000}ms
                </Typography>
                <Slider
                  value={localConfig.proactiveAssistance?.suggestionDelayMs || 2000}
                  onChange={(e, value) => handleChange('proactiveAssistance.suggestionDelayMs', value)}
                  min={500}
                  max={5000}
                  step={250}
                  marks={[
                    { value: 500, label: '500ms' },
                    { value: 2000, label: '2s' },
                    { value: 3500, label: '3.5s' },
                    { value: 5000, label: '5s' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
                <Typography variant="caption" color="text.secondary">
                  Delay before offering follow-up suggestions based on context
                </Typography>
              </Box>
            </>
          )}
        </Stack>
      </Paper>

      {/* Error Handling Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Error Handling</Typography>
          <Tooltip title="Configure error recovery and user-friendly error messages">
            <IconButton size="small" sx={{ ml: 1 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure how the agent handles and recovers from errors
        </Typography>

        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.errorHandling?.retryEnabled ?? true}
                onChange={(e) => handleChange('errorHandling.retryEnabled', e.target.checked)}
                disabled={isLoading}
              />
            }
            label="Enable Retry"
          />

          {localConfig.errorHandling?.retryEnabled && (
            <>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Max Retries: {localConfig.errorHandling.maxRetries}
                </Typography>
                <Slider
                  value={localConfig.errorHandling.maxRetries || 2}
                  onChange={(e, value) => handleChange('errorHandling.maxRetries', value)}
                  min={0}
                  max={5}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Retry Backoff: {localConfig.errorHandling.retryBackoffMs}ms
                </Typography>
                <Slider
                  value={localConfig.errorHandling.retryBackoffMs || 1000}
                  onChange={(e, value) => handleChange('errorHandling.retryBackoffMs', value)}
                  min={100}
                  max={10000}
                  step={100}
                  marks={[
                    { value: 100, label: '100ms' },
                    { value: 1000, label: '1s' },
                    { value: 5000, label: '5s' },
                    { value: 10000, label: '10s' }
                  ]}
                  valueLabelDisplay="auto"
                  disabled={isLoading}
                />
              </Box>
            </>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={localConfig.errorHandling?.userFriendlyErrorMessages ?? true}
                onChange={(e) => handleChange('errorHandling.userFriendlyErrorMessages', e.target.checked)}
                disabled={isLoading}
              />
            }
            label="User-Friendly Error Messages"
          />
        </Stack>
      </Paper>

      {/* Quality Metrics Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Quality Metrics</Typography>
          <Tooltip title="Track conversation quality metrics for analysis">
            <IconButton size="small" sx={{ ml: 1 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure which metrics to track for conversation quality analysis
        </Typography>

        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.qualityMetrics?.enabled ?? true}
                onChange={(e) => handleChange('qualityMetrics.enabled', e.target.checked)}
                disabled={isLoading}
              />
            }
            label="Enable Quality Metrics"
          />

          {localConfig.qualityMetrics?.enabled && (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.qualityMetrics?.trackLatency ?? true}
                    onChange={(e) => handleChange('qualityMetrics.trackLatency', e.target.checked)}
                    disabled={isLoading}
                  />
                }
                label="Track Response Latency"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.qualityMetrics?.trackInterruptions ?? true}
                    onChange={(e) => handleChange('qualityMetrics.trackInterruptions', e.target.checked)}
                    disabled={isLoading}
                  />
                }
                label="Track Interruptions"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.qualityMetrics?.trackToolSuccess ?? true}
                    onChange={(e) => handleChange('qualityMetrics.trackToolSuccess', e.target.checked)}
                    disabled={isLoading}
                  />
                }
                label="Track Tool Success Rate"
              />
            </>
          )}
        </Stack>
      </Paper>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isLoading}
          size="large"
        >
          Save Configuration
        </Button>
      </Box>

      <ConfirmSaveDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title={AGENT_AFFECTING_WARNINGS.CONVERSATION_BEHAVIOR.title}
        message={AGENT_AFFECTING_WARNINGS.CONVERSATION_BEHAVIOR.message}
        effects={AGENT_AFFECTING_WARNINGS.CONVERSATION_BEHAVIOR.effects}
        confirmLabel="Save"
      />
    </Box>
  );
};

export default ConversationBehaviorSettings;

