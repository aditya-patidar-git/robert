import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Divider,
  Button
} from '@mui/material';
import { Save } from '@mui/icons-material';

const CRMTasksTab = ({
  crmTasksConfig,
  handleCrmTaskToggle,
  handleCrmGeneralToggle,
  handleSaveCrmTasksConfig,
  isSaving = false
}) => {
  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          CRM Tasks Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure which CRM tasks are enabled and whether they require human confirmation
        </Typography>

        <Grid container spacing={3}>
          {Object.entries(crmTasksConfig || {})
            .filter(([key, value]) => (key === 'createBooking' || key === 'cancel') && value && typeof value === 'object')
            .map(([taskKey, taskConfig]) => (
              <Grid size={{ xs: 12, md: 6 }} key={taskKey}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom textTransform="capitalize">
                      {taskKey === 'createBooking' ? 'Create Booking' : 'Cancel Booking'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={taskConfig?.enabled ?? true}
                            onChange={(e) => handleCrmTaskToggle(taskKey, 'enabled', e.target.checked)}
                          />
                        }
                        label="Enabled"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={taskConfig?.requireConfirmation ?? true}
                            onChange={(e) => handleCrmTaskToggle(taskKey, 'requireConfirmation', e.target.checked)}
                            disabled={!taskConfig?.enabled}
                          />
                        }
                        label="Require Human Confirmation"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              General Settings
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={crmTasksConfig?.dryRunEnforced ?? true}
                    onChange={(e) => handleCrmGeneralToggle('dryRunEnforced', e.target.checked)}
                  />
                }
                label="Enforce Dry-Run Before Execution"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={crmTasksConfig?.auditLogging ?? true}
                    onChange={(e) => handleCrmGeneralToggle('auditLogging', e.target.checked)}
                  />
                }
                label="Enable Audit Logging"
              />
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Save />}
            onClick={handleSaveCrmTasksConfig}
            disabled={isSaving}
            sx={{ minWidth: 150 }}
          >
            {isSaving ? 'Saving...' : 'Save CRM Tasks Config'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default CRMTasksTab;


