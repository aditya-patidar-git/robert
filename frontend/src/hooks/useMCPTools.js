import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import mcpToolsService from '../services/mcpToolsService';
import { useToast } from '../components/common/ToastProvider';
import { QUERY_INTERVALS } from '../constants/configDefaults';

/**
 * Custom hook for MCP tools management
 * @returns {Object} { tools, isLoading, error, refetch, enableTool, disableTool, updateRateLimit, updateDomainAllowlist }
 */
export const useMCPTools = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: mcpToolsService.getAllTools,
    refetchInterval: QUERY_INTERVALS.MCP_TOOLS,
    staleTime: QUERY_INTERVALS.MCP_TOOLS
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries(['mcp-tools']);
  }, [queryClient]);

  const enableTool = useCallback(async (toolName) => {
    try {
      await mcpToolsService.enableTool(toolName);
      showSuccess(`Tool ${toolName} enabled`);
      invalidate();
    } catch (error) {
      showError(`Failed to enable tool ${toolName}`);
      throw error;
    }
  }, [showSuccess, showError, invalidate]);

  const disableTool = useCallback(async (toolName) => {
    try {
      await mcpToolsService.disableTool(toolName);
      showSuccess(`Tool ${toolName} disabled`);
      invalidate();
    } catch (error) {
      showError(`Failed to disable tool ${toolName}`);
      throw error;
    }
  }, [showSuccess, showError, invalidate]);

  const updateRateLimit = useCallback(async (toolName, newLimit) => {
    try {
      if (newLimit < 1 || newLimit > 1000) {
        showError('Rate limit must be between 1 and 1000');
        return;
      }
      await mcpToolsService.updateRateLimit(toolName, newLimit);
      showSuccess(`Rate limit updated for ${toolName}`);
      invalidate();
    } catch (error) {
      showError(`Failed to update rate limit for ${toolName}`);
      throw error;
    }
  }, [showSuccess, showError, invalidate]);

  const updateDomainAllowlist = useCallback(async (toolName, domains) => {
    try {
      await mcpToolsService.updateDomainAllowlist(toolName, domains);
      showSuccess(`Domain allowlist updated for ${toolName}`);
      invalidate();
    } catch (error) {
      showError(`Failed to update domain allowlist for ${toolName}`);
      throw error;
    }
  }, [showSuccess, showError, invalidate]);

  return {
    tools: Array.isArray(data) ? data : [],
    isLoading,
    error,
    refetch,
    invalidate,
    enableTool,
    disableTool,
    updateRateLimit,
    updateDomainAllowlist
  };
};

