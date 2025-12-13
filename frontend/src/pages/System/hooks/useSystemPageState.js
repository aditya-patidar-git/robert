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
      if (data?.data) {
        // Config is already in the correct format from the backend
      }
    }
  });

  // Transform backend config to frontend format
  // The service normalizes the response, so data is in crmTasksConfigData.data
  const crmTasksConfig = crmTasksConfigData?.data || {
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
      // Handle normalized response structure
      // Backend returns { success: true, config: {...} }
      // Service normalizes to { success: true, data: {...} }
      const config = data?.data?.config || data?.config || data?.data || data;
      
      if (config) {
        Object.keys(config).forEach(key => {
          if (key in control._defaultValues) {
            setValue(key, config[key]);
          }
        });
      }
    }
  });

  // Update form values when system config is loaded (useEffect for reliability)
  useEffect(() => {
    if (systemConfig) {
      // Handle normalized response structure
      const config = systemConfig?.data?.config || systemConfig?.config || systemConfig?.data || systemConfig;
      
      if (config) {
        Object.keys(config).forEach(key => {
          if (key in control._defaultValues) {
            setValue(key, config[key]);
          }
        });
      }
    }
  }, [systemConfig, setValue, control]);

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
    mutationFn: (data) => systemService.updateSystemConfig(data),
    onSuccess: () => {
      showSuccess('System configuration saved successfully');
      queryClient.invalidateQueries(['system-config']);
    },
    onError: (error) => {
      console.error('System config save error:', error);
      showError(`Failed to save system configuration: ${error.message || 'Unknown error'}`);
    }
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
    mutationFn: (config) => configService.updateCRMTasksConfig(config),
    onSuccess: () => {
      showSuccess('CRM tasks configuration saved successfully');
      queryClient.invalidateQueries(['crm-tasks-config']);
    },
    onError: (error) => {
      console.error('CRM tasks config save error:', error);
      showError(`Failed to save CRM tasks configuration: ${error.message || 'Unknown error'}`);
    }
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
    // Validate that crmTasksConfig exists and has the required structure
    if (!crmTasksConfig) {
      showError('CRM tasks configuration is not loaded. Please refresh the page.');
      console.error('crmTasksConfig is undefined');
      return;
    }

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

    // Validate that all required properties exist
    const hasInvalidData = Object.values(configData).some(value => value === undefined);
    if (hasInvalidData) {
      showError('Invalid configuration data. Please check all fields are properly set.');
      console.error('Invalid configData:', configData);
      console.error('crmTasksConfig:', crmTasksConfig);
      return;
    }

    console.log('Saving CRM tasks config:', configData);
    saveCRMTasksConfigMutation.mutate(configData, {
      onError: (error) => {
        console.error('Failed to save CRM tasks config:', error);
        showError(`Failed to save CRM tasks configuration: ${error.message || 'Unknown error'}`);
      }
    });
  };

  const handleCrmTaskToggle = (taskKey, field, value) => {
    // Update local state optimistically
    // The actual save happens when handleSaveCrmTasksConfig is called
    queryClient.setQueryData(['crm-tasks-config'], (oldData) => {
      if (!oldData?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data,
          [taskKey]: {
            ...oldData.data[taskKey],
            [field]: value
          }
        }
      };
    });
  };

  const handleCrmGeneralToggle = (field, value) => {
    // Update local state optimistically
    queryClient.setQueryData(['crm-tasks-config'], (oldData) => {
      if (!oldData?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data,
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



