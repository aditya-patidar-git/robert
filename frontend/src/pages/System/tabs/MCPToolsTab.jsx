import React from 'react';
import { Box, Paper, Typography, Grid, Switch, FormControlLabel, Slider } from '@mui/material';
import { Controller } from 'react-hook-form';
import MCPToolsConfig from '../../../components/config/MCPToolsConfig';

const MCPToolsTab = ({ control, watch }) => {
  return (
    <Box>
      {/* MCP Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
          MCP System Controls
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Model Context Protocol (MCP) tools configuration and rate limiting
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Controller
              name="mcpEnabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} />}
                  label="Enable MCP Tools System"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Global Rate Limit: {watch('mcpRateLimit')} calls/sec
            </Typography>
            <Controller
              name="mcpRateLimit"
              control={control}
              render={({ field }) => (
                <Slider
                  {...field}
                  min={10}
                  max={1000}
                  step={10}
                  marks={[
                    { value: 10, label: '10' },
                    { value: 100, label: '100' },
                    { value: 500, label: '500' },
                    { value: 1000, label: '1000' }
                  ]}
                  valueLabelDisplay="auto"
                />
              )}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* MCP Tools Registry */}
      <MCPToolsConfig showSystemControls={false} />
    </Box>
  );
};

export default MCPToolsTab;



