import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Add,
  Delete,
  DragIndicator,
  ArrowForward
} from '@mui/icons-material';
import { Controller, useFormContext } from 'react-hook-form';
import { useToast } from '../common/ToastProvider';
import aiService from '../../services/aiService';
import voiceService from '../../services/voiceService';

const ModelVoiceSelection = ({ 
  control,
  watch,
  fallbackChain = [],
  setFallbackChain,
  showFallbackChain = true,
  showDefaultVoice = true,
  onSave = null
}) => {
  const { showSuccess, showError } = useToast();

  // DnD sensors for fallback chain
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch available models
  const { data: models = [] } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => aiService.getModels()
  });

  // Fetch available voices
  const { data: voicesData } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices()
  });

  const availableModels = Array.isArray(models) ? models : [];
  const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);
  
  // Filter to only show voice-based (speech-to-speech) models
  const voiceBasedModels = availableModels.filter(model => {
    // Check if model supports realtime (speech-to-speech)
    return model.supportsRealtime === true || 
           model.capabilities?.realtime === true ||
           (model.id && (model.id.includes('realtime') || model.id.includes('gpt-realtime')));
  });

  // Get compatible voices for the selected model
  const getCompatibleVoices = useCallback((modelId) => {
    if (!modelId || !Array.isArray(voices) || !Array.isArray(voiceBasedModels)) {
      return voices || [];
    }

    // Find the selected model
    const selectedModel = voiceBasedModels.find(m => m.id === modelId);
    if (!selectedModel) {
      return voices || [];
    }

    // Check model capabilities
    const modelSupportsRealtime = selectedModel.capabilities?.realtime || 
                                   modelId.includes('realtime') || 
                                   modelId.includes('gpt-realtime');
    
    const modelSupportsTTS = modelId.includes('tts') || 
                             modelId.includes('tts-1');
    
    const modelSupportsAudio = selectedModel.capabilities?.audio || 
                               modelSupportsRealtime || 
                               modelSupportsTTS ||
                               modelId.includes('whisper');

    // Filter voices based on model type
    if (modelSupportsRealtime) {
      // Realtime models: show only voices with realtime capability
      return voices.filter(voice => voice.capabilities?.realtime === true);
    } else if (modelSupportsTTS) {
      // TTS models: show all voices (TTS models generally support all voices)
      return voices;
    } else if (modelSupportsAudio) {
      // Other audio models: show all voices
      return voices;
    } else {
      // Non-audio models: no voices available
      return [];
    }
  }, [voices, voiceBasedModels]);

  // Fallback chain handlers
  const handleDragEnd = (event) => {
    if (!setFallbackChain) return;
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setFallbackChain((items) => {
        const oldIndex = items.findIndex(item => {
          const itemId = typeof item === 'string' ? item : item.modelId;
          return itemId === active.id;
        });
        const newIndex = items.findIndex(item => {
          const itemId = typeof item === 'string' ? item : item.modelId;
          return itemId === over.id;
        });
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemoveFromFallbackChain = (index) => {
    if (!setFallbackChain) return;
    const newChain = fallbackChain.filter((_, i) => i !== index);
    setFallbackChain(newChain);
  };

  // Save model/voice selection and add model to fallback chain (UI only)
  const handleSaveModelVoice = () => {
    const selectedModel = watch('selectedModel');
    const selectedVoice = watch('selectedVoice');

    // Check that both model and voice are selected
    if (!selectedModel || !selectedVoice) {
      showError('Please select both a model and a voice');
      return;
    }

    if (!setFallbackChain) {
      if (onSave) {
        onSave({ selectedModel, selectedVoice });
      }
      return;
    }

    // Check if the exact model+voice combination already exists in fallback chain
    const exists = fallbackChain.some(item => {
      const itemModelId = typeof item === 'string' ? item : item.modelId;
      const itemVoiceId = typeof item === 'string' ? undefined : item.voiceId;
      return itemModelId === selectedModel && itemVoiceId === selectedVoice;
    });

    if (exists) {
      showError('This model and voice combination is already in the fallback chain');
      return;
    }

    // Add selected model+voice to the END of fallback chain
    setFallbackChain([...fallbackChain, { modelId: selectedModel, voiceId: selectedVoice }]);
    showSuccess('Model and voice added to fallback chain');
  };

  // Sortable item component for fallback chain
  const SortableItem = ({ id, index }) => {
    const chainItem = fallbackChain[index];
    const modelId = typeof chainItem === 'string' ? chainItem : chainItem?.modelId || id;
    const voiceId = typeof chainItem === 'string' ? undefined : chainItem?.voiceId;
    
    // Use voiceBasedModels first, fallback to availableModels for existing chain items
    const model = voiceBasedModels.find(m => m.id === modelId) || availableModels.find(m => m.id === modelId);
    const voice = voices.find(v => v.id === voiceId);
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({ id: modelId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1
    };

    return (
      <Paper
        ref={setNodeRef}
        style={style}
        sx={{
          p: 2,
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: isDragging ? 'action.selected' : 'background.paper',
          border: index === 0 ? '2px solid' : '1px solid',
          borderColor: index === 0 ? 'primary.main' : 'divider',
          boxShadow: isDragging ? 3 : 1
        }}
      >
        <Box
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
        >
          <DragIndicator color="action" />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body2" fontWeight={index === 0 ? 'bold' : 'medium'}>
            {model?.name || modelId}
          </Typography>
          {voice && (
            <Typography variant="caption" color="text.secondary">
              Voice: {voice.name}
            </Typography>
          )}
        </Box>
        <Chip 
          label={index === 0 ? 'Primary' : `Fallback ${index}`} 
          size="small" 
          color={index === 0 ? 'primary' : 'default'}
        />
        <IconButton
          size="small"
          color="error"
          onClick={() => handleRemoveFromFallbackChain(index)}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Paper>
    );
  };

  if (!control) {
    return null;
  }

  return (
    <Box>
      {/* Primary Model Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Primary Model Selection
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the primary AI model and voice. The system will use this model for all calls unless it fails.
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 3, mb: 3, alignItems: 'center' }}>
          <Controller
            name="selectedModel"
            control={control}
            render={({ field }) => (
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Primary AI Model</InputLabel>
                <Select {...field} label="Primary AI Model">
                  {voiceBasedModels.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name || model.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />

          <Controller
            name="selectedVoice"
            control={control}
            render={({ field }) => {
              const selectedModel = watch('selectedModel');
              const compatibleVoices = getCompatibleVoices(selectedModel);
              
              return (
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Voice</InputLabel>
                  <Select 
                    {...field} 
                    label="Voice"
                    disabled={!selectedModel}
                  >
                    {compatibleVoices.length > 0 ? (
                      compatibleVoices.map((voice) => (
                        <MenuItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        {selectedModel ? 'No compatible voices available' : 'Select a model first'}
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
              );
            }}
          />
        </Box>
      </Paper>

      {/* Default Voice Selection */}
      {showDefaultVoice && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Default Voice Selection
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the default voice to use when no specific voice is configured.
          </Typography>
          <Box sx={{ maxWidth: 400 }}>
            <Controller
              name="defaultVoice"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Default Voice</InputLabel>
                  <Select
                    {...field}
                    label="Default Voice"
                    value={field.value?.id || ''}
                    onChange={(e) => {
                      const selectedVoice = voices.find(v => v.id === e.target.value);
                      if (selectedVoice) {
                        field.onChange({
                          id: selectedVoice.id,
                          name: selectedVoice.name,
                          language: selectedVoice.language || 'en-GB'
                        });
                      }
                    }}
                  >
                    {voices.map((voice) => (
                      <MenuItem key={voice.id} value={voice.id}>
                        {voice.name} ({voice.language || 'N/A'})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </Box>
        </Paper>
      )}

      {/* Fallback Chain Configuration */}
      {showFallbackChain && setFallbackChain && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Model Fallback Chain
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure the order of models to use if the primary model is unavailable. Models are tried in sequence from top to bottom.
          </Typography>

          {fallbackChain.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              No fallback chain configured. Add models below to create a fallback sequence.
            </Alert>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fallbackChain.map(item => typeof item === 'string' ? item : item.modelId)}
                strategy={verticalListSortingStrategy}
              >
                <Box sx={{ mb: 2 }}>
                  {fallbackChain.map((item, index) => {
                    const modelId = typeof item === 'string' ? item : item.modelId;
                    return <SortableItem key={`${modelId}-${index}`} id={modelId} index={index} />;
                  })}
                </Box>
              </SortableContext>
            </DndContext>
          )}

          {/* Visual Chain Representation */}
          {fallbackChain.length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Fallback Sequence:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {fallbackChain.map((item, index) => {
                  const modelId = typeof item === 'string' ? item : item.modelId;
                  const voiceId = typeof item === 'string' ? undefined : item.voiceId;
                  // Use voiceBasedModels first, fallback to availableModels for existing chain items
                  const model = voiceBasedModels.find(m => m.id === modelId) || availableModels.find(m => m.id === modelId);
                  const voice = voices.find(v => v.id === voiceId);
                  const label = model?.name || modelId;
                  const voiceLabel = voice ? ` (${voice.name})` : '';
                  
                  const tooltipContent = model ? (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                        {model.name}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Context: {model.contextLimit || model.context_limit || 'N/A'} tokens
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                        Capabilities: {[
                          model.supportsTools && 'Tools',
                          model.supportsAudio && 'Audio',
                          model.capabilities?.fileSearch && 'File Search',
                          model.capabilities?.realtime && 'Realtime'
                        ].filter(Boolean).join(', ') || 'None'}
                      </Typography>
                      {model.rateLimits && (
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                          Rate: {model.rateLimits.requestsPerMinute} req/min, {model.rateLimits.tokensPerMinute?.toLocaleString() || 'N/A'} tokens/min
                        </Typography>
                      )}
                    </Box>
                  ) : `Model: ${modelId}`;
                  
                  return (
                    <React.Fragment key={`${modelId}-${index}`}>
                      <Tooltip title={tooltipContent} arrow placement="top">
                        <Chip
                          label={label + voiceLabel}
                          size="small"
                          color={index === 0 ? 'primary' : 'default'}
                          sx={{
                            cursor: 'help',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                        />
                      </Tooltip>
                      {index < fallbackChain.length - 1 && (
                        <ArrowForward fontSize="small" color="action" />
                      )}
                    </React.Fragment>
                  );
                })}
              </Box>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default ModelVoiceSelection;

