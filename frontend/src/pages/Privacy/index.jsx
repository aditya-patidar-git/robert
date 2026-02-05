import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import { ReportProblem } from '@mui/icons-material';
import { usePrivacyPageState } from './hooks/usePrivacyPageState';
import { ConsentScriptSection } from './components/sections/ConsentScriptSection';
import { DataRetentionSection } from './components/sections/DataRetentionSection';
import { LawfulBasisSection } from './components/sections/LawfulBasisSection';
import DSARRequestsTab from './tabs/DSARRequestsTab';
import AuditLogsTab from './tabs/AuditLogsTab';
import RetentionStatusTab from './tabs/RetentionStatusTab';
import ComplianceReportTab from './tabs/ComplianceReportTab';
import ConsentManagementTab from './tabs/ConsentManagementTab';
import { DSARRequestDialog } from './components/dialogs/DSARRequestDialog';
import { DSARExportPreviewDialog } from './components/dialogs/DSARExportPreviewDialog';
import { DataBreachDialog } from './components/dialogs/DataBreachDialog';

/**
 * Privacy Page
 * Main component for GDPR compliance and privacy management
 */
const PrivacyPage = () => {
  const {
    // State
    activeTab,
    setActiveTab,
    selectedDSAR,
    setSelectedDSAR,
    exportPreviewOpen,
    setExportPreviewOpen,
    exportData,
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
    setAuditLogFilters,
    retentionPolicies,
    retentionLoading,
    complianceReport,
    complianceLoading,
    consentRecords,
    consentLoading,

    // Mutations
    cleanupMutation,

    // Handlers
    handleUpdateConsentScript,
    handleUpdatePrivacyNotice,
    handleUpdateRetention,
    handleCreateDSAR,
    handleUpdateDSAR,
    handleExportDSAR,
    handleReportBreach
  } = usePrivacyPageState();

  const handleViewDSAR = (request) => {
    setSelectedDSAR(request);
    setConsentScriptDialogOpen(true);
  };

  const handleDSARSubmit = async (data) => {
    if (selectedDSAR) {
      await handleUpdateDSAR(selectedDSAR.id, data);
    } else {
      await handleCreateDSAR(data);
    }
    setSelectedDSAR(null);
    setConsentScriptDialogOpen(false);
  };

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto', p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.75rem', md: '2rem' },
                color: 'text.primary',
                mb: 1
              }}
            >
              Privacy & Compliance
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                fontSize: '0.9375rem'
              }}
            >
              Manage GDPR compliance, data retention, and privacy settings
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {activeTab === 0 && (
              <Button
                variant="contained"
                onClick={() => {
                  setSelectedDSAR(null);
                  setConsentScriptDialogOpen(true);
                }}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                Create DSAR Request
              </Button>
            )}
            {activeTab === 2 && (
              <Button
                variant="contained"
                onClick={() => cleanupMutation.mutate()}
                disabled={cleanupMutation.isLoading}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                {cleanupMutation.isLoading ? 'Cleaning...' : 'Run Cleanup Now'}
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Quick Actions */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ReportProblem />}
          onClick={() => setBreachDialogOpen(true)}
        >
          Report Data Breach
        </Button>
      </Box>

      {/* Main Content Tabs */}
      <Paper elevation={0} sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="DSAR Requests" />
          <Tab label="Audit Logs" />
          <Tab label="Retention Status" />
          <Tab label="Compliance Report" />
          <Tab label="Consent Management" />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <DSARRequestsTab
              state={{
                dsarRequests: dsarRequests || [],
                dsarLoading,
                setDsarFormDialog: (dialog) => {
                  if (dialog.open) {
                    setSelectedDSAR(null);
                    setConsentScriptDialogOpen(true);
                  }
                }
              }}
              handlers={{
                getStatusColor: (status) => {
                  const colors = {
                    pending: 'warning',
                    processing: 'info',
                    completed: 'success',
                    rejected: 'error'
                  };
                  return colors[status] || 'default';
                }
              }}
            />
          )}

          {activeTab === 1 && (
            <AuditLogsTab
              state={{
                auditLogs: auditLogs || [],
                auditLogsLoading,
                auditLogFilters,
                setAuditLogFilters
              }}
            />
          )}

          {activeTab === 2 && (
            <RetentionStatusTab
              state={{
                retentionPolicies: retentionPolicies || {},
                retentionLoading
              }}
              handlers={{
                cleanupMutation
              }}
            />
          )}

          {activeTab === 3 && (
            <ComplianceReportTab
              state={{
                complianceReport: complianceReport || null,
                complianceLoading
              }}
            />
          )}

          {activeTab === 4 && (
            <ConsentManagementTab
              state={{
                consentRecords: consentRecords || [],
                consentLoading
              }}
            />
          )}
        </Box>
      </Paper>

      {/* Dialogs */}
      <DSARRequestDialog
        open={consentScriptDialogOpen}
        onClose={() => {
          setConsentScriptDialogOpen(false);
          setSelectedDSAR(null);
        }}
        request={selectedDSAR}
        onSubmit={handleDSARSubmit}
        loading={dsarLoading}
      />

      <DSARExportPreviewDialog
        open={exportPreviewOpen}
        onClose={() => setExportPreviewOpen(false)}
        exportData={exportData}
      />

      <DataBreachDialog
        open={breachDialogOpen}
        onClose={() => setBreachDialogOpen(false)}
        onSubmit={handleReportBreach}
        loading={configLoading}
      />
    </Box>
  );
};

export default PrivacyPage;
