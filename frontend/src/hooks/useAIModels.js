import { useQuery, useQueryClient } from '@tanstack/react-query';
import aiService from '../services/aiService';
import { QUERY_INTERVALS } from '../constants/configDefaults';

/**
 * Custom hook for fetching AI models
 * @param {boolean} forceRefresh - Force refresh from API
 * @returns {Object} { models, isLoading, error, refetch, invalidate }
 */
export const useAIModels = (forceRefresh = false) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-models', forceRefresh],
    queryFn: () => aiService.getModels(forceRefresh),
    refetchInterval: QUERY_INTERVALS.AI_MODELS,
    staleTime: QUERY_INTERVALS.AI_MODELS
  });

  const invalidate = () => {
    queryClient.invalidateQueries(['ai-models']);
  };

  return {
    models: Array.isArray(data) ? data : [],
    isLoading,
    error,
    refetch,
    invalidate
  };
};

