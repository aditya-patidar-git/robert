import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import {
  Build,
  Memory,
  Settings,
  VolumeUp,
  Phone,
  Business,
  Lock
} from '@mui/icons-material';
import { useSystemPageState } from './hooks/useSystemPageState';
import MCPToolsTab from './tabs/MCPToolsTab';
import ModelCapabilityRegistryTab from './tabs/ModelCapabilityRegistryTab';
import AudioSettingsTab from './tabs/AudioSettingsTab';
import TelephonySettingsTab from './tabs/TelephonySettingsTab';
import CRMTasksTab from './tabs/CRMTasksTab';
import SecurityPrivacyTab from './tabs/SecurityPrivacyTab';
import GeneralSettingsTab from './tabs/GeneralSettingsTab';

const SystemConfigPage = () => {
  const {
    currentTab,
    setCurrentTab,
    control,
    handleSubmit,
    watch,
    audioLoading,
    isSavingAudio,
    telephonyConfig,
    telephonyLoading,
    isSavingTelephony,
    privacyConfigData,
    privacyLoading,
    savePrivacyConfigMutation,
    saveConfigMutation,
    isOwner,
    crmTasksConfig,
    handleCrmTaskToggle,
    handleCrmGeneralToggle,
    handleSaveCrmTasksConfig,
    handleSaveAudioConfig,
    handleSaveTelephonyConfig,
    handleSavePrivacyConfig,
    onSubmit
  } = useSystemPageState();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          System Configuration
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure MCP tools, model capabilities, and system-wide settings
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="MCP Tools" icon={<Build />} iconPosition="start" />
          <Tab label="Model Capability Registry" icon={<Memory />} iconPosition="start" />
          <Tab label="Audio Settings" icon={<VolumeUp />} iconPosition="start" />
          <Tab label="Telephony Settings" icon={<Phone />} iconPosition="start" />
          <Tab label="CRM Tasks" icon={<Business />} iconPosition="start" />
          <Tab label="Security & Privacy" icon={<Lock />} iconPosition="start" />
          <Tab label="General Settings" icon={<Settings />} iconPosition="start" />
        </Tabs>
      </Paper>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Tab A: MCP Tools */}
        {currentTab === 0 && (
          <MCPToolsTab control={control} watch={watch} />
        )}

        {/* Tab B: Model Capability Registry */}
        {currentTab === 1 && (
          <ModelCapabilityRegistryTab />
        )}

        {/* Tab C: Audio Settings */}
        {currentTab === 2 && (
          <AudioSettingsTab
            control={control}
            watch={watch}
            audioLoading={audioLoading}
            isSavingAudio={isSavingAudio}
            handleSubmit={handleSubmit}
            handleSaveAudioConfig={handleSaveAudioConfig}
          />
        )}

        {/* Tab D: Telephony Settings */}
        {currentTab === 3 && (
          <TelephonySettingsTab
            control={control}
            telephonyConfig={telephonyConfig}
            telephonyLoading={telephonyLoading}
            isSavingTelephony={isSavingTelephony}
            handleSubmit={handleSubmit}
            handleSaveTelephonyConfig={handleSaveTelephonyConfig}
          />
        )}

        {/* Tab E: CRM Tasks */}
        {currentTab === 4 && (
          <CRMTasksTab
            crmTasksConfig={crmTasksConfig}
            handleCrmTaskToggle={handleCrmTaskToggle}
            handleCrmGeneralToggle={handleCrmGeneralToggle}
            handleSaveCrmTasksConfig={handleSaveCrmTasksConfig}
          />
        )}

        {/* Tab F: Security & Privacy */}
        {currentTab === 5 && (
          <SecurityPrivacyTab
            control={control}
            watch={watch}
            privacyConfigData={privacyConfigData}
            privacyLoading={privacyLoading}
            savePrivacyConfigMutation={savePrivacyConfigMutation}
            handleSubmit={handleSubmit}
            handleSavePrivacyConfig={handleSavePrivacyConfig}
          />
        )}

        {/* Tab G: General Settings */}
        {currentTab === 6 && (
          <GeneralSettingsTab
            control={control}
            watch={watch}
            isOwner={isOwner}
            saveConfigMutation={saveConfigMutation}
            handleSubmit={handleSubmit}
            onSubmit={onSubmit}
          />
        )}
      </form>
    </Container>
  );
};

export default SystemConfigPage;