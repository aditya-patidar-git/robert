import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import configService from '../services/configService';
import { useToast } from '../components/common/ToastProvider';
import { TELEPHONY_CONFIG_DEFAULTS } from '../constants/configDefaults';

/**
 * Custom hook for telephony configuration management
 * @param {Object} formMethods - React Hook Form methods (setValue, watch, reset, etc.)
 * @returns {Object} { config, isLoading, error, saveConfig, updateConfig }
 */
export const useTelephonyConfig = (formMethods = null) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const { setValue, reset } = formMethods || {};
  const hasInitialized = useRef(false);
  const lastConfigId = useRef(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['telephony-config'],
    queryFn: configService.getTelephonyConfig
  });

  // Update form values when config is loaded or updated
  useEffect(() => {
    if (data?.config) {
      const config = data.config;
      const configId = config._id || config.updatedAt || JSON.stringify(config);
      
      // Use reset for initial load to ensure all nested objects are properly set
      if (!hasInitialized.current && reset) {
        hasInitialized.current = true;
        lastConfigId.current = configId;
        reset({
          outboundCallerId: config.outboundCallerId ?? TELEPHONY_CONFIG_DEFAULTS.outboundCallerId,
          afterHoursPolicy: config.afterHoursPolicy ? { ...config.afterHoursPolicy } : undefined,
          voicemailSettings: config.voicemailSettings ? { ...config.voicemailSettings } : undefined,
          sipSettings: config.sipSettings ? { ...config.sipSettings } : undefined,
          numbers: config.numbers ? [...config.numbers] : [],
          transferNumbers: config.transferNumbers ? [...config.transferNumbers] : []
        }, { keepDefaultValues: true });
      } 
      // For subsequent updates (after save), use setValue
      else if (setValue && lastConfigId.current !== configId) {
        lastConfigId.current = configId;
        setValue('outboundCallerId', config.outboundCallerId ?? TELEPHONY_CONFIG_DEFAULTS.outboundCallerId, { shouldDirty: false, shouldValidate: false });
        
        // Update nested objects - create new object references to ensure UI updates
        if (config.afterHoursPolicy) {
          setValue('afterHoursPolicy', { ...config.afterHoursPolicy }, { shouldDirty: false, shouldValidate: false });
        }
        if (config.voicemailSettings) {
          setValue('voicemailSettings', { ...config.voicemailSettings }, { shouldDirty: false, shouldValidate: false });
        }
        if (config.sipSettings) {
          setValue('sipSettings', { ...config.sipSettings }, { shouldDirty: false, shouldValidate: false });
        }
        if (config.numbers) {
          setValue('numbers', [...(config.numbers || [])], { shouldDirty: false, shouldValidate: false });
        }
        if (config.transferNumbers) {
          setValue('transferNumbers', [...(config.transferNumbers || [])], { shouldDirty: false, shouldValidate: false });
        }
      }
    }
  }, [data, setValue, reset]);

  const saveConfigMutation = useMutation({
    mutationFn: configService.updateTelephonyConfig,
    onSuccess: () => {
      showSuccess('Telephony configuration saved successfully');
      queryClient.invalidateQueries(['telephony-config']);
    },
    onError: () => {
      showError('Failed to save telephony configuration');
    }
  });

  return {
    config: data?.config || null,
    isLoading,
    error,
    saveConfig: saveConfigMutation.mutate,
    updateConfig: saveConfigMutation.mutate,
    isSaving: saveConfigMutation.isLoading
  };
};

