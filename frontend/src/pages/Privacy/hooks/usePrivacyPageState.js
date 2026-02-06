import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import privacyService from '../../../services/privacyService';
import dsarService from '../../../services/dsarService';
import auditLogService from '../../../services/auditLogService';
import configService from '../../../services/configService';
import { useToast } from '../../../components/common/ToastProvider';

/**
 * Custom hook for Privacy page state management
 * Centralizes all state, data fetching, and mutations
 */
export function usePrivacyPageState() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedDSAR, setSelectedDSAR] = useState(null);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [consentScriptDialogOpen, setConsentScriptDialogOpen] = useState(false);
  const [privacyNoticeDialogOpen, setPrivacyNoticeDialogOpen] = useState(false);
  const [retentionDialogOpen, setRetentionDialogOpen] = useState(false);
  const [breachDialogOpen, setBreachDialogOpen] = useState(false);
  
  // Audit log filters state
  const [auditLogFilters, setAuditLogFilters] = useState({
    eventType: '',
    actorId: '',
    startDate: '',
    endDate: ''
  });
  
  // Audit log pagination state
  const [auditLogPage, setAuditLogPage] = useState(0); // 0-indexed for MUI
  const auditLogPageSize = 15;

  // Fetch privacy configuration from the same source as System page and Agent Service
  const { data: privacyConfig, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['privacy-config'],
    queryFn: async () => {
      const response = await configService.getPrivacyConfig();
      // Handle normalized response structure - return the config object
      return response?.data?.config || response?.config || response?.data || response || null;
    }
  });

  // Fetch DSAR requests
  const { data: dsarRequests, isLoading: dsarLoading, refetch: refetchDSAR } = useQuery({
    queryKey: ['dsarRequests'],
    queryFn: async () => {
      const response = await dsarService.getDSARRequests();
      // Handle normalized response structure
      return response?.data?.dsarRequests || response?.dsarRequests || response?.data || response || [];
    }
  });

  // Fetch audit logs with filters and pagination
  const { data: auditLogsData, isLoading: auditLogsLoading, refetch: refetchAuditLogs } = useQuery({
    queryKey: ['auditLogs', auditLogFilters, auditLogPage],
    queryFn: async () => {
      // Build filter params with pagination
      const params = { 
        limit: auditLogPageSize, 
        page: auditLogPage + 1 // API uses 1-indexed pages
      };
      if (auditLogFilters.eventType) params.action = auditLogFilters.eventType;
      if (auditLogFilters.actorId) params.actorId = auditLogFilters.actorId;
      if (auditLogFilters.startDate) params.startDate = auditLogFilters.startDate;
      if (auditLogFilters.endDate) params.endDate = auditLogFilters.endDate;
      
      const response = await auditLogService.getAuditLogs(params);
      
      // Extract data from normalized response structure
      // The normalizer returns: { success, data: { auditLogs, pagination }, error, metadata }
      const responseData = response?.data || response;
      
      // Handle both normalized and raw response formats
      const logs = responseData?.auditLogs || response?.auditLogs || [];
      const paginationData = responseData?.pagination || response?.pagination;
      
      return {
        auditLogs: Array.isArray(logs) ? logs : [],
        pagination: paginationData || { 
          total: Array.isArray(logs) ? logs.length : 0, 
          page: auditLogPage + 1, 
          limit: auditLogPageSize,
          pages: 1 
        }
      };
    }
  });
  
  // Extract audit logs and pagination from response with safe defaults
  const auditLogs = auditLogsData?.auditLogs || [];
  const auditLogPagination = auditLogsData?.pagination || { 
    total: auditLogs.length, 
    page: 1, 
    limit: auditLogPageSize,
    pages: 1 
  };
  
  // Reset page when filters change
  const handleAuditLogFiltersChange = useCallback((newFilters) => {
    setAuditLogFilters(newFilters);
    setAuditLogPage(0); // Reset to first page
  }, []);

  // Fetch retention policies
  const { data: retentionPolicies, isLoading: retentionLoading, refetch: refetchRetention } = useQuery({
    queryKey: ['retentionPolicies'],
    queryFn: async () => {
      const response = await privacyService.checkRetentionPolicies();
      // Handle normalized response structure
      return response?.data?.retentionChecks || response?.retentionChecks || response?.data || response || {};
    }
  });

  // Fetch compliance report
  const { data: complianceReport, isLoading: complianceLoading, refetch: refetchCompliance } = useQuery({
    queryKey: ['complianceReport'],
    queryFn: async () => {
      const response = await privacyService.generateComplianceReport('monthly');
      // Handle normalized response structure
      return response?.data?.report || response?.report || response?.data || response || null;
    }
  });

  // Fetch consent records from CallRecord collection
  const { data: consentRecords, isLoading: consentLoading, refetch: refetchConsent } = useQuery({
    queryKey: ['consentRecords'],
    queryFn: async () => {
      const response = await privacyService.getConsentRecords({ limit: 500 });
      // Handle normalized response structure
      return response?.data?.consentRecords || response?.consentRecords || response?.data || [];
    }
  });

  // Update privacy configuration mutation - uses configService for proper sync
  const updateConfigMutation = useMutation({
    mutationFn: (data) => configService.updatePrivacyConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['privacy-config']);
    }
  });

  // Create DSAR request mutation
  const createDSARMutation = useMutation({
    mutationFn: (data) => dsarService.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dsarRequests']);
      queryClient.invalidateQueries(['dsar-requests']);
      showSuccess('DSAR request created successfully. A verification email has been sent.');
    },
    onError: (error) => {
      showError(error.message || 'Failed to create DSAR request');
    }
  });

  // Update DSAR request mutation
  const updateDSARMutation = useMutation({
    mutationFn: ({ id, data }) => dsarService.updateRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dsarRequests']);
      queryClient.invalidateQueries(['dsar-requests']);
      showSuccess('DSAR request updated successfully');
    },
    onError: (error) => {
      showError(error.message || 'Failed to update DSAR request');
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
    mutationFn: (data) => privacyService.reportDataBreach(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['auditLogs']);
    }
  });

  // Cleanup expired data mutation
  const cleanupMutation = useMutation({
    mutationFn: () => privacyService.cleanupExpiredData(),
    onSuccess: () => {
      queryClient.invalidateQueries(['retentionPolicies']);
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
    auditLogFilters,
    setAuditLogFilters: handleAuditLogFiltersChange,
    auditLogPage,
    setAuditLogPage,
    auditLogPageSize,
    auditLogPagination,
    retentionPolicies,
    retentionLoading,
    complianceReport,
    complianceLoading,
    consentRecords,
    consentLoading,

    // Mutations
    updateConfigMutation,
    createDSARMutation,
    updateDSARMutation,
    exportDSARMutation,
    reportBreachMutation,
    cleanupMutation,

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
    refetchAuditLogs,
    refetchRetention,
    refetchCompliance,
    refetchConsent
  };
}

