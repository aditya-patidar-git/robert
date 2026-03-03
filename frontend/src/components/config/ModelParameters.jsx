import React, { useState, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  Box,
  Paper,
  Typography,
  Slider,
  Alert,
  Grid
} from '@mui/material';
import aiService from '../../services/aiService';

const ModelParameters = ({ 
  control,
  watch,
  modelId = null,
  readOnly = false
}) => {
  const [modelParameters, setModelParameters] = useState(null);
  const selectedModel = modelId || watch('selectedModel');

  // Fetch model parameters when model selection changes
  useEffect(() => {
    if (selectedModel) {
      aiService.getModelParameters(selectedModel)
        .then(params => setModelParameters(params))
        .catch(err => {
          console.error('Error fetching model parameters:', err);
          setModelParameters(null); // Fallback to defaults
        });
    } else {
      setModelParameters(null);
    }
  }, [modelId, selectedModel]);

  if (!control) {
    return null;
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        AI Parameters
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure AI behavior parameters including temperature, top_p, max tokens, and speech rate.
      </Typography>
      {modelParameters && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Model-specific parameter ranges loaded. Context limit: {modelParameters.context_limit?.toLocaleString() || 'N/A'} tokens.
        </Alert>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, alignItems: 'flex-start' }}>
        <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle2" gutterBottom>
            Temperature: {watch('temperature')}
            {modelParameters?.temperature?.default && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Recommended: {modelParameters.temperature.default}
              </Typography>
            )}
          </Typography>
          <Controller
            name="temperature"
            control={control}
            render={({ field }) => {
              const tempParams = modelParameters?.temperature || { min: 0, max: 1, step: 0.1 };
              return (
                <Box sx={{ mt: 1 }}>
                  <Slider
                    {...field}
                    min={tempParams.min}
                    max={tempParams.max}
                    step={tempParams.step || 0.1}
                    marks={[
                      { value: tempParams.min, label: tempParams.min.toString() },
                      { value: tempParams.max, label: tempParams.max.toString() }
                    ]}
                    valueLabelDisplay="auto"
                    disabled={readOnly}
                  />
                  {modelParameters?.temperature && (field.value < modelParameters.temperature.min || field.value > modelParameters.temperature.max) && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Value outside recommended range ({modelParameters.temperature.min} - {modelParameters.temperature.max})
                    </Alert>
                  )}
                </Box>
              );
            }}
          />
        </Box>

        <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle2" gutterBottom>
            Top-P: {watch('topP')}
            {modelParameters?.top_p?.default && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Recommended: {modelParameters.top_p.default}
              </Typography>
            )}
          </Typography>
          <Controller
            name="topP"
            control={control}
            render={({ field }) => {
              const topPParams = modelParameters?.top_p || { min: 0, max: 1, step: 0.1 };
              return (
                <Box sx={{ mt: 1 }}>
                  <Slider
                    {...field}
                    min={topPParams.min}
                    max={topPParams.max}
                    step={topPParams.step || 0.1}
                    marks={[
                      { value: topPParams.min, label: topPParams.min.toString() },
                      { value: topPParams.max, label: topPParams.max.toString() }
                    ]}
                    valueLabelDisplay="auto"
                    disabled={readOnly}
                  />
                  {modelParameters?.top_p && (field.value < modelParameters.top_p.min || field.value > modelParameters.top_p.max) && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Value outside recommended range ({modelParameters.top_p.min} - {modelParameters.top_p.max})
                    </Alert>
                  )}
                </Box>
              );
            }}
          />
        </Box>

        <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle2" gutterBottom>
            Max Tokens: {watch('maxTokens')}
            {modelParameters?.max_tokens?.default && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Recommended: {modelParameters.max_tokens.default} (Max: {modelParameters.max_tokens.max?.toLocaleString() || 'N/A'})
              </Typography>
            )}
          </Typography>
          <Controller
            name="maxTokens"
            control={control}
            render={({ field }) => {
              const maxTokensParams = modelParameters?.max_tokens || { min: 50, max: 500, step: 10 };
              const maxValue = Math.min(maxTokensParams.max, 5000);
              return (
                <Box sx={{ mt: 1 }}>
                  <Slider
                    {...field}
                    value={field.value || maxTokensParams.default || 150}
                    min={maxTokensParams.min}
                    max={maxValue}
                    step={maxTokensParams.step || 10}
                    marks={[
                      { value: maxTokensParams.min, label: maxTokensParams.min.toString() },
                      { value: maxValue, label: maxValue.toString() }
                    ]}
                    valueLabelDisplay="auto"
                    disabled={readOnly}
                  />
                  {modelParameters?.max_tokens && field.value > modelParameters.max_tokens.max && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Value exceeds model's maximum of {modelParameters.max_tokens.max.toLocaleString()} tokens
                    </Alert>
                  )}
                </Box>
              );
            }}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default ModelParameters;

