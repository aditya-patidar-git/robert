import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/common/ToastProvider';
import systemService from '../../../services/systemService';
import configService from '../../../services/configService';
import { useAIModels } from '../../../hooks/useAIModels';
import { useModelCapabilities } from '../../../hooks/useModelCapabilities';
import { useAudioConfig } from '../../../hooks/useAudioConfig';
import { useTelephonyConfig } from '../../../hooks/useTelephonyConfig';

export const useSystemPageState = () => {
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
  const { isLoading: audioLoading, saveConfig: saveAudioConfig, isSaving: isSavingAudio } = useAudioConfig({ setValue, watch });
  const { config: telephonyConfig, isLoading: telephonyLoading, saveConfig: saveTelephonyConfig, isSaving: isSavingTelephony } = useTelephonyConfig({ setValue, watch });

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

  const handleSaveCrmTasksConfig = () => {
    // TODO: Implement save to backend when CRM config endpoint is available
    showSuccess('CRM tasks configuration saved (Note: Backend endpoint pending)');
  };

  const handleCrmTaskToggle = (taskKey, field, value) => {
    setCrmTasksConfig(prev => ({
      ...prev,
      [taskKey]: { ...prev[taskKey], [field]: value }
    }));
  };

  const handleCrmGeneralToggle = (field, value) => {
    setCrmTasksConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return {
    currentTab,
    setCurrentTab,
    isOwner,
    crmTasksConfig,
    setCrmTasksConfig,
    control,
    handleSubmit,
    watch,
    setValue,
    systemConfig,
    configLoading,
    models,
    modelsLoading,
    capabilitiesData,
    capabilitiesLoading,
    audioLoading,
    isSavingAudio,
    telephonyConfig,
    telephonyLoading,
    isSavingTelephony,
    privacyConfigData,
    privacyLoading,
    saveConfigMutation,
    savePrivacyConfigMutation,
    onSubmit,
    handleSaveAudioConfig,
    handleSaveTelephonyConfig,
    handleSavePrivacyConfig,
    handleSaveCrmTasksConfig,
    handleCrmTaskToggle,
    handleCrmGeneralToggle
  };
};



