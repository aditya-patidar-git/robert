import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import configService from '../services/configService';
import { useToast } from '../components/common/ToastProvider';
import { AUDIO_CONFIG_DEFAULTS } from '../constants/configDefaults';

/**
 * Custom hook for audio configuration management
 * @param {Object} formMethods - React Hook Form methods (setValue, watch, etc.)
 * @returns {Object} { config, isLoading, error, saveConfig, updateConfig }
 */
export const useAudioConfig = (formMethods = null) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const { setValue, reset, getValues } = formMethods || {};

  const { data, isLoading, error } = useQuery({
    queryKey: ['audio-config'],
    queryFn: configService.getAudioConfig
  });

  // Update form values when config is loaded
  useEffect(() => {
    if (!data || isLoading) {
      console.log('🔵 [AUDIO_CONFIG_DEBUG] Skipping reset - data:', !!data, 'isLoading:', isLoading);
      return;
    }
    
    // Debug: Log the actual data structure
    console.log('🔵 [AUDIO_CONFIG_DEBUG] ========== AUDIO CONFIG DATA FLOW ==========');
    console.log('🔵 [AUDIO_CONFIG_DEBUG] Raw API Response:', {
      'data': data,
      'data.data': data?.data,
      'data.config': data?.config,
      'data.success': data?.success,
      'data type': typeof data,
      'data.data type': typeof data?.data
    });
    
    // Handle normalized response structure: { success: true, data: config, ... }
    // Backend returns: { status: "success", config: {...} }
    // Normalizer with dataPath: 'config' extracts config and puts it in data.data
    const config = data?.data || data?.config;
    
    console.log('🔵 [AUDIO_CONFIG_DEBUG] Extracted Config Object:', config);
    console.log('🔵 [AUDIO_CONFIG_DEBUG] Config Type:', typeof config);
    console.log('🔵 [AUDIO_CONFIG_DEBUG] Config Keys:', config ? Object.keys(config) : 'null');
    console.log('🔵 [AUDIO_CONFIG_DEBUG] Key Values from Config:', {
      vadThreshold: config?.vadThreshold,
      startPadding: config?.startPadding,
      endPadding: config?.endPadding,
      bargeInPolicy: config?.bargeInPolicy,
      noiseSuppression: config?.noiseSuppression,
      echoCancellation: config?.echoCancellation,
      automaticGainControl: config?.automaticGainControl,
      audioQuality: config?.audioQuality
    });
    
    if (config && reset && getValues) {
      // Get current form values to preserve other fields (telephony, voice, etc.)
      const currentValues = getValues();
      
      console.log('🔵 [AUDIO_CONFIG_DEBUG] Current Form Values (before reset):', {
        vadThreshold: currentValues.vadThreshold,
        startPadding: currentValues.startPadding,
        endPadding: currentValues.endPadding
      });
      
      // Build form values with proper handling of null/undefined (but preserve falsy values like 0, false)
      const formValues = {
        ...currentValues,
        vadThreshold: config.vadThreshold !== null && config.vadThreshold !== undefined 
          ? config.vadThreshold 
          : AUDIO_CONFIG_DEFAULTS.vadThreshold,
        startPadding: config.startPadding !== null && config.startPadding !== undefined 
          ? config.startPadding 
          : AUDIO_CONFIG_DEFAULTS.startPadding,
        endPadding: config.endPadding !== null && config.endPadding !== undefined 
          ? config.endPadding 
          : AUDIO_CONFIG_DEFAULTS.endPadding,
        bargeInPolicy: config.bargeInPolicy || AUDIO_CONFIG_DEFAULTS.bargeInPolicy,
        noiseSuppression: config.noiseSuppression !== null && config.noiseSuppression !== undefined 
          ? config.noiseSuppression 
          : AUDIO_CONFIG_DEFAULTS.noiseSuppression,
        noiseSuppressionAlgorithm: config.noiseSuppressionAlgorithm || AUDIO_CONFIG_DEFAULTS.noiseSuppressionAlgorithm,
        echoCancellation: config.echoCancellation !== null && config.echoCancellation !== undefined 
          ? config.echoCancellation 
          : AUDIO_CONFIG_DEFAULTS.echoCancellation,
        automaticGainControl: config.automaticGainControl !== null && config.automaticGainControl !== undefined 
          ? config.automaticGainControl 
          : AUDIO_CONFIG_DEFAULTS.automaticGainControl,
        audioQuality: config.audioQuality || AUDIO_CONFIG_DEFAULTS.audioQuality,
        energyThreshold: config.energyThreshold !== null && config.energyThreshold !== undefined 
          ? config.energyThreshold 
          : AUDIO_CONFIG_DEFAULTS.energyThreshold,
        energyThresholdAutoCalibrate: config.energyThresholdAutoCalibrate !== null && config.energyThresholdAutoCalibrate !== undefined 
          ? config.energyThresholdAutoCalibrate 
          : AUDIO_CONFIG_DEFAULTS.energyThresholdAutoCalibrate,
      };
      
      console.log('🔵 [AUDIO_CONFIG_DEBUG] Form Values to Reset With:', {
        vadThreshold: formValues.vadThreshold,
        startPadding: formValues.startPadding,
        endPadding: formValues.endPadding,
        bargeInPolicy: formValues.bargeInPolicy,
        noiseSuppression: formValues.noiseSuppression,
        echoCancellation: formValues.echoCancellation,
        automaticGainControl: formValues.automaticGainControl,
        'comparison': {
          'config.vadThreshold': config.vadThreshold,
          'formValues.vadThreshold': formValues.vadThreshold,
          'default': AUDIO_CONFIG_DEFAULTS.vadThreshold
        }
      });
      
      // Reset form with new values - use keepDefaultValues: false to ensure values update
      reset(formValues, { 
        keepDefaultValues: false 
      });
      
      // Check form values after reset
      const valuesAfterReset = getValues();
      console.log('🔵 [AUDIO_CONFIG_DEBUG] Form Values After Reset:', {
        vadThreshold: valuesAfterReset.vadThreshold,
        startPadding: valuesAfterReset.startPadding,
        endPadding: valuesAfterReset.endPadding,
        'match check': {
          'vadThreshold matches': valuesAfterReset.vadThreshold === formValues.vadThreshold,
          'startPadding matches': valuesAfterReset.startPadding === formValues.startPadding,
          'endPadding matches': valuesAfterReset.endPadding === formValues.endPadding
        }
      });
      console.log('🔵 [AUDIO_CONFIG_DEBUG] ========== END AUDIO CONFIG DATA FLOW ==========');
    } else if (config && setValue) {
        // Fallback to setValue if reset is not available
        if (config.vadThreshold !== undefined && config.vadThreshold !== null) {
          setValue('vadThreshold', config.vadThreshold, { shouldValidate: false });
        }
        if (config.startPadding !== undefined && config.startPadding !== null) {
          setValue('startPadding', config.startPadding, { shouldValidate: false });
        }
        if (config.endPadding !== undefined && config.endPadding !== null) {
          setValue('endPadding', config.endPadding, { shouldValidate: false });
        }
        if (config.bargeInPolicy !== undefined) {
          setValue('bargeInPolicy', config.bargeInPolicy, { shouldValidate: false });
        }
        if (config.noiseSuppression !== undefined) {
          setValue('noiseSuppression', config.noiseSuppression, { shouldValidate: false });
        }
        if (config.noiseSuppressionAlgorithm !== undefined) {
          setValue('noiseSuppressionAlgorithm', config.noiseSuppressionAlgorithm, { shouldValidate: false });
        }
        if (config.echoCancellation !== undefined) {
          setValue('echoCancellation', config.echoCancellation, { shouldValidate: false });
        }
        if (config.automaticGainControl !== undefined) {
          setValue('automaticGainControl', config.automaticGainControl, { shouldValidate: false });
        }
        if (config.audioQuality !== undefined) {
          setValue('audioQuality', config.audioQuality, { shouldValidate: false });
        }
        if (config.energyThreshold !== undefined) {
          setValue('energyThreshold', config.energyThreshold, { shouldValidate: false });
        }
        if (config.energyThresholdAutoCalibrate !== undefined) {
          setValue('energyThresholdAutoCalibrate', config.energyThresholdAutoCalibrate, { shouldValidate: false });
        }
    }
  }, [data, isLoading, setValue, reset, getValues]);

  const saveConfigMutation = useMutation({
    mutationFn: configService.updateAudioConfig,
    onSuccess: () => {
      showSuccess('Audio configuration saved successfully');
      queryClient.invalidateQueries(['audio-config']);
    },
    onError: () => {
      showError('Failed to save audio configuration');
    }
  });

  return {
    config: data?.data || data?.config || null,
    isLoading,
    error,
    saveConfig: saveConfigMutation.mutate,
    updateConfig: saveConfigMutation.mutate,
    isSaving: saveConfigMutation.isLoading
  };
};

