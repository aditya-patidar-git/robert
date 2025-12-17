import React from 'react';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import { CheckCircle, Error as ErrorIcon, Refresh } from '@mui/icons-material';

/**
 * TestConnectionButton Component
 * Reusable button for testing connections
 * Used by SIP configuration, Payment Gateway configuration, etc.
 */
const TestConnectionButton = ({
  onTest,
  status = 'not_tested', // 'not_tested', 'testing', 'success', 'failed'
  loading = false,
  lastAttempt,
  error,
  disabled,
  size = 'medium',
  variant = 'outlined',
  ...otherProps
}) => {
  const getStatusIcon = () => {
    if (loading || status === 'testing') {
      return <CircularProgress size={16} sx={{ mr: 1 }} />;
    }
    
    if (status === 'success') {
      return <CheckCircle color="success" sx={{ mr: 1, fontSize: 20 }} />;
    }
    
    if (status === 'failed') {
      return <ErrorIcon color="error" sx={{ mr: 1, fontSize: 20 }} />;
    }
    
    return <Refresh sx={{ mr: 1, fontSize: 20 }} />;
  };

  const getButtonText = () => {
    if (loading || status === 'testing') {
      return 'Testing...';
    }
    
    if (status === 'success') {
      return 'Test Successful';
    }
    
    if (status === 'failed') {
      return 'Test Failed';
    }
    
    return 'Test Connection';
  };

  const getButtonColor = () => {
    if (status === 'success') {
      return 'success';
    }
    
    if (status === 'failed') {
      return 'error';
    }
    
    return 'primary';
  };

  const tooltipText = () => {
    if (error) {
      return `Error: ${error}`;
    }
    
    if (lastAttempt) {
      const date = new Date(lastAttempt);
      return `Last tested: ${date.toLocaleString()}`;
    }
    
    return 'Test the connection';
  };

  return (
    <Tooltip title={tooltipText()} arrow>
      <span>
        <Button
          {...otherProps}
          variant={variant}
          size={size}
          color={getButtonColor()}
          onClick={onTest}
          disabled={disabled || loading || status === 'testing'}
          startIcon={getStatusIcon()}
        >
          {getButtonText()}
        </Button>
      </span>
    </Tooltip>
  );
};

export default TestConnectionButton;

