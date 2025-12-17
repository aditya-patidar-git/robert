import React from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import ConnectionStatusIndicator from '../../../../components/common/ConnectionStatusIndicator';
import TestConnectionButton from '../../../../components/common/TestConnectionButton';

/**
 * GatewayConnectionStatus Component
 * Gateway connection status with test button
 */
const GatewayConnectionStatus = ({
  status,
  lastAttempt,
  error,
  onTest,
  loading,
  isActive
}) => {
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">
            Connection Status
          </Typography>
          {isActive && (
            <Chip label="Active" color="success" size="small" />
          )}
        </Box>
        <TestConnectionButton
          onTest={onTest}
          status={status}
          loading={loading}
          lastAttempt={lastAttempt}
          error={error}
        />
      </Box>
      <Box sx={{ mt: 2 }}>
        <ConnectionStatusIndicator
          status={status}
          lastTest={lastAttempt}
          error={error}
          label="Payment Gateway Connection"
        />
      </Box>
    </Paper>
  );
};

export default GatewayConnectionStatus;

