import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import privacyService from '../../../services/privacyService';
import dsarService from '../../../services/dsarService';
import auditLogService from '../../../services/auditLogService';

/**
 * Custom hook for Privacy page state management
 * Centralizes all state, data fetching, and mutations
 */
export function usePrivacyPageState() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedDSAR, setSelectedDSAR] = useState(null);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [consentScriptDialogOpen, setConsentScriptDialogOpen] = useState(false);
  const [privacyNoticeDialogOpen, setPrivacyNoticeDialogOpen] = useState(false);
  const [retentionDialogOpen, setRetentionDialogOpen] = useState(false);
  const [breachDialogOpen, setBreachDialogOpen] = useState(false);

  // Fetch privacy configuration
  const { data: privacyConfig, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['privacyConfig'],
    queryFn: () => privacyService.getConfig()
  });

  // Fetch DSAR requests
  const { data: dsarRequests, isLoading: dsarLoading, refetch: refetchDSAR } = useQuery({
    queryKey: ['dsarRequests'],
    queryFn: () => dsarService.getRequests()
  });

  // Fetch audit logs
  const { data: auditLogs, isLoading: auditLogsLoading, refetch: refetchAuditLogs } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => auditLogService.getLogs({ limit: 100 })
  });

  // Update privacy configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: (data) => privacyService.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['privacyConfig']);
    }
  });

  // Create DSAR request mutation
  const createDSARMutation = useMutation({
    mutationFn: (data) => dsarService.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dsarRequests']);
    }
  });

  // Update DSAR request mutation
  const updateDSARMutation = useMutation({
    mutationFn: ({ id, data }) => dsarService.updateRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dsarRequests']);
    }
  });

  // Export DSAR data mutation
  const exportDSARMutation = useMutation({
    mutationFn: (requestId) => dsarService.exportData(requestId),
    onSuccess: (data) => {
      setExportData(data);
      setExportPreviewOpen(true);
    }
  });

  // Report data breach mutation
  const reportBreachMutation = useMutation({
    mutationFn: (data) => privacyService.reportBreach(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['auditLogs']);
    }
  });

  // Update consent script
  const handleUpdateConsentScript = useCallback(async (script) => {
    try {
      await updateConfigMutation.mutateAsync({
        consentScript: script
      });
    } catch (error) {
      console.error('Failed to update consent script:', error);
      throw error;
    }
  }, [updateConfigMutation]);

  // Update privacy notice
  const handleUpdatePrivacyNotice = useCallback(async (notice) => {
    try {
      await updateConfigMutation.mutateAsync({
        privacyNotice: notice
      });
    } catch (error) {
      console.error('Failed to update privacy notice:', error);
      throw error;
    }
  }, [updateConfigMutation]);

  // Update data retention settings
  const handleUpdateRetention = useCallback(async (settings) => {
    try {
      await updateConfigMutation.mutateAsync({
        dataRetention: settings
      });
    } catch (error) {
      console.error('Failed to update retention settings:', error);
      throw error;
    }
  }, [updateConfigMutation]);

  // Handle DSAR request creation
  const handleCreateDSAR = useCallback(async (data) => {
    try {
      await createDSARMutation.mutateAsync(data);
    } catch (error) {
      console.error('Failed to create DSAR request:', error);
      throw error;
    }
  }, [createDSARMutation]);

  // Handle DSAR request update
  const handleUpdateDSAR = useCallback(async (id, data) => {
    try {
      await updateDSARMutation.mutateAsync({ id, data });
    } catch (error) {
      console.error('Failed to update DSAR request:', error);
      throw error;
    }
  }, [updateDSARMutation]);

  // Handle DSAR export
  const handleExportDSAR = useCallback(async (requestId) => {
    try {
      await exportDSARMutation.mutateAsync(requestId);
    } catch (error) {
      console.error('Failed to export DSAR data:', error);
      throw error;
    }
  }, [exportDSARMutation]);

  // Handle data breach report
  const handleReportBreach = useCallback(async (data) => {
    try {
      await reportBreachMutation.mutateAsync(data);
      setBreachDialogOpen(false);
    } catch (error) {
      console.error('Failed to report data breach:', error);
      throw error;
    }
  }, [reportBreachMutation]);

  return {
    // State
    activeTab,
    setActiveTab,
    selectedDSAR,
    setSelectedDSAR,
    exportPreviewOpen,
    setExportPreviewOpen,
    exportData,
    setExportData,
    consentScriptDialogOpen,
    setConsentScriptDialogOpen,
    privacyNoticeDialogOpen,
    setPrivacyNoticeDialogOpen,
    retentionDialogOpen,
    setRetentionDialogOpen,
    breachDialogOpen,
    setBreachDialogOpen,

    // Data
    privacyConfig,
    configLoading,
    dsarRequests,
    dsarLoading,
    auditLogs,
    auditLogsLoading,

    // Mutations
    updateConfigMutation,
    createDSARMutation,
    updateDSARMutation,
    exportDSARMutation,
    reportBreachMutation,

    // Handlers
    handleUpdateConsentScript,
    handleUpdatePrivacyNotice,
    handleUpdateRetention,
    handleCreateDSAR,
    handleUpdateDSAR,
    handleExportDSAR,
    handleReportBreach,

    // Refetch functions
    refetchConfig,
    refetchDSAR,
    refetchAuditLogs
  };
}

