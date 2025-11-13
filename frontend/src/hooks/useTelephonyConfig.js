import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import configService from '../services/configService';
import { useToast } from '../components/common/ToastProvider';
import { TELEPHONY_CONFIG_DEFAULTS } from '../constants/configDefaults';

/**
 * Custom hook for telephony configuration management
 * @param {Object} formMethods - React Hook Form methods (setValue, watch, etc.)
 * @returns {Object} { config, isLoading, error, saveConfig, updateConfig }
 */
export const useTelephonyConfig = (formMethods = null) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const { setValue } = formMethods || {};

  const { data, isLoading, error } = useQuery({
    queryKey: ['telephony-config'],
    queryFn: configService.getTelephonyConfig
  });

  // Update form values when config is loaded
  useEffect(() => {
    if (data?.config && setValue) {
      const config = data.config;
      setValue('outboundCallerId', config.outboundCallerId ?? TELEPHONY_CONFIG_DEFAULTS.outboundCallerId);
      if (config.afterHoursPolicy) {
        setValue('afterHoursPolicy', config.afterHoursPolicy);
      }
      if (config.voicemailSettings) {
        setValue('voicemailSettings', config.voicemailSettings);
      }
      if (config.sipSettings) {
        setValue('sipSettings', config.sipSettings);
      }
      if (config.numbers) {
        setValue('numbers', config.numbers);
      }
      if (config.transferNumbers) {
        setValue('transferNumbers', config.transferNumbers);
      }
    }
  }, [data, setValue]);

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

