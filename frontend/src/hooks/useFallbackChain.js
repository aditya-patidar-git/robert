import { useState, useCallback, useEffect } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { getModelIdFromChainItem, isModelVoiceInChain } from '../utils/fallbackChainUtils';
import { useToast } from '../components/common/ToastProvider';

/**
 * Custom hook for managing fallback chain
 * @param {Array} initialChain - Initial fallback chain
 * @param {string} primaryModelId - Primary model ID (will be excluded from chain)
 * @returns {Object} { fallbackChain, setFallbackChain, handleDragEnd, addToChain, removeFromChain, clearChain }
 */
export const useFallbackChain = (initialChain = [], primaryModelId = null) => {
  const { showSuccess, showError } = useToast();
  const [fallbackChain, setFallbackChain] = useState(initialChain);

  // Update chain when initialChain changes
  useEffect(() => {
    if (initialChain && initialChain.length > 0) {
      setFallbackChain(initialChain);
    }
  }, [initialChain]);

  // Handle drag and drop reordering
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setFallbackChain((items) => {
        const oldIndex = items.findIndex(item => {
          const itemId = getModelIdFromChainItem(item);
          return itemId === active.id;
        });
        const newIndex = items.findIndex(item => {
          const itemId = getModelIdFromChainItem(item);
          return itemId === over.id;
        });
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // Add model+voice to fallback chain
  const addToChain = useCallback((modelId, voiceId) => {
    if (!modelId || !voiceId) {
      showError('Please select both a model and a voice');
      return false;
    }

    // Check if already exists
    if (isModelVoiceInChain(fallbackChain, modelId, voiceId)) {
      showError('This model and voice combination is already in the fallback chain');
      return false;
    }

    // Don't add primary model to chain
    if (modelId === primaryModelId) {
      showError('Primary model cannot be added to fallback chain');
      return false;
    }

    setFallbackChain(prev => [...prev, { modelId, voiceId }]);
    showSuccess('Model and voice added to fallback chain');
    return true;
  }, [fallbackChain, primaryModelId, showSuccess, showError]);

  // Remove item from chain by index
  const removeFromChain = useCallback((index) => {
    setFallbackChain(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear entire chain
  const clearChain = useCallback(() => {
    setFallbackChain([]);
  }, []);

  return {
    fallbackChain,
    setFallbackChain,
    handleDragEnd,
    addToChain,
    removeFromChain,
    clearChain
  };
};

