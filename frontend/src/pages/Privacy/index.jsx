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
import { DSARRequestsTab } from './components/tabs/DSARRequestsTab';
import { AuditLogsTab } from './components/tabs/AuditLogsTab';
import { RetentionStatusTab } from './components/tabs/RetentionStatusTab';
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
              requests={dsarRequests}
              loading={dsarLoading}
              onView={handleViewDSAR}
              onExport={handleExportDSAR}
              onStatusChange={handleUpdateDSAR}
            />
          )}

          {activeTab === 1 && (
            <AuditLogsTab
              logs={auditLogs}
              loading={auditLogsLoading}
            />
          )}

          {activeTab === 2 && (
            <RetentionStatusTab
              retention={privacyConfig?.dataRetention}
              loading={configLoading}
            />
          )}

          {activeTab === 3 && (
            <Box>
              <LawfulBasisSection
                config={privacyConfig}
                onUpdate={handleUpdatePrivacyNotice}
                loading={configLoading}
              />
              <Box sx={{ mt: 3 }}>
                <DataRetentionSection
                  retention={privacyConfig?.dataRetention}
                  onUpdate={handleUpdateRetention}
                  loading={configLoading}
                />
              </Box>
            </Box>
          )}

          {activeTab === 4 && (
            <ConsentScriptSection
              script={privacyConfig?.consentScript}
              onUpdate={handleUpdateConsentScript}
              loading={configLoading}
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
