import { checkModelSupportsRealtime, checkModelSupportsTTS, checkModelSupportsAudio } from '../constants/modelPatterns';

/**
 * Get compatible voices for a given model
 * @param {string} modelId - The model ID
 * @param {Array} voices - Array of available voices
 * @param {Array} models - Array of available models
 * @returns {Array} Filtered array of compatible voices
 */
export const getCompatibleVoices = (modelId, voices = [], models = []) => {
  if (!modelId || !Array.isArray(voices) || !Array.isArray(models)) {
    return voices || [];
  }

  // Find the selected model
  const selectedModel = models.find(m => m.id === modelId);
  if (!selectedModel) {
    return voices || [];
  }

  // Check model capabilities
  const modelSupportsRealtime = checkModelSupportsRealtime(modelId, selectedModel);
  const modelSupportsTTS = checkModelSupportsTTS(modelId);
  const modelSupportsAudio = checkModelSupportsAudio(modelId, selectedModel);

  // Filter voices based on model type
  if (modelSupportsRealtime) {
    // Realtime models: show only voices with realtime capability
    return voices.filter(voice => voice.capabilities?.realtime === true);
  } else if (modelSupportsTTS) {
    // TTS models: show all voices (TTS models generally support all voices)
    return voices;
  } else if (modelSupportsAudio) {
    // Other audio models: show all voices
    return voices;
  } else {
    // Non-audio models: no voices available
    return [];
  }
};

/**
 * Check if a voice is compatible with a model
 * @param {string} voiceId - The voice ID
 * @param {string} modelId - The model ID
 * @param {Array} voices - Array of available voices
 * @param {Array} models - Array of available models
 * @returns {boolean} True if voice is compatible with model
 */
export const isVoiceCompatibleWithModel = (voiceId, modelId, voices = [], models = []) => {
  const compatibleVoices = getCompatibleVoices(modelId, voices, models);
  return compatibleVoices.some(v => v.id === voiceId);
};

