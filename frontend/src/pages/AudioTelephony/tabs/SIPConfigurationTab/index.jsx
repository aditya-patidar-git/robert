import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../components/common/ToastProvider';
import telephonyService from '../../../../services/telephonyService';
import useConnectionTest from '../../../../hooks/useConnectionTest';
import SIPBasicSettings from './SIPBasicSettings';
import SIPCredentialsForm from './SIPCredentialsForm';
import SIPConnectionStatus from './SIPConnectionStatus';

/**
 * SIPConfigurationTab Component
 * Main SIP configuration tab with all settings
 */
const SIPConfigurationTab = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

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

  const handleTestConnection = async () => {
    const formValues = watch();
    await testConnection(formValues.sipSettings);
  };

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  return (
    <Box>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SIPBasicSettings control={control} watch={watch} />
        <SIPCredentialsForm control={control} watch={watch} />
        
        <SIPConnectionStatus
          status={status}
          lastAttempt={lastAttempt}
          error={error}
          onTest={handleTestConnection}
          loading={testLoading}
        />
      </form>
    </Box>
  );
};

export default SIPConfigurationTab;

