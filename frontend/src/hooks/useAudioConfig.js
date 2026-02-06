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
      return;
    }
    
    // Handle normalized response structure: { success: true, data: config, ... }
    // Backend returns: { status: "success", config: {...} }
    // Normalizer with dataPath: 'config' extracts config and puts it in data.data
    const config = data?.data || data?.config || data;
    
    // Validate that config is an object with expected properties
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return;
    }
    
    if (config && reset && getValues) {
      // Get current form values to preserve other fields (telephony, voice, etc.)
      const currentValues = getValues();
      
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
        // FIX: Use explicit null/undefined check for bargeInPolicy to handle "stop" correctly
        bargeInPolicy: config.bargeInPolicy !== null && config.bargeInPolicy !== undefined
          ? config.bargeInPolicy
          : AUDIO_CONFIG_DEFAULTS.bargeInPolicy,
        noiseSuppression: config.noiseSuppression !== null && config.noiseSuppression !== undefined 
          ? config.noiseSuppression 
          : AUDIO_CONFIG_DEFAULTS.noiseSuppression,
        // FIX: Use explicit null/undefined check for noiseSuppressionAlgorithm
        noiseSuppressionAlgorithm: config.noiseSuppressionAlgorithm !== null && config.noiseSuppressionAlgorithm !== undefined
          ? config.noiseSuppressionAlgorithm
          : AUDIO_CONFIG_DEFAULTS.noiseSuppressionAlgorithm,
        echoCancellation: config.echoCancellation !== null && config.echoCancellation !== undefined 
          ? config.echoCancellation 
          : AUDIO_CONFIG_DEFAULTS.echoCancellation,
        automaticGainControl: config.automaticGainControl !== null && config.automaticGainControl !== undefined 
          ? config.automaticGainControl 
          : AUDIO_CONFIG_DEFAULTS.automaticGainControl,
        // FIX: Use explicit null/undefined check for audioQuality
        audioQuality: config.audioQuality !== null && config.audioQuality !== undefined
          ? config.audioQuality
          : AUDIO_CONFIG_DEFAULTS.audioQuality,
        energyThreshold: config.energyThreshold !== null && config.energyThreshold !== undefined 
          ? config.energyThreshold 
          : AUDIO_CONFIG_DEFAULTS.energyThreshold,
        energyThresholdAutoCalibrate: config.energyThresholdAutoCalibrate !== null && config.energyThresholdAutoCalibrate !== undefined 
          ? config.energyThresholdAutoCalibrate 
          : AUDIO_CONFIG_DEFAULTS.energyThresholdAutoCalibrate,
        transcriptionModel: config.transcriptionModel !== null && config.transcriptionModel !== undefined
          ? config.transcriptionModel
          : AUDIO_CONFIG_DEFAULTS.transcriptionModel,
      };
      
      // Reset form with new values - use keepDefaultValues: false to ensure values update
      reset(formValues, { 
        keepDefaultValues: false 
      });
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
        // FIX: Use explicit null/undefined check for bargeInPolicy
        if (config.bargeInPolicy !== undefined && config.bargeInPolicy !== null) {
          setValue('bargeInPolicy', config.bargeInPolicy, { shouldValidate: false });
        }
        if (config.noiseSuppression !== undefined) {
          setValue('noiseSuppression', config.noiseSuppression, { shouldValidate: false });
        }
        // FIX: Use explicit null/undefined check for noiseSuppressionAlgorithm
        if (config.noiseSuppressionAlgorithm !== undefined && config.noiseSuppressionAlgorithm !== null) {
          setValue('noiseSuppressionAlgorithm', config.noiseSuppressionAlgorithm, { shouldValidate: false });
        }
        if (config.echoCancellation !== undefined) {
          setValue('echoCancellation', config.echoCancellation, { shouldValidate: false });
        }
        if (config.automaticGainControl !== undefined) {
          setValue('automaticGainControl', config.automaticGainControl, { shouldValidate: false });
        }
        // FIX: Use explicit null/undefined check for audioQuality
        if (config.audioQuality !== undefined && config.audioQuality !== null) {
          setValue('audioQuality', config.audioQuality, { shouldValidate: false });
        }
        if (config.energyThreshold !== undefined) {
          setValue('energyThreshold', config.energyThreshold, { shouldValidate: false });
        }
        if (config.energyThresholdAutoCalibrate !== undefined) {
          setValue('energyThresholdAutoCalibrate', config.energyThresholdAutoCalibrate, { shouldValidate: false });
        }
        if (config.transcriptionModel !== undefined && config.transcriptionModel !== null) {
          setValue('transcriptionModel', config.transcriptionModel, { shouldValidate: false });
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

