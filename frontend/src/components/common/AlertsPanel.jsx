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
      <Box 
        sx={{ 
          textAlign: 'center', 
          py: 6,
          px: 2
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            backgroundColor: 'success.lighter',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            opacity: 0.6
          }}
        >
          <Info sx={{ color: 'success.main', fontSize: 24 }} />
        </Box>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          No system alerts at the moment
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.disabled',
            fontSize: '0.75rem',
            display: 'block',
            mt: 0.5
          }}
        >
          All systems operational
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxHeight: 350, overflowY: 'auto', overflowX: 'hidden' }}>
      {alerts.map((alert, index) => (
        <Collapse key={alert.id || index} in={!alert.dismissed}>
          <Alert
            severity={alert.level}
            icon={getAlertIcon(alert.level)}
            action={
              onDismiss && (
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => onDismiss(alert.id)}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <Close fontSize="inherit" />
                </IconButton>
              )
            }
            sx={{ 
              mb: 1.5,
              borderRadius: 1.5,
              '& .MuiAlert-icon': {
                fontSize: 20
              }
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600,
                    fontSize: '0.875rem'
                  }}
                >
                  {alert.title || 'System Alert'}
                </Typography>
                {alert.timestamp && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary',
                      fontSize: '0.75rem'
                    }}
                  >
                    {formatTimestamp(alert.timestamp)}
                  </Typography>
                )}
              </Box>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontSize: '0.8125rem',
                  lineHeight: 1.5
                }}
              >
                {alert.message}
              </Typography>
              {alert.details && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'text.secondary',
                    mt: 1, 
                    display: 'block',
                    fontSize: '0.75rem'
                  }}
                >
                  {alert.details}
                </Typography>
              )}
            </Box>
          </Alert>
        </Collapse>
      ))}
    </Box>
  );
};

export default AlertsPanel;