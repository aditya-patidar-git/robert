import React, { useState } from 'react';
import { TextField, InputAdornment, IconButton, Tooltip } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

/**
 * MaskedInput Component
 * Reusable input component for sensitive data (passwords, API keys, etc.)
 * Used by SIP configuration, Payment Gateway configuration, etc.
 */
const MaskedInput = ({
  value = '',
  onChange,
  type = 'password', // 'password', 'apiKey', 'secret'
  showToggle = true,
  label,
  fullWidth = true,
  error,
  helperText,
  disabled,
  ...otherProps
}) => {
  const [showValue, setShowValue] = useState(false);

  const handleToggleVisibility = () => {
    setShowValue(!showValue);
  };

  const maskValue = (val) => {
    if (!val || typeof val !== 'string') {
      return '';
    }

    if (showValue) {
      return val;
    }

    // Different masking strategies based on type
    switch (type) {
      case 'apiKey':
        // Show first 8 and last 4 characters
        if (val.length <= 12) {
          return '•'.repeat(val.length);
        }
        return `${val.substring(0, 8)}${'•'.repeat(Math.max(0, val.length - 12))}${val.substring(val.length - 4)}`;
      
      case 'secret':
        // Show first 4 and last 4 characters
        if (val.length <= 8) {
          return '•'.repeat(val.length);
        }
        return `${val.substring(0, 4)}${'•'.repeat(Math.max(0, val.length - 8))}${val.substring(val.length - 4)}`;
      
      case 'password':
      default:
        // Full masking for passwords
        return '•'.repeat(val.length || 8);
    }
  };

  const displayValue = showValue ? value : maskValue(value);

  return (
    <TextField
      {...otherProps}
      type={showValue ? 'text' : 'password'}
      value={displayValue}
      onChange={(e) => {
        // If showing masked value, don't allow editing
        if (!showValue) {
          return;
        }
        onChange(e);
      }}
      onFocus={(e) => {
        // When focused, show actual value for editing
        if (!showValue && value) {
          setShowValue(true);
          // Select all text for easy replacement
          setTimeout(() => {
            e.target.select();
          }, 0);
        }
      }}
      label={label}
      fullWidth={fullWidth}
      error={error}
      helperText={helperText}
      disabled={disabled}
      InputProps={{
        ...otherProps.InputProps,
        endAdornment: showToggle && (
          <InputAdornment position="end">
            <Tooltip title={showValue ? 'Hide value' : 'Show value'}>
              <IconButton
                onClick={handleToggleVisibility}
                edge="end"
                size="small"
                disabled={disabled}
              >
                {showValue ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Tooltip>
          </InputAdornment>
        )
      }}
    />
  );
};

export default MaskedInput;

