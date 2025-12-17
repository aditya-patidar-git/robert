import React from 'react';
import { TextField, Box, Typography } from '@mui/material';
import { Controller } from 'react-hook-form';

/**
 * TemplateEditor Component
 * Reusable template editor for email and SMS
 */
const TemplateEditor = ({ 
  control, 
  type = 'email', // 'email' | 'sms'
  variables = [] 
}) => {
  return (
    <Box>
      {type === 'email' && (
        <Controller
          name="subject"
          control={control}
          rules={{ required: 'Subject is required' }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Email Subject"
              fullWidth
              error={!!error}
              helperText={error?.message || 'Email subject line'}
              sx={{ mb: 2 }}
            />
          )}
        />
      )}

      <Controller
        name="body"
        control={control}
        rules={{ 
          required: 'Body is required',
          ...(type === 'sms' ? {
            maxLength: {
              value: 1600,
              message: 'SMS body must be 1600 characters or less'
            }
          } : {})
        }}
        render={({ field, fieldState: { error } }) => (
          <TextField
            {...field}
            label={type === 'email' ? 'Email Body' : 'SMS Body'}
            multiline
            rows={type === 'email' ? 12 : 6}
            fullWidth
            error={!!error}
            helperText={
              error?.message || 
              (type === 'sms' 
                ? `Character count: ${field.value?.length || 0}/1600` 
                : 'Use {{variableName}} for variables')
            }
            inputProps={{
              maxLength: type === 'sms' ? 1600 : undefined
            }}
          />
        )}
      />
    </Box>
  );
};

export default TemplateEditor;

