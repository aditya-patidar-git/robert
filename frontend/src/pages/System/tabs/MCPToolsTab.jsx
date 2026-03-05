import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, Grid, Switch, FormControlLabel, Slider, Button } from '@mui/material';
import { Save } from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../components/common/ToastProvider';
import MCPToolsConfig from '../../../components/config/MCPToolsConfig';
import systemService from '../../../services/systemService';
import ConfirmSaveDialog from '../../../components/common/ConfirmSaveDialog';
import { AGENT_AFFECTING_WARNINGS } from '../../../constants/agentAffectingWarnings';

const MCPToolsTab = ({ control, watch, currentTab }) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const mcpToolsConfigRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load configs when tab is opened
  useEffect(() => {
    if (currentTab === 0) {
      setIsLoading(true);
      // Refetch system config and MCP tools
      Promise.all([
        queryClient.invalidateQueries(['system-config']),
        queryClient.invalidateQueries(['mcp-tools'])
      ]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [currentTab, queryClient]);

  // Save all configurations (called after user confirms)
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Save system MCP config
      const systemConfigData = {
        mcpEnabled: watch('mcpEnabled'),
        mcpRateLimit: watch('mcpRateLimit'),
        mcpTimeout: watch('mcpTimeout')
      };
      
      await systemService.updateSystemConfig(systemConfigData);

      // Save all tool configs via MCPToolsConfig ref
      if (mcpToolsConfigRef.current?.saveAll) {
        const result = await mcpToolsConfigRef.current.saveAll();
        if (!result.success) {
          throw new Error(result.error || 'Failed to save some tool configurations');
        }
      }

      // Refetch to get latest data
      await Promise.all([
        queryClient.invalidateQueries(['system-config']),
        queryClient.invalidateQueries(['mcp-tools'])
      ]);

      showSuccess('All MCP configurations saved successfully');
    } catch (error) {
      showError(`Failed to save configurations: ${error.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ position: 'relative', minHeight: '400px' }}>
      {/* MCP Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
          MCP System Controls
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Model Context Protocol (MCP) tools configuration and rate limiting
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
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

          <Grid size={{ xs: 12, md: 4 }} sx={{ pr: { md: 10 } }}>
            <Typography variant="subtitle2" gutterBottom>
              Global Rate Limit: {watch('mcpRateLimit')} calls/min
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

          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Tool Timeout: {watch('mcpTimeout')} seconds
            </Typography>
            <Controller
              name="mcpTimeout"
              control={control}
              render={({ field }) => (
                <Slider
                  {...field}
                  min={5}
                  max={300}
                  step={5}
                  marks={[
                    { value: 5, label: '5s' },
                    { value: 30, label: '30s' },
                    { value: 60, label: '60s' },
                    { value: 120, label: '120s' },
                    { value: 300, label: '300s' }
                  ]}
                  valueLabelDisplay="auto"
                />
              )}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* MCP Tools Registry */}
      <MCPToolsConfig ref={mcpToolsConfigRef} showSystemControls={false} />

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<Save />}
          disabled={isSaving || isLoading}
          sx={{ minWidth: 150 }}
          onClick={() => setConfirmOpen(true)}
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </Box>

      <ConfirmSaveDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleSaveAll()}
        title={AGENT_AFFECTING_WARNINGS.MCP_SYSTEM.title}
        message={AGENT_AFFECTING_WARNINGS.MCP_SYSTEM.message}
        effects={AGENT_AFFECTING_WARNINGS.MCP_SYSTEM.effects}
        confirmLabel="Save"
      />
    </Box>
  );
};

export default MCPToolsTab;



