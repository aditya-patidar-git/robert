import React, { useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import {
  Build,
  Settings,
  Business,
  Chat
} from '@mui/icons-material';
import { useSystemPageState } from './hooks/useSystemPageState';
import MCPToolsTab from './tabs/MCPToolsTab';
import CRMTasksTab from './tabs/CRMTasksTab';
import GeneralSettingsTab from './tabs/GeneralSettingsTab';
import ConversationBehaviorTab from './tabs/ConversationBehaviorTab';
import ConfigSyncStatus from '../../components/common/ConfigSyncStatus';
import ConfirmSaveDialog from '../../components/common/ConfirmSaveDialog';
import { AGENT_AFFECTING_WARNINGS } from '../../constants/agentAffectingWarnings';

const SystemConfigPage = () => {
  const {
    currentTab,
    setCurrentTab,
    control,
    handleSubmit,
    watch,
    saveConfigMutation,
    isOwner,
    crmTasksConfig,
    handleCrmTaskToggle,
    handleCrmGeneralToggle,
    handleSaveCrmTasksConfig,
    saveCRMTasksConfigMutation,
    onSubmit
  } = useSystemPageState();

  const [confirmGeneralOpen, setConfirmGeneralOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [confirmCrmOpen, setConfirmCrmOpen] = useState(false);

  const handleFormSubmitWithConfirm = (data) => {
    setPendingFormData(data);
    setConfirmGeneralOpen(true);
  };

  const handleSaveCrmTasksConfigWithConfirm = () => {
    setConfirmCrmOpen(true);
  };

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
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
          System Configuration
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.9375rem'
          }}
        >
          Configure MCP tools, model capabilities, and system-wide settings
        </Typography>
        <Box sx={{ mt: 1 }}>
          <ConfigSyncStatus configType="all" showDetails={true} />
        </Box>
      </Box>

      {/* Tabs */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3,
          borderRadius: 2
        }}
      >
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="MCP Tools" icon={<Build />} iconPosition="start" />
          <Tab label="CRM Tasks" icon={<Business />} iconPosition="start" />
          <Tab label="General Settings" icon={<Settings />} iconPosition="start" />
          <Tab label="Conversation Behavior" icon={<Chat />} iconPosition="start" />
        </Tabs>
      </Paper>

      <form onSubmit={handleSubmit(handleFormSubmitWithConfirm)}>
        {/* Tab A: MCP Tools */}
        {currentTab === 0 && (
          <MCPToolsTab control={control} watch={watch} currentTab={currentTab} />
        )}

        {/* Tab B: CRM Tasks */}
        {currentTab === 1 && (
          <CRMTasksTab
            crmTasksConfig={crmTasksConfig}
            handleCrmTaskToggle={handleCrmTaskToggle}
            handleCrmGeneralToggle={handleCrmGeneralToggle}
            handleSaveCrmTasksConfig={handleSaveCrmTasksConfigWithConfirm}
            isSaving={saveCRMTasksConfigMutation?.isLoading}
          />
        )}

        {/* Tab C: General Settings */}
        {currentTab === 2 && (
          <GeneralSettingsTab
            control={control}
            watch={watch}
            isOwner={isOwner}
            saveConfigMutation={saveConfigMutation}
          />
        )}
      </form>

      {/* Tab D: Conversation Behavior (outside form since it has its own save handler) */}
      {currentTab === 3 && (
        <ConversationBehaviorTab />
      )}

      {/* General Settings save confirmation */}
      <ConfirmSaveDialog
        open={confirmGeneralOpen}
        onClose={() => { setConfirmGeneralOpen(false); setPendingFormData(null); }}
        onConfirm={() => pendingFormData && saveConfigMutation.mutate(pendingFormData)}
        title={AGENT_AFFECTING_WARNINGS.GENERAL_SYSTEM.title}
        message={AGENT_AFFECTING_WARNINGS.GENERAL_SYSTEM.message}
        effects={AGENT_AFFECTING_WARNINGS.GENERAL_SYSTEM.effects}
        confirmLabel="Save"
      />

      {/* CRM Tasks save confirmation */}
      <ConfirmSaveDialog
        open={confirmCrmOpen}
        onClose={() => setConfirmCrmOpen(false)}
        onConfirm={() => handleSaveCrmTasksConfig()}
        title={AGENT_AFFECTING_WARNINGS.CRM_TASKS.title}
        message={AGENT_AFFECTING_WARNINGS.CRM_TASKS.message}
        effects={AGENT_AFFECTING_WARNINGS.CRM_TASKS.effects}
        confirmLabel="Save"
      />
    </Box>
  );
};

export default SystemConfigPage;