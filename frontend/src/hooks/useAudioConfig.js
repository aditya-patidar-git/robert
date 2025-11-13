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
  const { setValue } = formMethods || {};

  const { data, isLoading, error } = useQuery({
    queryKey: ['audio-config'],
    queryFn: configService.getAudioConfig
  });

  // Update form values when config is loaded
  useEffect(() => {
    if (data?.config && setValue) {
      const config = data.config;
      setValue('vadThreshold', config.vadThreshold ?? AUDIO_CONFIG_DEFAULTS.vadThreshold);
      setValue('startPadding', config.startPadding ?? AUDIO_CONFIG_DEFAULTS.startPadding);
      setValue('endPadding', config.endPadding ?? AUDIO_CONFIG_DEFAULTS.endPadding);
      setValue('bargeInPolicy', config.bargeInPolicy ?? AUDIO_CONFIG_DEFAULTS.bargeInPolicy);
      setValue('noiseSuppression', config.noiseSuppression ?? AUDIO_CONFIG_DEFAULTS.noiseSuppression);
      setValue('noiseSuppressionAlgorithm', config.noiseSuppressionAlgorithm ?? AUDIO_CONFIG_DEFAULTS.noiseSuppressionAlgorithm);
      setValue('echoCancellation', config.echoCancellation ?? AUDIO_CONFIG_DEFAULTS.echoCancellation);
      setValue('automaticGainControl', config.automaticGainControl ?? AUDIO_CONFIG_DEFAULTS.automaticGainControl);
      setValue('audioQuality', config.audioQuality ?? AUDIO_CONFIG_DEFAULTS.audioQuality);
      setValue('energyThreshold', config.energyThreshold ?? AUDIO_CONFIG_DEFAULTS.energyThreshold);
      setValue('energyThresholdAutoCalibrate', config.energyThresholdAutoCalibrate ?? AUDIO_CONFIG_DEFAULTS.energyThresholdAutoCalibrate);
    }
  }, [data, setValue]);

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
    config: data?.config || null,
    isLoading,
    error,
    saveConfig: saveConfigMutation.mutate,
    updateConfig: saveConfigMutation.mutate,
    isSaving: saveConfigMutation.isLoading
  };
};

