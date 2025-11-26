import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import privacyService from '../../../services/privacyService';
import configService from '../../../services/configService';

export const usePrivacyState = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const canSeeAll = user?.role === 'owner' || user?.role === 'admin';

  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      consentScript: '',
      transcriptRetention: 90,
      recordingRetention: 90,
      metadataRetention: 365
    }
  });

  const [auditLogFilters, setAuditLogFilters] = useState({
    eventType: '',
    startDate: '',
    endDate: ''
  });
  const [breachDialog, setBreachDialog] = useState({ open: false });
  const [piaDialog, setPiaDialog] = useState({ open: false });
  const [dsarFormDialog, setDsarFormDialog] = useState({ open: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, userId: null });

  // Queries
  const { data: privacyConfig, isLoading: configLoading } = useQuery({
    queryKey: ['privacy-config'],
    queryFn: () => configService.getPrivacyConfig(),
    onSuccess: (data) => {
      if (data) {
        Object.keys(data).forEach(key => {
          if (key in control._defaultValues) {
            setValue(key, data[key]);
          }
        });
      }
    }
  });

  const { data: dsarData, isLoading: dsarLoading } = useQuery({
    queryKey: ['dsar-requests'],
    queryFn: async () => {
      const response = await privacyService.getAllDSARRequests();
      return response.dsarRequests || [];
    }
  });

  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery({
    queryKey: ['audit-logs', auditLogFilters],
    queryFn: async () => {
      const response = await privacyService.getAuditLogs(auditLogFilters);
      return response.auditLogs || [];
    }
  });

  const { data: retentionPoliciesData, isLoading: retentionLoading } = useQuery({
    queryKey: ['retention-policies'],
    queryFn: async () => {
      const response = await privacyService.checkRetentionPolicies();
      return response.retentionChecks || response || {};
    }
  });

  const { data: complianceReportData, isLoading: complianceLoading } = useQuery({
    queryKey: ['compliance-report'],
    queryFn: async () => {
      const response = await privacyService.generateComplianceReport('monthly');
      return response.report;
    },
    enabled: canSeeAll
  });

  // Mutations
  const saveConfigMutation = useMutation({
    mutationFn: configService.updatePrivacyConfig,
    onSuccess: () => {
      showSuccess('Privacy configuration saved successfully');
      queryClient.invalidateQueries(['privacy-config']);
    },
    onError: () => showError('Failed to save privacy configuration')
  });

  const exportDataMutation = useMutation({
    mutationFn: (userId) => privacyService.exportUserData(userId),
    onSuccess: (blob, userId) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-${userId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('User data exported successfully');
    },
    onError: () => showError('Failed to export user data')
  });

  const deleteDataMutation = useMutation({
    mutationFn: (userId) => privacyService.deleteUserData(userId),
    onSuccess: () => {
      showSuccess('User data deleted successfully');
      queryClient.invalidateQueries(['dsar-requests']);
      setDeleteDialog({ open: false, userId: null });
    },
    onError: () => showError('Failed to delete user data')
  });

  return {
    // Auth
    user,
    canSeeAll,
    
    // Form
    control,
    handleSubmit,
    watch,
    setValue,
    
    // State
    auditLogFilters,
    setAuditLogFilters,
    breachDialog,
    setBreachDialog,
    piaDialog,
    setPiaDialog,
    dsarFormDialog,
    setDsarFormDialog,
    deleteDialog,
    setDeleteDialog,
    
    // Queries
    privacyConfig,
    configLoading,
    dsarRequests: dsarData || [],
    dsarLoading,
    auditLogs: auditLogsData || [],
    auditLogsLoading,
    retentionPolicies: { retentionChecks: retentionPoliciesData || {} },
    retentionLoading,
    complianceReport: { report: complianceReportData },
    complianceLoading,
    
    // Mutations
    saveConfigMutation,
    exportDataMutation,
    deleteDataMutation,
    
    // Query client
    queryClient,
    
    // Toast
    showSuccess,
    showError
  };
};



