import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Refresh,
  Visibility
} from '@mui/icons-material';
import aiService from '../../services/aiService';

const ModelCapabilityRegistry = ({ 
  mode = 'full', // 'full' | 'simplified'
  selectedModelId = null, // For simplified mode - primary model ID
  fallbackChain = [], // For simplified mode - array of model IDs or objects with modelId
  onModelSelect = null // Optional callback when model is selected
}) => {
  const queryClient = useQueryClient();

  // Fetch available models
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

  const handleRefresh = () => {
    queryClient.invalidateQueries(['model-capabilities']);
    queryClient.invalidateQueries(['ai-models']);
  };

  if (capabilitiesLoading || modelsLoading) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
      </Paper>
    );
  }

  const allCapabilities = capabilitiesData?.capabilities || [];
  const allModels = models || [];

  // Combine models and capabilities
  let modelsWithCapabilities = allModels.map(model => {
    const capabilities = allCapabilities.find(cap => cap.id === model.id);
    return {
      ...model,
      ...capabilities
    };
  });

  // For simplified mode, filter to only show active models
  if (mode === 'simplified' && selectedModelId) {
    const fallbackModelIds = fallbackChain.map(item => 
      typeof item === 'string' ? item : (item?.modelId || item)
    ).filter(id => id && id !== selectedModelId);
    
    modelsWithCapabilities = modelsWithCapabilities.filter(model => 
      model.id === selectedModelId || fallbackModelIds.includes(model.id)
    );
  }

  if (modelsWithCapabilities.length === 0) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Alert severity="info">
          {mode === 'simplified' 
            ? 'No active models selected. Please select a primary model in the Model Selection section above.'
            : 'No models found. Models will be discovered on system startup.'}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          {mode === 'full' ? 'Model Capability Registry' : 'Active Model Capabilities'}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={capabilitiesLoading || modelsLoading}
        >
          Refresh
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {mode === 'full' 
          ? 'Dynamic registry of available AI models discovered from OpenAI API. Auto-refreshes every 5 minutes.'
          : 'View capabilities for your primary model and fallback chain models.'}
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Model Name</strong></TableCell>
              <TableCell align="right"><strong>Context Limit</strong></TableCell>
              <TableCell align="center"><strong>Tools</strong></TableCell>
              <TableCell align="center"><strong>Audio</strong></TableCell>
              {mode === 'full' && (
                <TableCell align="center"><strong>Realtime</strong></TableCell>
              )}
              <TableCell align="center"><strong>File Search</strong></TableCell>
              <TableCell align="center"><strong>Details</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {modelsWithCapabilities.map((model, index) => {
              const isPrimary = mode === 'simplified' && model.id === selectedModelId;
              return (
                <TableRow 
                  key={model.id}
                  sx={{ 
                    bgcolor: isPrimary ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={isPrimary ? "bold" : "medium"}>
                        {model.name || model.id}
                      </Typography>
                      {isPrimary && (
                        <Chip 
                          label="Primary" 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {mode === 'simplified' && !isPrimary && index === 1 && (
                        <Chip 
                          label="Fallback" 
                          size="small" 
                          color="default"
                          variant="outlined"
                        />
                      )}
                      {mode === 'full' && model.capabilities?.realtime && (
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
                  {mode === 'full' && (
                    <TableCell align="center">
                      <Chip 
                        label={model.capabilities?.realtime ? 'Yes' : 'No'} 
                        color={model.capabilities?.realtime ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                  )}
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
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ModelCapabilityRegistry;

