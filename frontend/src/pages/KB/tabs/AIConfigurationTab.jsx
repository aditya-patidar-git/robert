import React from 'react';
import { Box, Paper, Typography, TextField, Button, Alert, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip, Card, CardContent, Slider, FormControlLabel, Switch } from '@mui/material';
import { Controller } from 'react-hook-form';
import { Refresh, Visibility, Edit, ArrowForward, Save, Undo, DeleteSweep } from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';
import ModelVoiceSelection from '../../../components/config/ModelVoiceSelection';
import ModelParameters from '../../../components/config/ModelParameters';
import ModelCapabilityRegistry from '../../../components/config/ModelCapabilityRegistry';
import TokenManagementStats from '../components/TokenManagementStats';
import { useQueryClient } from '@tanstack/react-query';

const AIConfigurationTab = ({ state, handlers }) => {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    watch,
    currentVersion,
    promptVersions,
    versionsLoading,
    refetchVersions,
    flowOverrides,
    flowOverridesLoading,
    refetchFlowOverrides,
    editingFlowType,
    editingFlowParams,
    setEditingFlowType,
    setEditingFlowParams,
    flowDetectionTest,
    setFlowDetectionTest,
    fallbackChain,
    setFallbackChain
  } = state;

  const {
    handleSavePrompt,
    handleCancelConfig,
    handleViewVersion,
    handleCompareVersions,
    handleEditVersion,
    handleRollbackClick,
    handleClearAllVersions,
    handleSaveFlowOverride,
    handleTestFlowDetection
  } = handlers;

  return (
    <form onSubmit={handleSubmit(handleSavePrompt)}>
      <Box>
        {/* Global Prompt Editor */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Global System Prompt for "Robert"
            </Typography>
            {currentVersion && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={`Version ${currentVersion.version}`} 
                  color="primary" 
                  size="small"
                  variant="outlined"
                />
                <Typography variant="caption" color="text.secondary">
                  Last modified by {currentVersion.createdBy} on {formatDateTime(currentVersion.createdAt)}
                </Typography>
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure the global system prompt that defines Robert's behavior, personality, and capabilities.
          </Typography>
          <Controller
            name="globalPrompt"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                multiline
                rows={8}
                fullWidth
                placeholder="Enter the global AI prompt for Robert..."
                sx={{ mb: 2 }}
              />
            )}
          />
        </Paper>

        {/* Prompt Version History - Simplified for now */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Prompt Version History
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DeleteSweep />}
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all inactive versions? This action cannot be undone.')) {
                    handleClearAllVersions();
                  }
                }}
                disabled={versionsLoading || promptVersions.filter(v => !v.isActive).length === 0}
              >
                Clear All
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
                onClick={() => refetchVersions()}
                disabled={versionsLoading}
              >
                Refresh
              </Button>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            View all versions of the global prompt, compare changes, and rollback to previous versions if needed.
          </Typography>

          {versionsLoading ? (
            <LinearProgress sx={{ mb: 2 }} />
          ) : promptVersions.length === 0 ? (
            <Alert severity="info">
              No version history found. Versions will be created automatically when you save changes to the prompt.
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Version</strong></TableCell>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Author</strong></TableCell>
                    <TableCell><strong>Change Reason</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {promptVersions.map((version) => (
                    <TableRow 
                      key={version._id}
                      sx={{
                        bgcolor: version.isActive ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={version.isActive ? "bold" : "medium"}>
                            v{version.version}
                          </Typography>
                          {version.isActive && (
                            <Chip label="Active" size="small" color="primary" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateTime(version.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {version.createdByName || version.createdBy || 'admin'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {version.changeReason || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title="View full version">
                            <IconButton
                              size="small"
                              onClick={() => handleViewVersion(version)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit and activate this version">
                            <IconButton
                              size="small"
                              onClick={() => handleEditVersion(version)}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {!version.isActive && (
                            <Tooltip title="Rollback to this version">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => handleRollbackClick(version)}
                              >
                                <ArrowForward fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Token Management & Context Limits */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Token Management & Context Limits
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monitor token usage, context limits, and truncation statistics. The system automatically manages context to stay within model limits.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => {
                queryClient.invalidateQueries(['token-stats']);
              }}
            >
              Refresh
            </Button>
          </Box>
          <TokenManagementStats />
        </Paper>

        {/* Model & Voice Selection with Fallback Chain */}
        <ModelVoiceSelection 
          control={control}
          watch={watch}
          fallbackChain={fallbackChain}
          setFallbackChain={setFallbackChain}
          showFallbackChain={true}
          showDefaultVoice={false}
        />

        {/* AI Parameters */}
        <ModelParameters control={control} watch={watch} modelId={watch('selectedModel')} />

        {/* Uncertainty Gate Configuration */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Uncertainty Gate Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure confidence thresholds and uncertainty handling for knowledge base responses.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
            <Box>
              <FormControlLabel
                control={
                  <Controller
                    name="uncertaintyGateEnabled"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        {...field}
                        checked={field.value ?? true}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    )}
                  />
                }
                label="Enable Uncertainty Gate"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                When enabled, the system will validate knowledge base responses against confidence thresholds.
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Confidence Threshold: {watch('uncertaintyGateThreshold')}
              </Typography>
              <Controller
                name="uncertaintyGateThreshold"
                control={control}
                render={({ field }) => (
                  <>
                    <Slider
                      {...field}
                      value={field.value ?? 0.8}
                      min={0}
                      max={1}
                      step={0.1}
                      marks
                      valueLabelDisplay="auto"
                    />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Minimum confidence score required for knowledge base responses (0.0 - 1.0)
                    </Typography>
                  </>
                )}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Minimum Sources: {watch('uncertaintyGateMinSources')}
              </Typography>
              <Controller
                name="uncertaintyGateMinSources"
                control={control}
                render={({ field }) => (
                  <>
                    <Slider
                      {...field}
                      value={field.value ?? 1}
                      min={1}
                      max={10}
                      step={1}
                      marks
                      valueLabelDisplay="auto"
                    />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Minimum number of knowledge base sources required for a valid response
                    </Typography>
                  </>
                )}
              />
            </Box>
          </Box>
        </Paper>

        {/* Model Capability Registry */}
        <ModelCapabilityRegistry 
          mode="simplified" 
          selectedModelId={watch('selectedModel')} 
          fallbackChain={fallbackChain} 
        />

        {/* Unified Save/Cancel Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4, mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Undo />}
            onClick={handleCancelConfig}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
          >
            Save Config
          </Button>
        </Box>
      </Box>
    </form>
  );
};

export default AIConfigurationTab;



