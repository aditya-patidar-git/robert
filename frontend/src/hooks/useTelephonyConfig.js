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
    queryFn: async () => {
      console.log('🔍 [TELEPHONY_CONFIG] Query function called');
      const result = await configService.getTelephonyConfig();
      console.log('🔍 [TELEPHONY_CONFIG] Query result:', result);
      return result;
    },
    enabled: true, // Explicitly enable the query
    staleTime: 0, // Always refetch
    cacheTime: 0 // Don't cache
  });

  // Update form values when config is loaded or updated
  useEffect(() => {
    // Debug: Log the data structure
    if (data) {
      console.log('🔍 [TELEPHONY_CONFIG] Raw data:', data);
      console.log('🔍 [TELEPHONY_CONFIG] data.data:', data?.data);
      console.log('🔍 [TELEPHONY_CONFIG] data.config:', data?.config);
      console.log('🔍 [TELEPHONY_CONFIG] data.success:', data?.success);
    } else {
      console.log('🔍 [TELEPHONY_CONFIG] No data yet, isLoading:', isLoading);
    }
    
    // Handle both normalized response format { success, data: config } and direct config
    // BaseService with dataPath: 'config' normalizes to { success: true, data: config }
    const config = data?.data || data?.config || data;
    
    if (config) {
      console.log('🔍 [TELEPHONY_CONFIG] Using config:', config);
      console.log('🔍 [TELEPHONY_CONFIG] transferNumbers:', config.transferNumbers);
      console.log('🔍 [TELEPHONY_CONFIG] transferNumbers length:', config.transferNumbers?.length);
      // Use a more reliable config ID that includes transferNumbers to detect changes
      const transferNumbersStr = JSON.stringify(config.transferNumbers || []);
      const configId = `${config._id || 'default'}_${config.updatedAt || Date.now()}_${transferNumbersStr}`;
      
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
        // Always update transferNumbers - create new array reference to trigger re-render
        const newTransferNumbers = config.transferNumbers ? [...config.transferNumbers] : [];
        setValue('transferNumbers', newTransferNumbers, { shouldDirty: false, shouldValidate: false });
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

  // Handle both normalized response format { success, data: config } and direct config
  const config = data?.data || data?.config || data;

  return {
    config: config || null,
    isLoading,
    error,
    saveConfig: saveConfigMutation.mutate,
    updateConfig: saveConfigMutation.mutate,
    isSaving: saveConfigMutation.isLoading
  };
};

