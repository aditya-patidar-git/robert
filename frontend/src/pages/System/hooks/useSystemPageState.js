import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/common/ToastProvider';
import systemService from '../../../services/systemService';
import configService from '../../../services/configService';
import { useAIModels } from '../../../hooks/useAIModels';
import { useModelCapabilities } from '../../../hooks/useModelCapabilities';

export const useSystemPageState = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);

  const isOwner = user?.role === 'owner';

  // Fetch CRM tasks configuration
  const { data: crmTasksConfigData, isLoading: crmTasksLoading } = useQuery({
    queryKey: ['crm-tasks-config'],
    queryFn: () => configService.getCRMTasksConfig(),
    onSuccess: (data) => {
      if (data?.config) {
        // Config is already in the correct format from the backend
      }
    }
  });

  // Transform backend config to frontend format
  const crmTasksConfig = crmTasksConfigData?.config || {
    createBooking: { enabled: true, requireConfirmation: true },
    reschedule: { enabled: true, requireConfirmation: true },
    cancel: { enabled: true, requireConfirmation: true },
    updateRecord: { enabled: true, requireConfirmation: false },
    issueRefund: { enabled: false, requireConfirmation: true },
    dryRunEnforced: true,
    auditLogging: true
  };

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

  // Save CRM tasks configuration mutation
  const saveCRMTasksConfigMutation = useMutation({
    mutationFn: configService.updateCRMTasksConfig,
    onSuccess: () => {
      showSuccess('CRM tasks configuration saved successfully');
      queryClient.invalidateQueries(['crm-tasks-config']);
    },
    onError: () => showError('Failed to save CRM tasks configuration')
  });

  const onSubmit = (data) => {
    saveConfigMutation.mutate(data);
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
    // Prepare config data in the format expected by the backend
    const configData = {
      createBooking: crmTasksConfig.createBooking,
      reschedule: crmTasksConfig.reschedule,
      cancel: crmTasksConfig.cancel,
      updateRecord: crmTasksConfig.updateRecord,
      issueRefund: crmTasksConfig.issueRefund,
      dryRunEnforced: crmTasksConfig.dryRunEnforced,
      auditLogging: crmTasksConfig.auditLogging
    };
    saveCRMTasksConfigMutation.mutate(configData);
  };

  const handleCrmTaskToggle = (taskKey, field, value) => {
    // Update local state optimistically
    // The actual save happens when handleSaveCrmTasksConfig is called
    // For now, we'll need to update the query cache directly
    queryClient.setQueryData(['crm-tasks-config'], (oldData) => {
      if (!oldData?.config) return oldData;
      return {
        ...oldData,
        config: {
          ...oldData.config,
          [taskKey]: {
            ...oldData.config[taskKey],
            [field]: value
          }
        }
      };
    });
  };

  const handleCrmGeneralToggle = (field, value) => {
    // Update local state optimistically
    queryClient.setQueryData(['crm-tasks-config'], (oldData) => {
      if (!oldData?.config) return oldData;
      return {
        ...oldData,
        config: {
          ...oldData.config,
          [field]: value
        }
      };
    });
  };

  return {
    currentTab,
    setCurrentTab,
    isOwner,
    crmTasksConfig,
    crmTasksLoading,
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
    privacyConfigData,
    privacyLoading,
    saveConfigMutation,
    savePrivacyConfigMutation,
    saveCRMTasksConfigMutation,
    onSubmit,
    handleSavePrivacyConfig,
    handleSaveCrmTasksConfig,
    handleCrmTaskToggle,
    handleCrmGeneralToggle
  };
};



