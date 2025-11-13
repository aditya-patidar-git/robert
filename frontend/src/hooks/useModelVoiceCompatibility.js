import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import aiService from '../services/aiService';
import voiceService from '../services/voiceService';
import { getCompatibleVoices, isVoiceCompatibleWithModel } from '../utils/modelCompatibility';

/**
 * Custom hook for model/voice compatibility management
 * @param {string} selectedModelId - Currently selected model ID
 * @param {string} selectedVoiceId - Currently selected voice ID
 * @param {Function} setValue - React Hook Form setValue function (optional)
 * @returns {Object} { models, voices, compatibleVoices, isCompatible, clearIncompatibleVoice }
 */
export const useModelVoiceCompatibility = (selectedModelId, selectedVoiceId = null, setValue = null) => {
  // Fetch models
  const { data: modelsData } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => aiService.getModels()
  });

  // Fetch voices
  const { data: voicesData } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices()
  });

  const models = Array.isArray(modelsData) ? modelsData : [];
  const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);

  // Get compatible voices for selected model
  const compatibleVoices = useCallback(() => {
    return getCompatibleVoices(selectedModelId, voices, models);
  }, [selectedModelId, voices, models]);

  // Check if current voice is compatible
  const isCompatible = useCallback(() => {
    if (!selectedModelId || !selectedVoiceId) return true;
    return isVoiceCompatibleWithModel(selectedVoiceId, selectedModelId, voices, models);
  }, [selectedModelId, selectedVoiceId, voices, models]);

  // Clear voice if incompatible
  useEffect(() => {
    if (selectedModelId && selectedVoiceId && setValue) {
      const compatible = isVoiceCompatibleWithModel(selectedVoiceId, selectedModelId, voices, models);
      if (!compatible) {
        setValue('selectedVoice', '');
      }
    }
  }, [selectedModelId, selectedVoiceId, voices, models, setValue]);

  return {
    models,
    voices,
    compatibleVoices: compatibleVoices(),
    isCompatible: isCompatible(),
    getCompatibleVoices: (modelId) => getCompatibleVoices(modelId, voices, models)
  };
};

