import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  Button,
  LinearProgress
} from '@mui/material';
import { Save } from '@mui/icons-material';
import { Controller } from 'react-hook-form';

const TelephonySettingsTab = ({
  control,
  telephonyConfig,
  telephonyLoading,
  isSavingTelephony,
  handleSubmit,
  handleSaveTelephonyConfig
}) => {
  return (
    <form onSubmit={handleSubmit(handleSaveTelephonyConfig)}>
      <Box>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Telephony Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure phone numbers, routing, transfer numbers, after-hours policy, and voicemail settings
          </Typography>

          {telephonyLoading ? (
            <LinearProgress sx={{ mb: 2 }} />
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="outboundCallerId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Outbound Caller ID"
                      placeholder="+442045726060"
                    />
                  )}
                />
              </Grid>

              {telephonyConfig && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Phone Numbers
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Number</TableCell>
                            <TableCell>Route</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Description</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {telephonyConfig.numbers?.map((number, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{number.number}</TableCell>
                              <TableCell>
                                <Chip label={number.route} size="small" />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={number.status}
                                  size="small"
                                  color={number.status === 'active' ? 'success' : 'default'}
                                />
                              </TableCell>
                              <TableCell>{number.description || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Transfer Numbers
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Number</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {telephonyConfig.transferNumbers?.map((transfer, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{transfer.number}</TableCell>
                              <TableCell>{transfer.name || 'N/A'}</TableCell>
                              <TableCell>{transfer.department || 'N/A'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={transfer.isActive ? 'Active' : 'Inactive'}
                                  size="small"
                                  color={transfer.isActive ? 'success' : 'default'}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  {telephonyConfig.afterHoursPolicy && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>
                        After-Hours Policy
                      </Typography>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2">
                          <strong>Enabled:</strong> {telephonyConfig.afterHoursPolicy.enabled ? 'Yes' : 'No'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Hours:</strong> {telephonyConfig.afterHoursPolicy.startTime} - {telephonyConfig.afterHoursPolicy.endTime}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Timezone:</strong> {telephonyConfig.afterHoursPolicy.timezone}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Action:</strong> {telephonyConfig.afterHoursPolicy.action}
                        </Typography>
                      </Box>
                    </Grid>
                  )}

                  {telephonyConfig.voicemailSettings && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>
                        Voicemail Settings
                      </Typography>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2">
                          <strong>Enabled:</strong> {telephonyConfig.voicemailSettings.enabled ? 'Yes' : 'No'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Max Duration:</strong> {telephonyConfig.voicemailSettings.maxDuration}s
                        </Typography>
                        <Typography variant="body2">
                          <strong>Email Notification:</strong> {telephonyConfig.voicemailSettings.emailNotification ? 'Yes' : 'No'}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              disabled={isSavingTelephony}
            >
              {isSavingTelephony ? 'Saving...' : 'Save Telephony Config'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </form>
  );
};

export default TelephonySettingsTab;


