import React from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Typography, Paper } from '@mui/material';
import { Controller } from 'react-hook-form';

/**
 * GatewaySelector Component
 * Gateway type selector
 */
const GatewaySelector = ({ control, watch, supportedGateways = [] }) => {
  const selectedGateway = watch('gatewayType');

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Payment Gateway
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select the payment gateway to use for processing payments
      </Typography>

      <Box sx={{ maxWidth: 400 }}>
        <Controller
          name="gatewayType"
          control={control}
          rules={{ required: 'Gateway type is required' }}
          render={({ field, fieldState: { error } }) => (
            <FormControl fullWidth error={!!error}>
              <InputLabel>Gateway Type</InputLabel>
              <Select {...field} label="Gateway Type">
                {supportedGateways.map((gateway) => (
                  <MenuItem key={gateway.id} value={gateway.id}>
                    {gateway.name} - {gateway.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />
      </Box>

      {selectedGateway && (
        <Box sx={{ mt: 2 }}>
          {supportedGateways
            .find(g => g.id === selectedGateway)
            ?.features?.map((feature, index) => (
              <Typography key={index} variant="caption" display="block" color="text.secondary">
                • {feature}
              </Typography>
            ))}
        </Box>
      )}
    </Paper>
  );
};

export default GatewaySelector;

