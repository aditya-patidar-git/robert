import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import ConnectionStatusIndicator from '../../../../components/common/ConnectionStatusIndicator';
import TestConnectionButton from '../../../../components/common/TestConnectionButton';

/**
 * SIPConnectionStatus Component
 * SIP connection status dashboard with test button
 */
const SIPConnectionStatus = ({
  status,
  lastAttempt,
  error,
  onTest,
  loading
}) => {
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Connection Status
        </Typography>
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
          label="SIP Connection"
        />
      </Box>
    </Paper>
  );
};

export default SIPConnectionStatus;

