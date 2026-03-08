import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import { Save } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../components/common/ToastProvider';
import telephonyService from '../../../../services/telephonyService';
import SIPBasicSettings from './SIPBasicSettings';
import SIPCredentialsForm from './SIPCredentialsForm';
import ConfirmSaveDialog from '../../../../components/common/ConfirmSaveDialog';
import { AGENT_AFFECTING_WARNINGS } from '../../../../constants/agentAffectingWarnings';

// Allow sip:user@host or sips:user@host with optional ;params and ?headers (RFC-style, no // required)
const SIP_URI_PATTERN = /^sips?:[^@]+@[^;?]+(?:;.+)?(?:\?.+)?$/i;
const URL_PATTERN = /^https?:\/\/.+/i;

function isValidSipEndpoint(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return SIP_URI_PATTERN.test(trimmed) || URL_PATTERN.test(trimmed);
}

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
      return response?.data?.sipSettings ?? response?.sipSettings ?? {};
    }
  });

  // Form setup (only fields shown in UI; reset merges full API response)
  const { control, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      sipSettings: {
        openaiSipEnabled: false,
        primaryPath: 'sip',
        fallbackPath: 'media_streams',
        openaiSipEndpoint: ''
      }
    }
  });

  // Reset form when config is loaded
  useEffect(() => {
    if (sipConfigData) {
      reset({
        sipSettings: {
          ...sipConfigData,
          twilioSipPassword: sipConfigData.twilioSipPassword || ''
        }
      });
    }
  }, [sipConfigData, reset]);

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
    if (!data) return;
    const { openaiSipEnabled, primaryPath, fallbackPath, openaiSipEndpoint } = data.sipSettings || {};
    if (openaiSipEnabled) {
      if (primaryPath && fallbackPath && primaryPath === fallbackPath) {
        showError('Primary and fallback path cannot be the same.');
        return;
      }
      if (!openaiSipEndpoint || !openaiSipEndpoint.trim()) {
        showError('OpenAI SIP endpoint is required when SIP is enabled.');
        return;
      }
      if (!isValidSipEndpoint(openaiSipEndpoint)) {
        showError('Invalid SIP endpoint format. Use a valid SIP URI (sip:user@host or sip://...) or HTTPS URL.');
        return;
      }
    }
    setPendingSipData(data);
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (pendingSipData) {
      await updateMutation.mutateAsync(pendingSipData);
      setConfirmOpen(false);
      setPendingSipData(null);
    }
  };

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  return (
    <Box>
      <SIPBasicSettings control={control} watch={watch} />
      <SIPCredentialsForm control={control} watch={watch} />

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

