import React, { useState, useEffect, useCallback } from 'react';
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
  LinearProgress,
  Tooltip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
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
  Refresh,
  Info,
  Warning,
  CheckCircle,
  DragIndicator,
  ArrowForward,
  Visibility,
  ExpandMore,
  AccessTime,
  Voicemail,
  Router
} from '@mui/icons-material';
import { useToast } from '../../components/common/ToastProvider';
import configService from '../../services/configService';
import telephonyService from '../../services/telephonyService';
import voiceService from '../../services/voiceService';
import aiService from '../../services/aiService';
import languageVoiceService from '../../services/languageVoiceService';

const AudioTelephonyPage = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [addNumberDialog, setAddNumberDialog] = useState(false);
  const [editNumberDialog, setEditNumberDialog] = useState(false);
  const [deleteNumberDialog, setDeleteNumberDialog] = useState(false);
  const [numberToEdit, setNumberToEdit] = useState(null);
  const [numberToDelete, setNumberToDelete] = useState(null);
  const [addTransferNumberDialog, setAddTransferNumberDialog] = useState(false);
  const [editTransferNumberDialog, setEditTransferNumberDialog] = useState(false);
  const [transferNumberToEdit, setTransferNumberToEdit] = useState(null);
  const [voicePreviewDialog, setVoicePreviewDialog] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [modelRanges, setModelRanges] = useState(null);
  const [selectedNumberForProfile, setSelectedNumberForProfile] = useState(null);
  const [numberProfileDialog, setNumberProfileDialog] = useState(false);
  const [fallbackChain, setFallbackChain] = useState([]);
  const [languageMappings, setLanguageMappings] = useState([]);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [callQualityTimeRange, setCallQualityTimeRange] = useState('24h');
  const [callQualityFilter, setCallQualityFilter] = useState('');

  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
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
      defaultVoice: { id: 'ash', name: 'Ash', language: 'en-GB' },
      selectedModelId: null,
      selectedModel: null,
      selectedVoice: null,
      temperature: 0.4,
      topP: 1.0,
      maxTokens: 150,
      speechRate: 1.0,
      usePerNumberProfiles: false,
      outboundCallerId: '+442045726060',
      numbers: [],
      transferNumbers: [],
      afterHoursPolicy: {
        enabled: true,
        startTime: '18:00',
        endTime: '09:00',
        timezone: 'Europe/London',
        message: 'Thank you for calling Universal Motorcycle Training. Our office hours are Monday to Friday, 9 AM to 6 PM. Please call back during business hours or leave a message.',
        action: 'voicemail'
      },
      voicemailSettings: {
        enabled: true,
        greeting: 'Please leave your name, number, and a brief message after the tone.',
        maxDuration: 300,
        emailNotification: true,
        emailRecipients: []
      },
      sipSettings: {
        primaryPath: 'sip',
        fallbackPath: 'media_streams',
        codec: 'opus',
        region: 'europe'
      }
    }
  });

  // DnD sensors for fallback chain
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        setValue('noiseSuppressionAlgorithm', config.noiseSuppressionAlgorithm || 'basic');
        setValue('echoCancellation', config.echoCancellation);
        setValue('automaticGainControl', config.automaticGainControl || false);
        setValue('audioQuality', config.audioQuality);
        setValue('energyThreshold', config.energyThreshold);
        setValue('energyThresholdAutoCalibrate', config.energyThresholdAutoCalibrate !== undefined ? config.energyThresholdAutoCalibrate : true);
        setValue('defaultVoice', config.defaultVoice);
        setValue('selectedModelId', config.selectedModelId);
        setValue('temperature', config.temperature);
        setValue('topP', config.topP);
        setValue('maxTokens', config.maxTokens);
        setValue('speechRate', config.speechRate);
        setValue('usePerNumberProfiles', config.usePerNumberProfiles || false);
        
        // Load model ranges if model is selected
        if (config.selectedModelId) {
          loadModelRanges(config.selectedModelId);
        }
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
        setValue('outboundCallerId', config.outboundCallerId || '+442045726060');
        setValue('transferNumbers', config.transferNumbers || []);
        setValue('afterHoursPolicy', config.afterHoursPolicy || {
          enabled: true,
          startTime: '18:00',
          endTime: '09:00',
          timezone: 'Europe/London',
          message: 'Thank you for calling Universal Motorcycle Training. Our office hours are Monday to Friday, 9 AM to 6 PM. Please call back during business hours or leave a message.',
          action: 'voicemail'
        });
        setValue('voicemailSettings', config.voicemailSettings || {
          enabled: true,
          greeting: 'Please leave your name, number, and a brief message after the tone.',
          maxDuration: 300,
          emailNotification: true,
          emailRecipients: []
        });
        setValue('sipSettings', config.sipSettings || {
          primaryPath: 'sip',
          fallbackPath: 'media_streams',
          codec: 'opus',
          region: 'europe'
        });
      }
    }
  });

  // Fetch available voices
  const { data: voicesData, isLoading: voicesLoading } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices(),
    onSuccess: (data) => {
      // Handle both old and new response structures
      const voices = Array.isArray(data) ? data : (data?.voices || []);
      if (voices.length > 0) {
        const defaultVoice = voices.find(v => v.isDefault) || voices[0];
        setSelectedVoice(defaultVoice);
      }
    }
  });

  // Fetch audio metrics
  const { 
    data: audioMetrics, 
    isLoading: audioMetricsLoading, 
    error: audioMetricsError,
    refetch: refetchAudioMetrics
  } = useQuery({
    queryKey: ['audio-metrics', callQualityTimeRange],
    queryFn: () => configService.getAudioMetrics(callQualityTimeRange),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch historical audio metrics for charts
  const { 
    data: historicalMetrics, 
    isLoading: historicalLoading 
  } = useQuery({
    queryKey: ['historical-audio-metrics', callQualityTimeRange],
    queryFn: () => configService.getHistoricalAudioMetrics(callQualityTimeRange, 20),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch recent calls with quality metrics
  const { 
    data: recentCallsData, 
    isLoading: recentCallsLoading 
  } = useQuery({
    queryKey: ['recent-calls-quality', callQualityFilter],
    queryFn: () => configService.getRecentCallsWithQuality(50, callQualityFilter || null),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch available models
  const { data: availableModels } = useQuery({
    queryKey: ['available-models'],
    queryFn: () => aiService.getModels(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Fetch language/voice mappings
  const { data: fetchedMappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['language-voice-mappings'],
    queryFn: languageVoiceService.getLanguageMappings
  });

  // Fetch model capabilities
  const { data: capabilitiesData, isLoading: capabilitiesLoading } = useQuery({
    queryKey: ['model-capabilities'],
    queryFn: aiService.getModelCapabilities,
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  // Load model parameter ranges
  const loadModelRanges = async (modelId) => {
    if (!modelId) {
      setModelRanges(null);
      return;
    }
    try {
      const data = await configService.getModelParameterRanges(modelId);
      if (data?.parameters) {
        setModelRanges(data.parameters);
      }
    } catch (error) {
      console.error('Error loading model ranges:', error);
      setModelRanges(null);
    }
  };

  // Update local state when mappings are fetched
  useEffect(() => {
    if (fetchedMappings && fetchedMappings.length > 0) {
      setLanguageMappings(fetchedMappings);
    }
  }, [fetchedMappings]);

  // Fetch AI config to get fallback chain
  useEffect(() => {
    const fetchAIConfig = async () => {
      try {
        const config = await aiService.getConfig();
        if (config?.model?.id) {
          setValue('selectedModel', config.model.id);
          setValue('selectedModelId', config.model.id);
          // Ensure primary model is first in fallback chain
          // Handle both old format (strings) and new format (objects with {modelId, voiceId})
          const currentVoiceId = config?.voice?.id || 'ash';
          if (config?.model?.fallbackChain && config.model.fallbackChain.length > 0) {
            let chain = [...config.model.fallbackChain];
            // Normalize to objects: handle both old format (strings) and new format (objects)
            chain = chain.map(item => {
              if (typeof item === 'string') {
                return { modelId: item, voiceId: currentVoiceId };
              }
              // If object, ensure it has both modelId and voiceId
              if (item && typeof item === 'object' && item.modelId) {
                return {
                  modelId: item.modelId,
                  voiceId: item.voiceId || currentVoiceId
                };
              }
              return null;
            }).filter(item => item !== null);
            
            // Remove primary model if it exists elsewhere
            chain = chain.filter(item => item.modelId !== config.model.id);
            // Add primary model as first with current voice
            chain = [{ modelId: config.model.id, voiceId: currentVoiceId }, ...chain];
            setFallbackChain(chain);
          } else {
            // If no fallback chain, create one with just the primary model
            setFallbackChain([{ modelId: config.model.id, voiceId: currentVoiceId }]);
          }
        }
        if (config?.voice?.id) {
          setValue('selectedVoice', config.voice.id);
          setValue('defaultVoice', { 
            id: config.voice.id, 
            name: config.voice.name || 'Unknown', 
            language: config.voice.language || 'en-GB' 
          });
        }
      } catch (error) {
        console.error('Error fetching AI config:', error);
      }
    };
    fetchAIConfig();
  }, [setValue]);

  // Get compatible voices for the selected model
  const getCompatibleVoices = useCallback((modelId) => {
    const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);
    const models = availableModels || [];
    
    if (!modelId || !Array.isArray(voices) || !Array.isArray(models)) {
      return voices || [];
    }

    // Find the selected model
    const selectedModel = models.find(m => m.id === modelId);
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
  }, [voicesData, availableModels]);

  // Clear voice selection when model changes and current voice is incompatible
  const selectedModelValue = watch('selectedModel');
  const selectedVoiceValue = watch('selectedVoice');
  
  useEffect(() => {
    if (selectedModelValue && selectedVoiceValue) {
      const compatibleVoices = getCompatibleVoices(selectedModelValue);
      const isCurrentVoiceCompatible = compatibleVoices.some(v => v.id === selectedVoiceValue);
      
      // If current voice is not compatible with new model, clear it
      if (!isCurrentVoiceCompatible) {
        setValue('selectedVoice', '');
      }
    }
  }, [selectedModelValue, selectedVoiceValue, setValue, getCompatibleVoices]);

  // Watch for model changes
  const selectedModelId = watch('selectedModelId');
  useEffect(() => {
    if (selectedModelId) {
      loadModelRanges(selectedModelId);
    } else {
      setModelRanges(null);
    }
  }, [selectedModelId]);

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data) => {
      // Ensure primary model is first in fallback chain
      let finalFallbackChain = [...fallbackChain];
      if (data.selectedModel) {
        // Remove primary model from chain if it exists elsewhere
        finalFallbackChain = finalFallbackChain.filter(item => {
          const itemModelId = typeof item === 'string' ? item : item.modelId;
          return itemModelId !== data.selectedModel;
        });
        // Add primary model as first in chain with current voice
        finalFallbackChain = [{ modelId: data.selectedModel, voiceId: data.selectedVoice || data.defaultVoice?.id || 'ash' }, ...finalFallbackChain];
      }
      
      // Normalize fallback chain to ensure all items are objects with modelId and voiceId
      const normalizedFallbackChain = finalFallbackChain.map(item => {
        if (typeof item === 'string') {
          return {
            modelId: item,
            voiceId: data.selectedVoice || data.defaultVoice?.id || 'ash'
          };
        }
        if (item && item.modelId && item.voiceId) {
          return {
            modelId: item.modelId,
            voiceId: item.voiceId
          };
        }
        return null;
      }).filter(item => item !== null);

      const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);
      const models = availableModels || [];

      // Save audio config, telephony config, and AI config (with fallback chain)
      await Promise.all([
        configService.updateAudioConfig({
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
          energyThresholdAutoCalibrate: data.energyThresholdAutoCalibrate,
          defaultVoice: data.defaultVoice,
          selectedModelId: data.selectedModelId || data.selectedModel,
          temperature: data.temperature,
          topP: data.topP,
          maxTokens: data.maxTokens,
          speechRate: data.speechRate,
          usePerNumberProfiles: data.usePerNumberProfiles
        }),
        configService.updateTelephonyConfig({
          numbers: data.numbers,
          outboundCallerId: data.outboundCallerId,
          transferNumbers: data.transferNumbers,
          afterHoursPolicy: data.afterHoursPolicy,
          voicemailSettings: data.voicemailSettings,
          sipSettings: data.sipSettings
        }),
        // Save AI config with fallback chain if model is selected
        data.selectedModel ? aiService.updateConfig({
          model: {
            id: data.selectedModel,
            name: models.find(m => m.id === data.selectedModel)?.name || 'Unknown',
            fallbackChain: normalizedFallbackChain.length > 0 ? normalizedFallbackChain : [{ modelId: data.selectedModel, voiceId: data.selectedVoice || data.defaultVoice?.id || 'ash' }]
          },
          voice: {
            id: data.selectedVoice || data.defaultVoice?.id || 'ash',
            name: voices.find(v => v.id === (data.selectedVoice || data.defaultVoice?.id))?.name || 'Unknown'
          }
        }) : Promise.resolve()
      ]);

      // Update local fallback chain state
      setFallbackChain(normalizedFallbackChain.length > 0 ? normalizedFallbackChain : []);
    },
    onSuccess: () => {
      showSuccess('Configuration saved successfully');
      queryClient.invalidateQueries(['audio-config']);
      queryClient.invalidateQueries(['telephony-config']);
      queryClient.invalidateQueries(['ai-config']);
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

  // Handle language/voice mapping update
  const handleLanguageMappingChange = (languageCode, field, value) => {
    setLanguageMappings(prev => 
      prev.map(mapping => 
        mapping.languageCode === languageCode 
          ? { ...mapping, [field]: value }
          : mapping
      )
    );
  };

  // Handle voice preview for language mappings
  const handleLanguageVoicePreview = async (voiceId, languageCode) => {
    try {
      setPreviewingVoice({ voiceId, languageCode });
      const sampleText = `Hello, this is a voice preview for ${languageCode}.`;
      await voiceService.previewVoice(voiceId, sampleText);
      showSuccess('Voice preview generated');
    } catch (error) {
      showError('Failed to preview voice');
    } finally {
      setPreviewingVoice(null);
    }
  };

  // Save language/voice mappings
  const handleSaveLanguageMappings = async () => {
    try {
      const mappingsToSave = languageMappings.map(mapping => ({
        languageCode: mapping.languageCode,
        voiceId: mapping.voiceId,
        voiceName: mapping.voiceName,
        isActive: mapping.isActive
      }));
      
      await languageVoiceService.bulkUpdateLanguageMappings(mappingsToSave);
      showSuccess('Language/voice mappings saved successfully');
      queryClient.invalidateQueries(['language-voice-mappings']);
    } catch (error) {
      showError('Failed to save language/voice mappings');
    }
  };

  // Fallback chain handlers
  const handleDragEnd = (event) => {
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
    // Extract modelId from object or use id directly (for backward compatibility)
    const chainItem = fallbackChain[index];
    const modelId = typeof chainItem === 'string' ? chainItem : chainItem?.modelId || id;
    const voiceId = typeof chainItem === 'string' ? undefined : chainItem?.voiceId;
    
    const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);
    const models = availableModels || [];
    const model = models.find(m => m.id === modelId);
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
        
        <Chip
          label={index === 0 ? 'Primary' : `Fallback ${index}`}
          color={index === 0 ? 'primary' : 'default'}
          size="small"
        />
        
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body1" fontWeight="medium">
            {model?.name || modelId}
          </Typography>
          {model && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {model.capabilities?.realtime ? 'Realtime' : 'Standard'} • 
                Context: {model.contextLimit || model.context_limit || 'N/A'} tokens
                {voice && ` • Voice: ${voice.name}`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {model.supportsTools && (
                  <Chip 
                    label="Tools" 
                    size="small" 
                    color="success" 
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {model.supportsAudio && (
                  <Chip 
                    label="Audio" 
                    size="small" 
                    color="success" 
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {model.capabilities?.fileSearch && (
                  <Chip 
                    label="File Search" 
                    size="small" 
                    color="success" 
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {model.rateLimits && (
                  <Tooltip 
                    title={`Rate Limits: ${model.rateLimits.requestsPerMinute} req/min, ${model.rateLimits.tokensPerMinute?.toLocaleString() || 'N/A'} tokens/min`}
                    arrow
                  >
                    <Chip 
                      label={`${model.rateLimits.requestsPerMinute} req/min`} 
                      size="small" 
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  </Tooltip>
                )}
              </Box>
              {model.knownLimitations && model.knownLimitations.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                  <Typography variant="caption">
                    {model.knownLimitations.join(', ')}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
          {!model && (
            <Typography variant="caption" color="text.secondary">
              Model details not available
            </Typography>
          )}
        </Box>

        {index > 0 && (
          <IconButton
            size="small"
            onClick={() => handleRemoveFromFallbackChain(index)}
            color="error"
          >
            <Delete />
          </IconButton>
        )}
      </Paper>
    );
  };

  // Phone number mutations
  const addPhoneNumberMutation = useMutation({
    mutationFn: configService.addPhoneNumber,
    onSuccess: () => {
      showSuccess('Phone number added successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setAddNumberDialog(false);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to add phone number');
    }
  });

  const updatePhoneNumberMutation = useMutation({
    mutationFn: ({ number, data }) => configService.updatePhoneNumber(number, data),
    onSuccess: () => {
      showSuccess('Phone number updated successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setEditNumberDialog(false);
      setNumberToEdit(null);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to update phone number');
    }
  });

  const removePhoneNumberMutation = useMutation({
    mutationFn: configService.removePhoneNumber,
    onSuccess: () => {
      showSuccess('Phone number removed successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setDeleteNumberDialog(false);
      setNumberToDelete(null);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to remove phone number');
    }
  });

  // Transfer number mutations
  const addTransferNumberMutation = useMutation({
    mutationFn: () => {
      const transferNumbers = watch('transferNumbers') || [];
      return configService.updateTelephonyConfig({ transferNumbers });
    },
    onSuccess: () => {
      showSuccess('Transfer number added successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setAddTransferNumberDialog(false);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to add transfer number');
    }
  });

  const updateTransferNumberMutation = useMutation({
    mutationFn: () => {
      const transferNumbers = watch('transferNumbers') || [];
      return configService.updateTelephonyConfig({ transferNumbers });
    },
    onSuccess: () => {
      showSuccess('Transfer number updated successfully');
      queryClient.invalidateQueries(['telephony-config']);
      setEditTransferNumberDialog(false);
      setTransferNumberToEdit(null);
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to update transfer number');
    }
  });

  const handleAddNumber = (numberData) => {
    addPhoneNumberMutation.mutate(numberData);
  };

  const handleEditNumber = (number, numberData) => {
    updatePhoneNumberMutation.mutate({ number, data: numberData });
  };

  const handleDeleteNumber = (number) => {
    removePhoneNumberMutation.mutate(number);
  };

  const handleOpenEditNumber = (number) => {
    setNumberToEdit(number);
    setEditNumberDialog(true);
  };

  const handleOpenDeleteNumber = (number) => {
    setNumberToDelete(number);
    setDeleteNumberDialog(true);
  };

  const handleAddTransferNumber = (transferNumberData) => {
    const transferNumbers = watch('transferNumbers') || [];
    setValue('transferNumbers', [...transferNumbers, transferNumberData]);
    addTransferNumberMutation.mutate();
  };

  const handleEditTransferNumber = (index, transferNumberData) => {
    const transferNumbers = watch('transferNumbers') || [];
    const updated = [...transferNumbers];
    updated[index] = transferNumberData;
    setValue('transferNumbers', updated);
    updateTransferNumberMutation.mutate();
  };

  const handleDeleteTransferNumber = (index) => {
    const transferNumbers = watch('transferNumbers') || [];
    const updated = transferNumbers.filter((_, i) => i !== index);
    setValue('transferNumbers', updated);
    updateTransferNumberMutation.mutate();
  };

  const handleOpenEditTransferNumber = (index) => {
    const transferNumbers = watch('transferNumbers') || [];
    setTransferNumberToEdit({ index, data: transferNumbers[index] });
    setEditTransferNumberDialog(true);
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

            <Grid container spacing={3}>
              {/* VAD Settings */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Voice Activity Detection
                    </Typography>
                    <Box>
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

              {/* Energy Threshold */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Energy Threshold
                      </Typography>
                      <Tooltip title="Adaptive threshold for line noise detection. When auto-calibrate is enabled, the system adjusts the threshold at the start of each call based on detected background noise levels.">
                        <IconButton size="small">
                          <Info fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Adaptive threshold for line noise detection. Auto-calibration adjusts per call start.
                    </Typography>
                    <Stack spacing={2}>
                      <Controller
                        name="energyThresholdAutoCalibrate"
                        control={control}
                        render={({ field }) => (
                          <MuiFormControlLabel
                            control={<Switch {...field} checked={field.value} />}
                            label="Auto-calibrate per call"
                          />
                        )}
                      />
                      {!watch('energyThresholdAutoCalibrate') && (
                        <Box>
                          <Controller
                            name="energyThreshold"
                            control={control}
                            render={({ field }) => (
                              <Slider
                                {...field}
                                value={field.value || 50}
                                min={0}
                                max={100}
                                step={5}
                                marks={[
                                  { value: 0, label: '0' },
                                  { value: 50, label: '50' },
                                  { value: 100, label: '100' }
                                ]}
                                valueLabelDisplay="auto"
                                disabled={watch('energyThresholdAutoCalibrate')}
                              />
                            )}
                          />
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Audio Quality */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Audio Quality Settings
                    </Typography>
                    <Box sx={{ mb: 3 }}>
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
                    <Stack spacing={1.5}>
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
                      {watch('noiseSuppression') && (
                        <Box sx={{ ml: 4, mt: 1.5 }}>
                          <Controller
                            name="noiseSuppressionAlgorithm"
                            control={control}
                            render={({ field }) => (
                              <FormControl fullWidth size="small">
                                <InputLabel>Algorithm</InputLabel>
                                <Select {...field}>
                                  <MenuItem value="basic">Basic</MenuItem>
                                  <MenuItem value="rnnoise">RNNoise</MenuItem>
                                  <MenuItem value="webrtc">WebRTC NS</MenuItem>
                                </Select>
                              </FormControl>
                            )}
                          />
                        </Box>
                      )}
                      <Controller
                        name="echoCancellation"
                        control={control}
                        render={({ field }) => (
                          <MuiFormControlLabel
                            control={<Switch {...field} checked={field.value} />}
                            label="Echo Cancellation (AEC)"
                          />
                        )}
                      />
                      <Controller
                        name="automaticGainControl"
                        control={control}
                        render={({ field }) => (
                          <MuiFormControlLabel
                            control={<Switch {...field} checked={field.value} />}
                            label="Automatic Gain Control (AGC)"
                          />
                        )}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Padding Settings */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Audio Padding
                    </Typography>
                    <Stack spacing={2}>
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
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Barge-in Policy */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Barge-in Policy
                    </Typography>
                    <Box>
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
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Model Parameter Validation */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Model Parameter Validation
                      </Typography>
                      {modelRanges && (
                        <Chip 
                          icon={<CheckCircle />} 
                          label="Validated" 
                          color="success" 
                          size="small" 
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Select a model to view and validate parameter ranges from the capability registry.
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="selectedModelId"
                          control={control}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel>Model</InputLabel>
                              <Select {...field} label="Model">
                                <MenuItem value={null}>Use default from AI Config</MenuItem>
                                {availableModels?.map((model) => (
                                  <MenuItem key={model.id} value={model.id}>
                                    {model.name || model.id}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        />
                      </Grid>
                      {modelRanges && (
                        <>
                          <Grid item xs={12} md={6}>
                            <Alert severity="info" icon={<Info />}>
                              <Typography variant="body2" fontWeight="bold" gutterBottom>
                                Allowed Parameter Ranges:
                              </Typography>
                              <Typography variant="body2">
                                Temperature: {modelRanges.temperature?.min} - {modelRanges.temperature?.max} (default: {modelRanges.temperature?.default})
                              </Typography>
                              <Typography variant="body2">
                                TopP: {modelRanges.top_p?.min} - {modelRanges.top_p?.max} (default: {modelRanges.top_p?.default})
                              </Typography>
                              <Typography variant="body2">
                                MaxTokens: {modelRanges.max_tokens?.min} - {modelRanges.max_tokens?.max} (default: {modelRanges.max_tokens?.default})
                              </Typography>
                            </Alert>
                          </Grid>
                          <Grid item xs={12}>
                            <Grid container spacing={3}>
                              <Grid item xs={12} md={4}>
                                <Controller
                                  name="temperature"
                                  control={control}
                                  render={({ field }) => (
                                    <Box>
                                      <Typography variant="subtitle2" gutterBottom>
                                        Temperature: {field.value}
                                      </Typography>
                                      <Slider
                                        {...field}
                                        min={modelRanges.temperature?.min || 0}
                                        max={modelRanges.temperature?.max || 2}
                                        step={modelRanges.temperature?.step || 0.1}
                                        valueLabelDisplay="auto"
                                      />
                                    </Box>
                                  )}
                                />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <Controller
                                  name="topP"
                                  control={control}
                                  render={({ field }) => (
                                    <Box>
                                      <Typography variant="subtitle2" gutterBottom>
                                        TopP: {field.value}
                                      </Typography>
                                      <Slider
                                        {...field}
                                        min={modelRanges.top_p?.min || 0}
                                        max={modelRanges.top_p?.max || 1}
                                        step={modelRanges.top_p?.step || 0.1}
                                        valueLabelDisplay="auto"
                                      />
                                    </Box>
                                  )}
                                />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <Controller
                                  name="maxTokens"
                                  control={control}
                                  render={({ field }) => (
                                    <Box>
                                      <Typography variant="subtitle2" gutterBottom>
                                        MaxTokens: {field.value}
                                      </Typography>
                                      <Slider
                                        {...field}
                                        min={modelRanges.max_tokens?.min || 1}
                                        max={Math.min(modelRanges.max_tokens?.max || 500, 500)}
                                        step={modelRanges.max_tokens?.step || 1}
                                        valueLabelDisplay="auto"
                                      />
                                    </Box>
                                  )}
                                />
                              </Grid>
                            </Grid>
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Per-Number Profile Settings */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Per-Number Audio Profiles
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Configure different audio settings for specific phone numbers. When enabled, each number can have its own audio profile.
                    </Typography>
                    <Stack spacing={2}>
                      <Controller
                        name="usePerNumberProfiles"
                        control={control}
                        render={({ field }) => (
                          <MuiFormControlLabel
                            control={<Switch {...field} checked={field.value} />}
                            label="Enable per-number profiles"
                          />
                        )}
                      />
                      {watch('usePerNumberProfiles') && (
                        <>
                          <Alert severity="info">
                            Per-number profiles can be managed from the Telephony Routing tab. Each number can override global audio settings.
                          </Alert>
                          <Box>
                            <Button
                              variant="outlined"
                              startIcon={<Settings />}
                              onClick={() => {
                                setActiveTab(2); // Switch to Telephony Routing tab
                              }}
                            >
                              Manage Number Profiles
                            </Button>
                          </Box>
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Tab 2: Voice Management */}
        {activeTab === 1 && (
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
                        {(Array.isArray(availableModels) ? availableModels : []).map((model) => (
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
                  render={({ field }) => {
                    const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);
                    return (
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
                    );
                  }}
                />
              </Box>
            </Paper>

            {/* Fallback Chain Configuration */}
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

              {/* Add Model to Fallback Chain */}
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Add Model to Fallback Chain
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Controller
                    name="selectedModel"
                    control={control}
                    render={({ field }) => (
                      <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Model</InputLabel>
                        <Select {...field} label="Model">
                          {(Array.isArray(availableModels) ? availableModels : []).map((model) => (
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
                                {selectedModel ? 'No compatible voices' : 'Select model first'}
                              </MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      );
                    }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleSaveModelVoice}
                    disabled={!watch('selectedModel') || !watch('selectedVoice')}
                  >
                    Add to Chain
                  </Button>
                </Box>
              </Box>

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
                      const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);
                      const models = availableModels || [];
                      const model = models.find(m => m.id === modelId);
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

            {/* Model Capability Registry */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Active Model Capabilities
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => {
                    queryClient.invalidateQueries(['model-capabilities']);
                  }}
                >
                  Refresh
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                View capabilities for your primary model and fallback chain models.
              </Typography>

              {capabilitiesLoading ? (
                <LinearProgress sx={{ mb: 2 }} />
              ) : (() => {
                const selectedModel = watch('selectedModel');
                const allCapabilities = capabilitiesData?.capabilities || [];
                
                const primaryModelId = selectedModel;
                const fallbackModelIds = fallbackChain.map(item => 
                  typeof item === 'string' ? item : item.modelId
                ).filter(id => id && id !== primaryModelId);
                
                const activeModels = allCapabilities.filter(model => 
                  model.id === primaryModelId || fallbackModelIds.includes(model.id)
                );
                
                if (activeModels.length === 0) {
                  return (
                    <Alert severity="info">
                      No active models selected. Please select a primary model above.
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
                          <TableCell align="center"><strong>File Search</strong></TableCell>
                          <TableCell align="center"><strong>Details</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeModels.map((model, index) => {
                          const isPrimary = model.id === primaryModelId;
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
                                  {!isPrimary && index === 1 && (
                                    <Chip 
                                      label="Fallback" 
                                      size="small" 
                                      color="default"
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                {model.contextLimit 
                                  ? model.contextLimit.toLocaleString() 
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
                );
              })()}
            </Paper>

            {/* Language/Voice Mapping Configuration */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Language/Voice Mapping Configuration
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Save />}
                  onClick={handleSaveLanguageMappings}
                  disabled={mappingsLoading}
                >
                  Save Mappings
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure voice selection for each supported language. Preview voices before saving.
              </Typography>

              {mappingsLoading ? (
                <LinearProgress sx={{ mb: 2 }} />
              ) : languageMappings.length === 0 ? (
                <Alert severity="info">
                  No language mappings found. Default mappings will be created on first load.
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Language</strong></TableCell>
                        <TableCell><strong>Locale Code</strong></TableCell>
                        <TableCell><strong>Voice</strong></TableCell>
                        <TableCell align="center"><strong>Preview</strong></TableCell>
                        <TableCell align="center"><strong>Status</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {languageMappings.map((mapping) => {
                        const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);
                        // Filter voices by language/locale if possible
                        const compatibleVoices = voices.filter(voice => {
                          if (!voice.language) return true;
                          return voice.language.toLowerCase().includes(mapping.localeCode.toLowerCase().split('-')[0]);
                        });
                        
                        return (
                          <TableRow key={mapping.languageCode}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {mapping.languageName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {mapping.localeCode}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={mapping.voiceId || ''}
                                  onChange={(e) => {
                                    const selectedVoice = voices.find(v => v.id === e.target.value);
                                    handleLanguageMappingChange(
                                      mapping.languageCode,
                                      'voiceId',
                                      e.target.value
                                    );
                                    if (selectedVoice) {
                                      handleLanguageMappingChange(
                                        mapping.languageCode,
                                        'voiceName',
                                        selectedVoice.name
                                      );
                                    }
                                  }}
                                  displayEmpty
                                >
                                  <MenuItem value="" disabled>
                                    Select Voice
                                  </MenuItem>
                                  {(compatibleVoices.length > 0 ? compatibleVoices : voices).map((voice) => (
                                    <MenuItem key={voice.id} value={voice.id}>
                                      {voice.name} ({voice.language || 'N/A'})
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleLanguageVoicePreview(mapping.voiceId, mapping.languageCode)}
                                disabled={!mapping.voiceId || (previewingVoice?.voiceId === mapping.voiceId && previewingVoice?.languageCode === mapping.languageCode)}
                              >
                                {previewingVoice?.voiceId === mapping.voiceId && previewingVoice?.languageCode === mapping.languageCode ? (
                                  <Stop />
                                ) : (
                                  <PlayArrow />
                                )}
                              </IconButton>
                            </TableCell>
                            <TableCell align="center">
                              <Switch
                                checked={mapping.isActive !== false}
                                onChange={(e) => handleLanguageMappingChange(
                                  mapping.languageCode,
                                  'isActive',
                                  e.target.checked
                                )}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            {/* Available Voices Grid */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Available Voices
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Browse and preview all available AI voices
              </Typography>

              {voicesLoading ? (
                <LinearProgress />
              ) : (
                <Grid container spacing={3}>
                  {(Array.isArray(voicesData) ? voicesData : (voicesData?.voices || [])).map((voice) => (
                    <Grid item xs={12} md={6} lg={4} key={voice.id}>
                      <Card sx={{ 
                        border: watch('defaultVoice')?.id === voice.id ? 2 : 1,
                        borderColor: watch('defaultVoice')?.id === voice.id ? 'primary.main' : 'divider'
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
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>
          </Box>
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
                    <TableCell>Description</TableCell>
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
                        <Typography variant="body2" color="text.secondary">
                          {number.description || '-'}
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
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={number.status || 'active'}
                            onChange={(e) => {
                              const updatedNumbers = [...provisionedNumbers];
                              updatedNumbers[index] = { ...updatedNumbers[index], status: e.target.value };
                              setValue('numbers', updatedNumbers);
                              handleEditNumber(number.number, { status: e.target.value });
                            }}
                          >
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                            <MenuItem value="maintenance">Maintenance</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small"
                          onClick={() => handleOpenEditNumber(number)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleOpenDeleteNumber(number)}
                        >
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

            {/* Transfer Numbers Section */}
            <Divider sx={{ my: 3 }} />
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Phone />
                  <Typography variant="h6">Transfer Numbers</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setAddTransferNumberDialog(true)}
                  >
                    Add Transfer Number
                  </Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Number</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Department</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(watch('transferNumbers') || []).map((transferNumber, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {transferNumber.number}
                            </Typography>
                          </TableCell>
                          <TableCell>{transferNumber.name || '-'}</TableCell>
                          <TableCell>{transferNumber.department || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={transferNumber.isActive ? 'Active' : 'Inactive'}
                              color={transferNumber.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditTransferNumber(index)}
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteTransferNumber(index)}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {(watch('transferNumbers') || []).length === 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No transfer numbers configured. Add a transfer number to enable human transfers.
                  </Alert>
                )}
              </AccordionDetails>
            </Accordion>

            {/* After-hours Policy Section */}
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTime />
                  <Typography variant="h6">After-hours Policy</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Controller
                      name="afterHoursPolicy.enabled"
                      control={control}
                      render={({ field }) => (
                        <MuiFormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="Enable after-hours policy"
                        />
                      )}
                    />
                  </Grid>
                  {watch('afterHoursPolicy.enabled') && (
                    <>
                      <Grid item xs={12} md={6}>
                        <Tooltip title="Time when after-hours period begins (e.g., 18:00 for 6 PM)">
                          <Controller
                            name="afterHoursPolicy.startTime"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="Start Time"
                                type="time"
                                fullWidth
                                helperText="When after-hours period begins"
                              />
                            )}
                          />
                        </Tooltip>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Tooltip title="Time when business hours resume (e.g., 09:00 for 9 AM)">
                          <Controller
                            name="afterHoursPolicy.endTime"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="End Time"
                                type="time"
                                fullWidth
                                helperText="When business hours resume"
                              />
                            )}
                          />
                        </Tooltip>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="afterHoursPolicy.timezone"
                          control={control}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel>Timezone</InputLabel>
                              <Select {...field} label="Timezone">
                                <MenuItem value="Europe/London">Europe/London (GMT)</MenuItem>
                                <MenuItem value="UTC">UTC</MenuItem>
                                <MenuItem value="America/New_York">America/New_York (EST)</MenuItem>
                                <MenuItem value="America/Los_Angeles">America/Los_Angeles (PST)</MenuItem>
                              </Select>
                            </FormControl>
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="afterHoursPolicy.action"
                          control={control}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel>Action</InputLabel>
                              <Select {...field} label="Action">
                                <MenuItem value="voicemail">Voicemail</MenuItem>
                                <MenuItem value="transfer">Transfer to Human</MenuItem>
                                <MenuItem value="ai_agent">AI Agent</MenuItem>
                              </Select>
                            </FormControl>
                          )}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Controller
                          name="afterHoursPolicy.message"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="After-hours Message"
                              multiline
                              rows={3}
                              fullWidth
                              helperText="Message played to callers during after-hours"
                            />
                          )}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Voicemail Settings Section */}
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Voicemail />
                  <Typography variant="h6">Voicemail Settings</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Controller
                      name="voicemailSettings.enabled"
                      control={control}
                      render={({ field }) => (
                        <MuiFormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="Enable voicemail"
                        />
                      )}
                    />
                  </Grid>
                  {watch('voicemailSettings.enabled') && (
                    <>
                      <Grid item xs={12}>
                        <Controller
                          name="voicemailSettings.greeting"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Voicemail Greeting"
                              multiline
                              rows={3}
                              fullWidth
                              helperText="Message played before recording starts"
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="voicemailSettings.maxDuration"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Max Duration (seconds)"
                              type="number"
                              fullWidth
                              inputProps={{ min: 30, max: 600 }}
                              helperText="Maximum voicemail recording length"
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Controller
                          name="voicemailSettings.emailNotification"
                          control={control}
                          render={({ field }) => (
                            <MuiFormControlLabel
                              control={<Switch {...field} checked={field.value} />}
                              label="Email notification on new voicemail"
                            />
                          )}
                        />
                      </Grid>
                      {watch('voicemailSettings.emailNotification') && (
                        <Grid item xs={12}>
                          <Controller
                            name="voicemailSettings.emailRecipients"
                            control={control}
                            rules={{
                              validate: (value) => {
                                if (!value || value.length === 0) return true; // Optional
                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                const invalidEmails = value.filter(email => !emailRegex.test(email));
                                return invalidEmails.length === 0 || 'Please enter valid email addresses';
                              }
                            }}
                            render={({ field, fieldState: { error } }) => (
                              <TextField
                                {...field}
                                label="Email Recipients"
                                fullWidth
                                placeholder="email1@example.com, email2@example.com"
                                helperText={error?.message || 'Comma-separated list of email addresses'}
                                error={!!error}
                                onChange={(e) => {
                                  const emails = e.target.value.split(',').map(email => email.trim()).filter(email => email);
                                  field.onChange(emails);
                                }}
                                value={(field.value || []).join(', ')}
                              />
                            )}
                          />
                        </Grid>
                      )}
                    </>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* SIP Settings Section */}
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Router />
                  <Typography variant="h6">SIP Settings</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Tooltip title="Primary telephony connection method. SIP is recommended for Twilio Elastic SIP Trunk.">
                          <FormControl fullWidth>
                            <Controller
                              name="sipSettings.primaryPath"
                              control={control}
                              render={({ field }) => (
                                <>
                                  <InputLabel>Primary Path</InputLabel>
                                  <Select {...field} label="Primary Path">
                                    <MenuItem value="sip">SIP</MenuItem>
                                    <MenuItem value="media_streams">Media Streams</MenuItem>
                                  </Select>
                                </>
                              )}
                            />
                          </FormControl>
                        </Tooltip>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Tooltip title="Fallback connection method if primary path fails. Media Streams uses WebSocket.">
                          <FormControl fullWidth>
                            <Controller
                              name="sipSettings.fallbackPath"
                              control={control}
                              render={({ field }) => (
                                <>
                                  <InputLabel>Fallback Path</InputLabel>
                                  <Select {...field} label="Fallback Path">
                                    <MenuItem value="sip">SIP</MenuItem>
                                    <MenuItem value="media_streams">Media Streams</MenuItem>
                                  </Select>
                                </>
                              )}
                            />
                          </FormControl>
                        </Tooltip>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Tooltip title="Audio codec for call quality. Opus is recommended for best quality and bandwidth efficiency.">
                          <FormControl fullWidth>
                            <Controller
                              name="sipSettings.codec"
                              control={control}
                              render={({ field }) => (
                                <>
                                  <InputLabel>Codec</InputLabel>
                                  <Select {...field} label="Codec">
                                    <MenuItem value="opus">Opus</MenuItem>
                                    <MenuItem value="pcm">PCM</MenuItem>
                                    <MenuItem value="g722">G.722</MenuItem>
                                  </Select>
                                </>
                              )}
                            />
                          </FormControl>
                        </Tooltip>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Tooltip title="SIP region for routing. Use 'europe' for UK numbers, 'us-east' for US numbers.">
                          <Controller
                            name="sipSettings.region"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="Region"
                                fullWidth
                                helperText="SIP region (e.g., europe, us-east)"
                              />
                            )}
                          />
                        </Tooltip>
                      </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Paper>
        )}

        {/* Tab 4: Call Quality */}
        {activeTab === 3 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
                  Call Quality Metrics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Real-time audio quality monitoring and performance metrics
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Time Range</InputLabel>
                  <Select
                    value={callQualityTimeRange}
                    label="Time Range"
                    onChange={(e) => setCallQualityTimeRange(e.target.value)}
                  >
                    <MenuItem value="1h">Last Hour</MenuItem>
                    <MenuItem value="24h">Last 24 Hours</MenuItem>
                    <MenuItem value="7d">Last 7 Days</MenuItem>
                    <MenuItem value="30d">Last 30 Days</MenuItem>
                  </Select>
                </FormControl>
                <IconButton onClick={() => refetchAudioMetrics()} disabled={audioMetricsLoading}>
                  <Refresh />
                </IconButton>
              </Box>
            </Box>

            {audioMetricsLoading && (
              <Box sx={{ py: 4 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                  Loading metrics...
                </Typography>
              </Box>
            )}

            {audioMetricsError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                Error loading audio metrics: {audioMetricsError.message || 'Unknown error'}
              </Alert>
            )}

            {!audioMetricsLoading && !audioMetricsError && (!audioMetrics?.metrics || audioMetrics.metrics.totalCalls === 0) && (
              <Alert severity="info" sx={{ mb: 3 }}>
                No call quality data available for the selected time range. Metrics will appear here once calls are completed.
              </Alert>
            )}

            {!audioMetricsLoading && !audioMetricsError && audioMetrics?.metrics && audioMetrics.metrics.totalCalls > 0 && (
              <>
                {audioMetrics.metrics.lastUpdated && (
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Last updated: {new Date(audioMetrics.metrics.lastUpdated).toLocaleString()}
                  </Typography>
                )}
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="primary">
                          {audioMetrics.metrics.averageLatency?.toFixed(1) || '0'}ms
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Average Latency
                        </Typography>
                        {audioMetrics.metrics.minLatency !== null && audioMetrics.metrics.maxLatency !== null && (
                          <Typography variant="caption" color="text.secondary">
                            Range: {audioMetrics.metrics.minLatency?.toFixed(1)} - {audioMetrics.metrics.maxLatency?.toFixed(1)}ms
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="success.main">
                          {audioMetrics.metrics.mosScore?.toFixed(2) || '0'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          MOS Score
                        </Typography>
                        {audioMetrics.metrics.callQuality && (
                          <Chip 
                            label={audioMetrics.metrics.callQuality} 
                            size="small" 
                            color={
                              audioMetrics.metrics.callQuality === 'excellent' ? 'success' :
                              audioMetrics.metrics.callQuality === 'good' ? 'info' :
                              audioMetrics.metrics.callQuality === 'fair' ? 'warning' : 'error'
                            }
                            sx={{ mt: 1 }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="warning.main">
                          {audioMetrics.metrics.packetLoss?.toFixed(2) || '0'}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Packet Loss
                        </Typography>
                        {audioMetrics.metrics.minPacketLoss !== null && audioMetrics.metrics.maxPacketLoss !== null && (
                          <Typography variant="caption" color="text.secondary">
                            Range: {audioMetrics.metrics.minPacketLoss?.toFixed(2)} - {audioMetrics.metrics.maxPacketLoss?.toFixed(2)}%
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="info.main">
                          {audioMetrics.metrics.jitter?.toFixed(2) || '0'}ms
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Jitter
                        </Typography>
                        {audioMetrics.metrics.minJitter !== null && audioMetrics.metrics.maxJitter !== null && (
                          <Typography variant="caption" color="text.secondary">
                            Range: {audioMetrics.metrics.minJitter?.toFixed(2)} - {audioMetrics.metrics.maxJitter?.toFixed(2)}ms
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  {audioMetrics.metrics.totalCalls > 0 && (
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Summary Statistics
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Total Calls: {audioMetrics.metrics.totalCalls}
                          </Typography>
                          {audioMetrics.metrics.qualityDistribution && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Quality Distribution:
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                <Chip label={`Excellent: ${audioMetrics.metrics.qualityDistribution.excellent}`} size="small" color="success" />
                                <Chip label={`Good: ${audioMetrics.metrics.qualityDistribution.good}`} size="small" color="info" />
                                <Chip label={`Fair: ${audioMetrics.metrics.qualityDistribution.fair}`} size="small" color="warning" />
                                <Chip label={`Poor: ${audioMetrics.metrics.qualityDistribution.poor}`} size="small" color="error" />
                              </Stack>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>

                {/* Historical Trend Charts */}
                {historicalMetrics?.data && historicalMetrics.data.length > 0 && (
                  <Grid container spacing={3} sx={{ mt: 2 }}>
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Latency Trend
                          </Typography>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={historicalMetrics.data}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="timestamp" 
                                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                              />
                              <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                              <RechartsTooltip 
                                labelFormatter={(value) => new Date(value).toLocaleString()}
                                formatter={(value) => [`${value?.toFixed(1)}ms`, 'Latency']}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="latency" 
                                stroke="#1976d2" 
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                name="Latency (ms)"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Jitter Trend
                          </Typography>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={historicalMetrics.data}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="timestamp" 
                                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                              />
                              <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                              <RechartsTooltip 
                                labelFormatter={(value) => new Date(value).toLocaleString()}
                                formatter={(value) => [`${value?.toFixed(2)}ms`, 'Jitter']}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="jitter" 
                                stroke="#0288d1" 
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                name="Jitter (ms)"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Packet Loss Trend
                          </Typography>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={historicalMetrics.data}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="timestamp" 
                                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                              />
                              <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                              <RechartsTooltip 
                                labelFormatter={(value) => new Date(value).toLocaleString()}
                                formatter={(value) => [`${value?.toFixed(2)}%`, 'Packet Loss']}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="packetLoss" 
                                stroke="#ed6c02" 
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                name="Packet Loss (%)"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            MOS Score Trend
                          </Typography>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={historicalMetrics.data}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="timestamp" 
                                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                              />
                              <YAxis domain={[1, 5]} label={{ value: 'MOS', angle: -90, position: 'insideLeft' }} />
                              <RechartsTooltip 
                                labelFormatter={(value) => new Date(value).toLocaleString()}
                                formatter={(value) => [`${value?.toFixed(2)}`, 'MOS Score']}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="mosScore" 
                                stroke="#2e7d32" 
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                name="MOS Score"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                )}

                {/* Per-Call Quality Metrics Table */}
                <Grid container spacing={3} sx={{ mt: 2 }}>
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">
                            Recent Calls Quality Metrics
                          </Typography>
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Filter by Quality</InputLabel>
                            <Select
                              value={callQualityFilter}
                              label="Filter by Quality"
                              onChange={(e) => setCallQualityFilter(e.target.value)}
                            >
                              <MenuItem value="">All</MenuItem>
                              <MenuItem value="excellent">Excellent</MenuItem>
                              <MenuItem value="good">Good</MenuItem>
                              <MenuItem value="fair">Fair</MenuItem>
                              <MenuItem value="poor">Poor</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                        {recentCallsLoading ? (
                          <Box sx={{ py: 4 }}>
                            <LinearProgress />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                              Loading recent calls...
                            </Typography>
                          </Box>
                        ) : recentCallsData?.calls && recentCallsData.calls.length > 0 ? (
                          <TableContainer>
                            <Table>
                              <TableHead>
                                <TableRow>
                                  <TableCell>Call SID</TableCell>
                                  <TableCell>From</TableCell>
                                  <TableCell>To</TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>Duration</TableCell>
                                  <TableCell>Latency (ms)</TableCell>
                                  <TableCell>Jitter (ms)</TableCell>
                                  <TableCell>Packet Loss (%)</TableCell>
                                  <TableCell>MOS Score</TableCell>
                                  <TableCell>Quality</TableCell>
                                  <TableCell>Measured At</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {recentCallsData.calls.map((call) => (
                                  <TableRow key={call.callSid}>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                        {call.callSid?.substring(0, 20)}...
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{call.from || 'N/A'}</TableCell>
                                    <TableCell>{call.to || 'N/A'}</TableCell>
                                    <TableCell>
                                      <Chip 
                                        label={call.callStatus || 'unknown'} 
                                        size="small"
                                        color={
                                          call.callStatus === 'completed' ? 'success' :
                                          call.callStatus === 'in-progress' ? 'info' :
                                          call.callStatus === 'failed' ? 'error' : 'default'
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                      {call.audioQuality?.latency != null 
                                        ? `${call.audioQuality.latency.toFixed(1)}ms` 
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                      {call.audioQuality?.jitter != null 
                                        ? `${call.audioQuality.jitter.toFixed(2)}ms` 
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                      {call.audioQuality?.packetLoss != null 
                                        ? `${call.audioQuality.packetLoss.toFixed(2)}%` 
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                      {call.audioQuality?.mosScore != null 
                                        ? call.audioQuality.mosScore.toFixed(2) 
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                      {call.audioQuality?.callQuality ? (
                                        <Chip 
                                          label={call.audioQuality.callQuality} 
                                          size="small"
                                          color={
                                            call.audioQuality.callQuality === 'excellent' ? 'success' :
                                            call.audioQuality.callQuality === 'good' ? 'info' :
                                            call.audioQuality.callQuality === 'fair' ? 'warning' : 'error'
                                          }
                                        />
                                      ) : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                      {call.audioQuality?.measuredAt 
                                        ? new Date(call.audioQuality.measuredAt).toLocaleString() 
                                        : 'N/A'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Alert severity="info">
                            No calls with quality metrics found for the selected filter.
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </>
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

      {/* Add Phone Number Dialog */}
      <Dialog open={addNumberDialog} onClose={() => setAddNumberDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Phone Number</DialogTitle>
        <DialogContent>
          <PhoneNumberForm
            onSubmit={(data) => {
              handleAddNumber(data);
            }}
            onCancel={() => setAddNumberDialog(false)}
            isLoading={addPhoneNumberMutation.isLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Phone Number Dialog */}
      <Dialog open={editNumberDialog} onClose={() => {
        setEditNumberDialog(false);
        setNumberToEdit(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Phone Number</DialogTitle>
        <DialogContent>
          {numberToEdit && (
            <PhoneNumberForm
              initialData={numberToEdit}
              onSubmit={(data) => {
                handleEditNumber(numberToEdit.number, data);
              }}
              onCancel={() => {
                setEditNumberDialog(false);
                setNumberToEdit(null);
              }}
              isLoading={updatePhoneNumberMutation.isLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Phone Number Confirmation Dialog */}
      <Dialog open={deleteNumberDialog} onClose={() => {
        setDeleteNumberDialog(false);
        setNumberToDelete(null);
      }}>
        <DialogTitle>Delete Phone Number</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete phone number <strong>{numberToDelete?.number}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteNumberDialog(false);
            setNumberToDelete(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleDeleteNumber(numberToDelete?.number)}
            disabled={removePhoneNumberMutation.isLoading}
          >
            {removePhoneNumberMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Transfer Number Dialog */}
      <Dialog open={addTransferNumberDialog} onClose={() => setAddTransferNumberDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Transfer Number</DialogTitle>
        <DialogContent>
          <TransferNumberForm
            onSubmit={(data) => {
              handleAddTransferNumber(data);
            }}
            onCancel={() => setAddTransferNumberDialog(false)}
            isLoading={addTransferNumberMutation.isLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Transfer Number Dialog */}
      <Dialog open={editTransferNumberDialog} onClose={() => {
        setEditTransferNumberDialog(false);
        setTransferNumberToEdit(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Transfer Number</DialogTitle>
        <DialogContent>
          {transferNumberToEdit && (
            <TransferNumberForm
              initialData={transferNumberToEdit.data}
              onSubmit={(data) => {
                handleEditTransferNumber(transferNumberToEdit.index, data);
              }}
              onCancel={() => {
                setEditTransferNumberDialog(false);
                setTransferNumberToEdit(null);
              }}
              isLoading={updateTransferNumberMutation.isLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
};

// Phone Number Form Component
const PhoneNumberForm = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: initialData || {
      number: '',
      route: 'ai_agent',
      status: 'active',
      description: ''
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={3} sx={{ mt: 1 }}>
        <Controller
          name="number"
          control={control}
          rules={{
            required: 'Phone number is required',
            pattern: {
              value: /^\+?[1-9]\d{1,14}$/,
              message: 'Enter a valid phone number in E.164 format (e.g., +442045726060)'
            }
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Phone Number"
              fullWidth
              placeholder="+442045726060"
              error={!!error}
              helperText={error?.message || 'Enter phone number in E.164 format'}
            />
          )}
        />
        <Controller
          name="route"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel>Route Assignment</InputLabel>
              <Select {...field} label="Route Assignment">
                <MenuItem value="ai_agent">AI Agent</MenuItem>
                <MenuItem value="transfer">Transfer to Human</MenuItem>
                <MenuItem value="voicemail">Voicemail</MenuItem>
                <MenuItem value="after_hours">After-hours Message</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select {...field} label="Status">
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Description"
              fullWidth
              multiline
              rows={2}
              helperText="Optional description for this phone number"
            />
          )}
        />
      </Stack>
      <DialogActions sx={{ mt: 3 }}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </form>
  );
};

// Transfer Number Form Component
const TransferNumberForm = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: initialData || {
      number: '',
      name: '',
      department: '',
      isActive: true
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={3} sx={{ mt: 1 }}>
        <Controller
          name="number"
          control={control}
          rules={{
            required: 'Phone number is required',
            pattern: {
              value: /^\+?[1-9]\d{1,14}$/,
              message: 'Enter a valid phone number in E.164 format'
            }
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Phone Number"
              fullWidth
              placeholder="+442036918807"
              error={!!error}
              helperText={error?.message || 'Enter phone number in E.164 format'}
            />
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              fullWidth
              placeholder="Main Office"
              helperText="Optional name for this transfer number"
            />
          )}
        />
        <Controller
          name="department"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Department"
              fullWidth
              placeholder="Customer Service"
              helperText="Optional department name"
            />
          )}
        />
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <MuiFormControlLabel
              control={<Switch {...field} checked={field.value} />}
              label="Active"
            />
          )}
        />
      </Stack>
      <DialogActions sx={{ mt: 3 }}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </form>
  );
};

export default AudioTelephonyPage;