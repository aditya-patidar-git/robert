/**
 * Utility functions for managing fallback chains
 */

/**
 * Extract model ID from fallback chain item (handles both string and object formats)
 * @param {string|Object} item - Fallback chain item
 * @returns {string} Model ID
 */
export const getModelIdFromChainItem = (item) => {
  if (typeof item === 'string') {
    return item;
  }
  if (item && typeof item === 'object' && item.modelId) {
    return item.modelId;
  }
  return null;
};

/**
 * Extract voice ID from fallback chain item
 * @param {string|Object} item - Fallback chain item
 * @returns {string|undefined} Voice ID
 */
export const getVoiceIdFromChainItem = (item) => {
  if (typeof item === 'string') {
    return undefined;
  }
  if (item && typeof item === 'object' && item.voiceId) {
    return item.voiceId;
  }
  return undefined;
};

/**
 * Get all model IDs from fallback chain
 * @param {Array} fallbackChain - Array of fallback chain items
 * @returns {Array} Array of model IDs
 */
export const getModelIdsFromChain = (fallbackChain = []) => {
  return fallbackChain
    .map(item => getModelIdFromChainItem(item))
    .filter(id => id !== null);
};

/**
 * Check if a model exists in the fallback chain
 * @param {Array} fallbackChain - Array of fallback chain items
 * @param {string} modelId - Model ID to check
 * @returns {boolean} True if model exists in chain
 */
export const isModelInChain = (fallbackChain = [], modelId) => {
  if (!modelId) return false;
  return getModelIdsFromChain(fallbackChain).includes(modelId);
};

/**
 * Check if a model+voice combination exists in the fallback chain
 * @param {Array} fallbackChain - Array of fallback chain items
 * @param {string} modelId - Model ID
 * @param {string} voiceId - Voice ID
 * @returns {boolean} True if combination exists in chain
 */
export const isModelVoiceInChain = (fallbackChain = [], modelId, voiceId) => {
  if (!modelId || !voiceId) return false;
  return fallbackChain.some(item => {
    const itemModelId = getModelIdFromChainItem(item);
    const itemVoiceId = getVoiceIdFromChainItem(item);
    return itemModelId === modelId && itemVoiceId === voiceId;
  });
};

/**
 * Normalize fallback chain to consistent format
 * @param {Array} fallbackChain - Array of fallback chain items
 * @param {string} defaultVoiceId - Default voice ID to use if missing
 * @returns {Array} Normalized fallback chain
 */
export const normalizeFallbackChain = (fallbackChain = [], defaultVoiceId = null) => {
  return fallbackChain.map(item => {
    const modelId = getModelIdFromChainItem(item);
    const voiceId = getVoiceIdFromChainItem(item) || defaultVoiceId;
    
    if (!modelId) return null;
    
    return {
      modelId,
      voiceId: voiceId || undefined
    };
  }).filter(item => item !== null);
};

