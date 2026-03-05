import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import { Save } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../components/common/ToastProvider';
import telephonyService from '../../../../services/telephonyService';
import useConnectionTest from '../../../../hooks/useConnectionTest';
import SIPBasicSettings from './SIPBasicSettings';
import SIPCredentialsForm from './SIPCredentialsForm';
import SIPConnectionStatus from './SIPConnectionStatus';
import ConfirmSaveDialog from '../../../../components/common/ConfirmSaveDialog';
import { AGENT_AFFECTING_WARNINGS } from '../../../../constants/agentAffectingWarnings';

/**
 * SIPConfigurationTab Component
 * Main SIP configuration tab with all settings
 */
const SIPConfigurationTab = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSipData, setPendingSipData] = useState(null);

  // Fetch current SIP config
  const { data: sipConfigData, isLoading } = useQuery({
    queryKey: ['sip-config'],
    queryFn: async () => {
      const response = await telephonyService.getSipConfig();
      return response.sipSettings || {};
    }
  });

  // Form setup
  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      sipSettings: {
        openaiSipEnabled: false,
        primaryPath: 'sip',
        fallbackPath: 'media_streams',
        codec: 'opus',
        region: 'europe',
        openaiSipEndpoint: '',
        openaiSipWebhookUrl: '',
        twilioSipTrunkSid: '',
        twilioSipUsername: '',
        twilioSipPassword: ''
      }
    }
  });

  // Reset form when config is loaded
  useEffect(() => {
    if (sipConfigData) {
      reset({
        sipSettings: {
          ...sipConfigData,
          // Don't reset password if it's masked
          twilioSipPassword: sipConfigData.twilioSipPassword || ''
        }
      });
    }
  }, [sipConfigData, reset]);

  // Connection test hook
  const { testConnection, status, loading: testLoading, error, lastAttempt } = useConnectionTest(
    async (config) => {
      // Get current form values
      const formValues = watch();
      const testConfig = {
        ...formValues.sipSettings,
        ...config
      };
      
      // Update config first, then test
      await telephonyService.updateSipConfig(testConfig);
      return await telephonyService.testSipConnection();
    }
  );

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await telephonyService.updateSipConfig(data.sipSettings);
    },
    onSuccess: (response) => {
      showSuccess('SIP configuration updated successfully');
      queryClient.invalidateQueries(['sip-config']);
      queryClient.invalidateQueries(['telephony-config']);
    },
    onError: (error) => {
      showError(error.message || 'Failed to update SIP configuration');
    }
  });

  const onSubmit = async (data) => {
    try {
      await updateMutation.mutateAsync(data);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleSaveClick = (data) => {
    if (data) {
      setPendingSipData(data);
      setConfirmOpen(true);
    }
  };

  const handleConfirmSave = async () => {
    if (pendingSipData) {
      await updateMutation.mutateAsync(pendingSipData);
      setConfirmOpen(false);
      setPendingSipData(null);
    }
  };

  const handleTestConnection = async () => {
    const formValues = watch();
    await testConnection(formValues.sipSettings);
  };

  const sipEnabled = watch('sipSettings.openaiSipEnabled');

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  return (
    <Box>
      <SIPBasicSettings control={control} watch={watch} />
      <SIPCredentialsForm control={control} watch={watch} />
      
      <SIPConnectionStatus
        status={status}
        lastAttempt={lastAttempt}
        error={error}
        onTest={handleTestConnection}
        loading={testLoading}
        disabled={!sipEnabled}
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button
          type="button"
          variant="contained"
          size="large"
          startIcon={<Save />}
          onClick={handleSubmit(handleSaveClick)}
          disabled={updateMutation.isLoading}
          sx={{ minWidth: 150 }}
        >
          {updateMutation.isLoading ? 'Saving...' : 'Save SIP Configuration'}
        </Button>
      </Box>

      <ConfirmSaveDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setPendingSipData(null); }}
        onConfirm={handleConfirmSave}
        title={AGENT_AFFECTING_WARNINGS.SIP_CONFIG.title}
        message={AGENT_AFFECTING_WARNINGS.SIP_CONFIG.message}
        effects={AGENT_AFFECTING_WARNINGS.SIP_CONFIG.effects}
        confirmLabel="Save"
      />
    </Box>
  );
};

export default SIPConfigurationTab;

