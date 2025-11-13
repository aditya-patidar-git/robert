import { useQuery, useQueryClient } from '@tanstack/react-query';
import aiService from '../services/aiService';
import { QUERY_INTERVALS } from '../constants/configDefaults';

/**
 * Custom hook for fetching model capabilities
 * @returns {Object} { data, isLoading, error, refetch }
 */
export const useModelCapabilities = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['model-capabilities'],
    queryFn: aiService.getModelCapabilities,
    refetchInterval: QUERY_INTERVALS.MODEL_CAPABILITIES,
    staleTime: QUERY_INTERVALS.MODEL_CAPABILITIES
  });

  const invalidate = () => {
    queryClient.invalidateQueries(['model-capabilities']);
  };

  return {
    capabilities: data?.capabilities || [],
    discoveryStatus: data?.discoveryStatus || {},
    isLoading,
    error,
    refetch,
    invalidate
  };
};

