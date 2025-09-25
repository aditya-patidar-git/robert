import React from 'react';
import { Box, Alert, AlertTitle, Typography, IconButton, Collapse } from '@mui/material';
import { Close, Warning, Error, Info } from '@mui/icons-material';

const AlertsPanel = ({ alerts, onDismiss }) => {
  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'error':
        return <Error />;
      case 'warning':
        return <Warning />;
      case 'info':
        return <Info />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!alerts || alerts.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No system alerts at the moment
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
      {alerts.map((alert, index) => (
        <Collapse key={alert.id || index} in={!alert.dismissed}>
          <Alert
            severity={alert.severity}
            icon={getAlertIcon(alert.severity)}
            action={
              onDismiss && (
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => onDismiss(alert.id)}
                >
                  <Close fontSize="inherit" />
                </IconButton>
              )
            }
            sx={{ mb: 1 }}
          >
            <AlertTitle sx={{ fontWeight: 'bold' }}>
              {alert.title}
              {alert.timestamp && (
                <Typography component="span" variant="caption" sx={{ ml: 2 }}>
                  {formatTimestamp(alert.timestamp)}
                </Typography>
              )}
            </AlertTitle>
            <Typography variant="body2">
              {alert.message}
            </Typography>
            {alert.details && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {alert.details}
              </Typography>
            )}
          </Alert>
        </Collapse>
      ))}
    </Box>
  );
};

export default AlertsPanel;