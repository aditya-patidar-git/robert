import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useToast } from '../../../components/common/ToastProvider';
import configService from '../../../services/configService';
import telephonyService from '../../../services/telephonyService';
import voiceService from '../../../services/voiceService';
import aiService from '../../../services/aiService';
import { useAudioConfig } from '../../../hooks/useAudioConfig';
import { useTelephonyConfig } from '../../../hooks/useTelephonyConfig';
import { useAIModels } from '../../../hooks/useAIModels';
import { useLanguageVoiceMappings } from '../../../hooks/useLanguageVoiceMappings';
import { useModelCapabilities } from '../../../hooks/useModelCapabilities';
import { useModelVoiceCompatibility } from '../../../hooks/useModelVoiceCompatibility';
import { useFallbackChain } from '../../../hooks/useFallbackChain';

export const useAudioTelephonyState = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  // Form state
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

  // Dialog state
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
  const [callQualityTimeRange, setCallQualityTimeRange] = useState('24h');
  const [callQualityFilter, setCallQualityFilter] = useState('');

  // Use custom hooks
  const { isLoading: audioLoading } = useAudioConfig({ setValue, watch });
  const { isLoading: telephonyLoading } = useTelephonyConfig({ setValue, watch });
  const { models: availableModels } = useAIModels();
  const { mappings: languageMappings, isLoading: mappingsLoading, previewingVoice, setPreviewingVoice } = useLanguageVoiceMappings();
  const { isLoading: capabilitiesLoading } = useModelCapabilities();

  // Queries
  const { data: voicesData, isLoading: voicesLoading } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices(),
    onSuccess: (data) => {
      const voices = Array.isArray(data) ? data : (data?.voices || []);
      if (voices.length > 0) {
        const defaultVoice = voices.find(v => v.isDefault) || voices[0];
        setSelectedVoice(defaultVoice);
      }
    }
  });

  const { 
    data: audioMetrics, 
    isLoading: audioMetricsLoading, 
    error: audioMetricsError,
    refetch: refetchAudioMetrics
  } = useQuery({
    queryKey: ['audio-metrics', callQualityTimeRange],
    queryFn: () => configService.getAudioMetrics(callQualityTimeRange),
    refetchInterval: 30000
  });

  const { 
    data: historicalMetrics, 
    isLoading: historicalLoading 
  } = useQuery({
    queryKey: ['historical-audio-metrics', callQualityTimeRange],
    queryFn: () => configService.getHistoricalAudioMetrics(callQualityTimeRange, 20),
    refetchInterval: 30000
  });

  const { 
    data: recentCallsData, 
    isLoading: recentCallsLoading 
  } = useQuery({
    queryKey: ['recent-calls-quality', callQualityFilter],
    queryFn: () => configService.getRecentCallsWithQuality(50, callQualityFilter || null),
    refetchInterval: 30000
  });

  // Model/voice compatibility
  const selectedModelId = watch('selectedModel') || watch('selectedModelId');
  const selectedVoiceId = watch('selectedVoice');
  const { voices, compatibleVoices, getCompatibleVoices: getCompatibleVoicesForModel } = useModelVoiceCompatibility(selectedModelId, selectedVoiceId, setValue);
  const { fallbackChain, setFallbackChain, handleDragEnd: handleFallbackChainDragEnd } = useFallbackChain([], selectedModelId);

  // Load model ranges
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

  // Effects
  useEffect(() => {
    const fetchAIConfig = async () => {
      try {
        const config = await aiService.getConfig();
        if (config?.model?.id) {
          setValue('selectedModel', config.model.id);
          setValue('selectedModelId', config.model.id);
          const currentVoiceId = config?.voice?.id || 'ash';
          if (config?.model?.fallbackChain && config.model.fallbackChain.length > 0) {
            let chain = [...config.model.fallbackChain];
            chain = chain.map(item => {
              if (typeof item === 'string') {
                return { modelId: item, voiceId: currentVoiceId };
              }
              if (item && typeof item === 'object' && item.modelId) {
                return {
                  modelId: item.modelId,
                  voiceId: item.voiceId || currentVoiceId
                };
              }
              return null;
            }).filter(item => item !== null);
            
            chain = chain.filter(item => item.modelId !== config.model.id);
            chain = [{ modelId: config.model.id, voiceId: currentVoiceId }, ...chain];
            setTimeout(() => setFallbackChain(chain), 0);
          } else {
            setTimeout(() => setFallbackChain([{ modelId: config.model.id, voiceId: currentVoiceId }]), 0);
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
  }, [setValue, setFallbackChain]);

  useEffect(() => {
    const modelId = watch('selectedModelId');
    if (modelId) {
      loadModelRanges(modelId);
    } else {
      setModelRanges(null);
    }
  }, [watch('selectedModelId')]);

  // Mutations
  const saveConfigMutation = useMutation({
    mutationFn: async (data) => {
      let finalFallbackChain = [...fallbackChain];
      if (data.selectedModel) {
        finalFallbackChain = finalFallbackChain.filter(item => {
          const itemModelId = typeof item === 'string' ? item : item.modelId;
          return itemModelId !== data.selectedModel;
        });
        finalFallbackChain = [{ modelId: data.selectedModel, voiceId: data.selectedVoice || data.defaultVoice?.id || 'ash' }, ...finalFallbackChain];
      }
      
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

  const voicePreviewMutation = useMutation({
    mutationFn: ({ voiceId, text }) => voiceService.previewVoice(voiceId, text),
    onSuccess: (data) => {
      console.log('Voice preview:', data);
      showSuccess('Voice preview generated');
    },
    onError: () => showError('Failed to generate voice preview')
  });

  return {
    // Form
    control,
    handleSubmit,
    watch,
    setValue,
    
    // State
    addNumberDialog,
    setAddNumberDialog,
    editNumberDialog,
    setEditNumberDialog,
    deleteNumberDialog,
    setDeleteNumberDialog,
    numberToEdit,
    setNumberToEdit,
    numberToDelete,
    setNumberToDelete,
    addTransferNumberDialog,
    setAddTransferNumberDialog,
    editTransferNumberDialog,
    setEditTransferNumberDialog,
    transferNumberToEdit,
    setTransferNumberToEdit,
    voicePreviewDialog,
    setVoicePreviewDialog,
    selectedVoice,
    setSelectedVoice,
    isPlaying,
    setIsPlaying,
    modelRanges,
    setModelRanges,
    selectedNumberForProfile,
    setSelectedNumberForProfile,
    numberProfileDialog,
    setNumberProfileDialog,
    callQualityTimeRange,
    setCallQualityTimeRange,
    callQualityFilter,
    setCallQualityFilter,
    
    // Queries
    voicesData,
    voicesLoading,
    audioMetrics,
    audioMetricsLoading,
    audioMetricsError,
    refetchAudioMetrics,
    historicalMetrics,
    historicalLoading,
    recentCallsData,
    recentCallsLoading,
    audioLoading,
    telephonyLoading,
    availableModels,
    languageMappings,
    mappingsLoading,
    previewingVoice,
    setPreviewingVoice,
    capabilitiesLoading,
    voices,
    compatibleVoices,
    getCompatibleVoicesForModel,
    fallbackChain,
    setFallbackChain,
    handleFallbackChainDragEnd,
    
    // Mutations
    saveConfigMutation,
    voicePreviewMutation,
    
    // Query client
    queryClient,
    
    // Toast
    showSuccess,
    showError,
    
    // Helpers
    loadModelRanges
  };
};



