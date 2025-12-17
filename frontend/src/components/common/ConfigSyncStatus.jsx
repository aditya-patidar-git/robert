import React, { useEffect } from 'react';
import { Box, Chip, Tooltip, IconButton, Typography } from '@mui/material';
import { Sync, SyncDisabled, CheckCircle, Error as ErrorIcon, Refresh } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '../../utils/formatters';
import useConfigSync from '../../hooks/useConfigSync';

/**
 * ConfigSyncStatus Component
 * Reusable status indicator for config synchronization
 */
const ConfigSyncStatus = ({ configType = 'all', showDetails = false }) => {
  const queryClient = useQueryClient();
  const { connected, syncStatus, lastSync, requestSyncStatus, triggerRefresh } = useConfigSync([configType]);

  // Listen for config change and refresh events
  useEffect(() => {
    const handleConfigChange = (event) => {
      const { configType: changeType } = event.detail;
      if (changeType === configType || changeType === 'all' || configType === 'all') {
        // Invalidate relevant queries
        const queryKeys = {
          'ai': ['ai-config', 'prompt-versions'],
          'telephony': ['telephony-config', 'sip-config'],
          'payment-gateway': ['payment-gateway-config'],
          'privacy': ['privacy-config'],
          'email-template': ['email-templates'],
          'sms-template': ['sms-templates'],
          'all': ['ai-config', 'telephony-config', 'payment-gateway-config', 'privacy-config', 'email-templates', 'sms-templates']
        };
        
        const keysToInvalidate = queryKeys[changeType] || queryKeys[configType] || [];
        keysToInvalidate.forEach(key => {
          queryClient.invalidateQueries([key]);
        });
      }
    };

    const handleConfigRefresh = (event) => {
      const { configType: refreshType } = event.detail;
      if (refreshType === configType || refreshType === 'all' || configType === 'all') {
        handleConfigChange(event);
      }
    };

    window.addEventListener('config_change', handleConfigChange);
    window.addEventListener('config_refresh', handleConfigRefresh);
    
    return () => {
      window.removeEventListener('config_change', handleConfigChange);
      window.removeEventListener('config_refresh', handleConfigRefresh);
    };
  }, [configType, queryClient]);
  
  const status = syncStatus[configType] || syncStatus['all'] || {};
  const isSynced = status.status === 'synced';
  const hasError = status.status === 'error' || status.status === 'failed';

  const getStatusConfig = () => {
    if (!connected) {
      return {
        icon: <SyncDisabled color="disabled" />,
        color: 'default',
        label: 'Disconnected',
        tooltip: 'Not connected to sync server'
      };
    }

    if (hasError) {
      return {
        icon: <ErrorIcon color="error" />,
        color: 'error',
        label: 'Sync Error',
        tooltip: 'Configuration sync error'
      };
    }

    // If connected and no error, show as synced (green)
    // This covers both explicit 'synced' status and default connected state
    if (isSynced || (!hasError && connected)) {
      return {
        icon: <CheckCircle />,
        color: 'success',
        label: 'Synced',
        tooltip: `Last synced: ${lastSync ? formatDateTime(lastSync) : 'Just now'}`
      };
    }

    return {
      icon: <Sync color="warning" />,
      color: 'warning',
      label: 'Syncing...',
      tooltip: 'Configuration is being synchronized'
    };
  };

  const statusConfig = getStatusConfig();

  const tooltipContent = (
    <Box>
      <Typography variant="caption" display="block" fontWeight="bold">
        Config Sync Status
      </Typography>
      <Typography variant="caption" display="block">
        Connection: {connected ? 'Connected' : 'Disconnected'}
      </Typography>
      {status.lastChange && (
        <Typography variant="caption" display="block">
          Last Change: {formatDateTime(status.lastChange)}
        </Typography>
      )}
      {status.lastChangeBy && (
        <Typography variant="caption" display="block">
          Changed By: {status.lastChangeBy}
        </Typography>
      )}
      {lastSync && (
        <Typography variant="caption" display="block">
          Last Sync: {formatDateTime(lastSync)}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={tooltipContent} arrow>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
          variant={connected ? 'filled' : 'outlined'}
          sx={{
            ...(statusConfig.color === 'success' && {
              backgroundColor: 'success.main',
              color: 'success.contrastText',
              '& .MuiChip-icon': {
                color: 'success.contrastText'
              }
            })
          }}
        />
      </Tooltip>
      
      {showDetails && (
        <>
          {status.lastChange && (
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(status.lastChange)}
            </Typography>
          )}
          <Tooltip title="Refresh Status">
            <IconButton
              size="small"
              onClick={requestSyncStatus}
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Trigger Refresh">
            <IconButton
              size="small"
              onClick={() => triggerRefresh(configType)}
            >
              <Sync fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
};

export default ConfigSyncStatus;

