import React from 'react';
import { Box, Chip, Typography, Tooltip } from '@mui/material';
import { CheckCircle, Error as ErrorIcon, HelpOutline } from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';

/**
 * ConnectionStatusIndicator Component
 * Reusable status indicator for connections
 * Used by SIP configuration, Payment Gateway configuration, etc.
 */
const ConnectionStatusIndicator = ({
  status = 'not_tested', // 'not_tested', 'success', 'failed'
  lastTest,
  error,
  label = 'Connection Status',
  size = 'medium'
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckCircle fontSize="small" />,
          color: 'success',
          label: 'Connected',
          bgColor: 'success.light',
          textColor: 'success.dark'
        };
      
      case 'failed':
        return {
          icon: <ErrorIcon fontSize="small" />,
          color: 'error',
          label: 'Failed',
          bgColor: 'error.light',
          textColor: 'error.dark'
        };
      
      case 'not_tested':
      default:
        return {
          icon: <HelpOutline fontSize="small" />,
          color: 'default',
          label: 'Not Tested',
          bgColor: 'grey.200',
          textColor: 'grey.600'
        };
    }
  };

  const statusConfig = getStatusConfig();

  const tooltipContent = (
    <Box>
      <Typography variant="caption" display="block" fontWeight="bold">
        {label}
      </Typography>
      <Typography variant="caption" display="block">
        Status: {statusConfig.label}
      </Typography>
      {lastTest && (
        <Typography variant="caption" display="block">
          Last Test: {formatDateTime(lastTest)}
        </Typography>
      )}
      {error && (
        <Typography variant="caption" display="block" color="error">
          Error: {error}
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          size={size}
          variant={status === 'not_tested' ? 'outlined' : 'filled'}
        />
        {lastTest && (
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(lastTest)}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default ConnectionStatusIndicator;

