import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import languageVoiceService from '../services/languageVoiceService';
import { useToast } from '../components/common/ToastProvider';
import { QUERY_INTERVALS } from '../constants/configDefaults';

/**
 * Custom hook for language/voice mappings management
 * @returns {Object} { mappings, isLoading, error, refetch, updateMapping, saveMappings, previewingVoice, setPreviewingVoice }
 */
export const useLanguageVoiceMappings = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [localMappings, setLocalMappings] = useState([]);
  const [previewingVoice, setPreviewingVoice] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['language-voice-mappings'],
    queryFn: languageVoiceService.getLanguageMappings,
    refetchInterval: QUERY_INTERVALS.LANGUAGE_VOICE_MAPPINGS,
    staleTime: QUERY_INTERVALS.LANGUAGE_VOICE_MAPPINGS
  });

  // Update local state when data is fetched
  useEffect(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      setLocalMappings(data);
    }
  }, [data]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries(['language-voice-mappings']);
  }, [queryClient]);

  const updateMapping = useCallback((languageCode, field, value) => {
    setLocalMappings(prev => 
      prev.map(mapping => 
        mapping.languageCode === languageCode 
          ? { ...mapping, [field]: value }
          : mapping
      )
    );
  }, []);

  const saveMappings = useCallback(async () => {
    try {
      const mappingsToSave = localMappings.map(mapping => ({
        languageCode: mapping.languageCode,
        voiceId: mapping.voiceId,
        voiceName: mapping.voiceName,
        isActive: mapping.isActive
      }));
      
      await languageVoiceService.bulkUpdateLanguageMappings(mappingsToSave);
      showSuccess('Language/voice mappings saved successfully');
      invalidate();
      return mappingsToSave;
    } catch (error) {
      showError('Failed to save language/voice mappings');
      throw error;
    }
  }, [localMappings, showSuccess, showError, invalidate]);

  return {
    mappings: localMappings.length > 0 ? localMappings : (Array.isArray(data) ? data : []),
    isLoading,
    error,
    refetch,
    invalidate,
    updateMapping,
    saveMappings,
    previewingVoice,
    setPreviewingVoice
  };
};

