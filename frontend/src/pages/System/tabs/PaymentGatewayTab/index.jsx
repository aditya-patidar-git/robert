import React, { useEffect } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from '@mui/icons-material';
import { useToast } from '../../../../components/common/ToastProvider';
import paymentGatewayService from '../../../../services/paymentGatewayService';
import useConnectionTest from '../../../../hooks/useConnectionTest';
import GatewaySelector from './GatewaySelector';
import GatewayCredentialsForm from './GatewayCredentialsForm';
import GatewaySettingsPanel from './GatewaySettingsPanel';
import GatewayConnectionStatus from './GatewayConnectionStatus';

/**
 * PaymentGatewayTab Component
 * Main payment gateway configuration tab
 */
const PaymentGatewayTab = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  // Fetch supported gateways
  const { data: supportedGatewaysData } = useQuery({
    queryKey: ['supported-gateways'],
    queryFn: async () => {
      const response = await paymentGatewayService.getSupportedGateways();
      return response.gateways || [];
    }
  });

  // Fetch current config
  const { data: configData, isLoading } = useQuery({
    queryKey: ['payment-gateway-config'],
    queryFn: async () => {
      const response = await paymentGatewayService.getPaymentGatewayConfig();
      return response.config || null;
    }
  });

  // Form setup
  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      gatewayType: '',
      isActive: false,
      credentials: {},
      settings: {
        currency: 'GBP',
        paymentLinkExpiryHours: 24,
        webhookUrl: '',
        testMode: true
      }
    }
  });

  // Reset form when config is loaded
  useEffect(() => {
    if (configData) {
      reset({
        ...configData,
        credentials: configData.credentials || {},
        settings: {
          currency: 'GBP',
          paymentLinkExpiryHours: 24,
          webhookUrl: '',
          testMode: true,
          ...configData.settings
        }
      });
    }
  }, [configData, reset]);

  const gatewayType = watch('gatewayType');
  const isActive = watch('isActive');

  // Connection test hook
  const { testConnection, status, loading: testLoading, error, lastAttempt } = useConnectionTest(
    async (config) => {
      const formValues = watch();
      const testConfig = {
        gatewayType: formValues.gatewayType,
        credentials: {
          ...formValues.credentials,
          ...config
        }
      };
      
      return await paymentGatewayService.testConnection(testConfig.gatewayType, testConfig.credentials);
    }
  );

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await paymentGatewayService.updatePaymentGatewayConfig(data);
    },
    onSuccess: (response) => {
      showSuccess('Payment gateway configuration updated successfully');
      queryClient.invalidateQueries(['payment-gateway-config']);
    },
    onError: (error) => {
      showError(error.message || 'Failed to update payment gateway configuration');
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
    if (!formValues.gatewayType) {
      showError('Please select a gateway type first');
      return;
    }
    await testConnection(formValues.credentials);
  };

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  return (
    <Box>
      <form onSubmit={handleSubmit(onSubmit)}>
        <GatewaySelector 
          control={control} 
          watch={watch}
          supportedGateways={supportedGatewaysData || []}
        />
        
        {gatewayType && (
          <>
            <GatewayCredentialsForm control={control} watch={watch} />
            <GatewaySettingsPanel control={control} />
            
            <GatewayConnectionStatus
              status={status}
              lastAttempt={lastAttempt}
              error={error}
              onTest={handleTestConnection}
              loading={testLoading}
              isActive={isActive}
            />
          </>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
            disabled={updateMutation.isLoading || !gatewayType}
          >
            {updateMutation.isLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default PaymentGatewayTab;

