import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import conversationBehaviorService from '../services/conversationBehaviorService.js';
import { useToast } from '../components/common/ToastProvider.jsx';

export const useConversationBehavior = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Fetch configuration
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['conversationBehaviorConfig'],
    queryFn: async () => {
      const response = await conversationBehaviorService.getConfig();
      // Handle normalized response structure
      return response?.data?.config || response?.config || response?.data || response;
    },
    staleTime: 30000, // 30 seconds
    retry: 2
  });

  // Update configuration mutation
  const updateMutation = useMutation({
    mutationFn: async (configData) => {
      const response = await conversationBehaviorService.updateConfig(configData);
      // Handle normalized response structure
      return response?.data?.config || response?.config || response?.data || response;
    },
    onSuccess: (updatedConfig) => {
      queryClient.setQueryData(['conversationBehaviorConfig'], updatedConfig);
      addToast({
        message: 'Conversation behavior configuration updated successfully',
        severity: 'success'
      });
    },
    onError: (error) => {
      addToast({
        message: error.response?.data?.error || 'Failed to update conversation behavior configuration',
        severity: 'error'
      });
    }
  });

  return {
    config: data,
    isLoading,
    error,
    refetch,
    updateConfig: updateMutation.mutate,
    isUpdating: updateMutation.isPending
  };
};

