import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

const ConsentManagementTab = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Consent Management
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Consent records are automatically logged when users provide or withdraw consent during calls.
        Use the Audit Logs tab to view detailed consent history.
      </Alert>
      <Typography variant="body2" color="text.secondary">
        To view consent records, filter the Audit Logs by event type "consent_recorded".
      </Typography>
    </Box>
  );
};

export default ConsentManagementTab;



