import React from 'react';
import { Box, Paper, Typography, Button, Divider, Accordion, AccordionSummary, AccordionDetails, Grid, FormControl, InputLabel, Select, MenuItem, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Alert, FormControlLabel, Switch, Tooltip } from '@mui/material';
import { Controller } from 'react-hook-form';
import { Add, Edit, Delete, Phone, AccessTime, Voicemail, ExpandMore } from '@mui/icons-material';
import NumberManagementTable from '../components/NumberManagementTable';

const TelephonyRoutingTab = ({ state, handlers }) => {
  const {
    control,
    watch,
    setValue
  } = state;

  const {
    setAddNumberDialog,
    handleOpenEditNumber,
    handleOpenDeleteNumber,
    handleEditNumber,
    setAddTransferNumberDialog,
    handleOpenEditTransferNumber,
    handleDeleteTransferNumber
  } = handlers;

  const provisionedNumbers = watch('numbers') || [];
  const transferNumbers = watch('transferNumbers') || [];

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" fontWeight="bold">
          Telephony Routing
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAddNumberDialog(true)}
        >
          Add Number
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure routing for provisioned phone numbers
      </Typography>

      <NumberManagementTable
        numbers={provisionedNumbers}
        setValue={setValue}
        watch={watch}
        handleOpenEditNumber={handleOpenEditNumber}
        handleOpenDeleteNumber={handleOpenDeleteNumber}
        handleEditNumber={handleEditNumber}
      />

      {/* CLI Presentation */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" gutterBottom>
        CLI Presentation
      </Typography>
      <Box sx={{ maxWidth: 400 }}>
        <Controller
          name="outboundCallerId"
          control={control}
          rules={{
            required: 'Caller ID is required',
            pattern: {
              value: /^\+?[1-9]\d{1,14}$/,
              message: 'Enter a valid phone number'
            }
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Outbound Caller ID"
              fullWidth
              placeholder="+442045726060"
              error={!!error}
              helperText={error?.message || 'Global caller ID for all outbound calls'}
            />
          )}
        />
      </Box>

      {/* Transfer Numbers Section */}
      <Divider sx={{ my: 3 }} />
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Phone />
            <Typography variant="h6">Transfer Numbers</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setAddTransferNumberDialog(true)}
            >
              Add Transfer Number
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Number</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transferNumbers.map((transferNumber, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {transferNumber.number}
                      </Typography>
                    </TableCell>
                    <TableCell>{transferNumber.name || '-'}</TableCell>
                    <TableCell>{transferNumber.department || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={transferNumber.isActive ? 'Active' : 'Inactive'}
                        color={transferNumber.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditTransferNumber(index)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteTransferNumber(index)}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {transferNumbers.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No transfer numbers configured. Add a transfer number to enable human transfers.
            </Alert>
          )}
        </AccordionDetails>
      </Accordion>

      {/* After-hours Policy Section */}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTime />
            <Typography variant="h6">After-hours Policy</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={12}>
              <Controller
                name="afterHoursPolicy.enabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Enable after-hours policy"
                  />
                )}
              />
            </Grid>
            {watch('afterHoursPolicy.enabled') && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Tooltip title="Time when after-hours period begins (e.g., 18:00 for 6 PM)">
                    <Controller
                      name="afterHoursPolicy.startTime"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Start Time"
                          type="time"
                          fullWidth
                          helperText="When after-hours period begins"
                        />
                      )}
                    />
                  </Tooltip>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Tooltip title="Time when business hours resume (e.g., 09:00 for 9 AM)">
                    <Controller
                      name="afterHoursPolicy.endTime"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="End Time"
                          type="time"
                          fullWidth
                          helperText="When business hours resume"
                        />
                      )}
                    />
                  </Tooltip>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="afterHoursPolicy.timezone"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Timezone</InputLabel>
                        <Select {...field} label="Timezone">
                          <MenuItem value="Europe/London">Europe/London (GMT)</MenuItem>
                          <MenuItem value="UTC">UTC</MenuItem>
                          <MenuItem value="America/New_York">America/New_York (EST)</MenuItem>
                          <MenuItem value="America/Los_Angeles">America/Los_Angeles (PST)</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="afterHoursPolicy.action"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Action</InputLabel>
                        <Select {...field} label="Action">
                          <MenuItem value="voicemail">Voicemail</MenuItem>
                          <MenuItem value="transfer">Transfer to Human</MenuItem>
                          <MenuItem value="ai_agent">AI Agent</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid size={12}>
                  <Controller
                    name="afterHoursPolicy.message"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="After-hours Message"
                        multiline
                        rows={3}
                        fullWidth
                        helperText="Message to play during after-hours"
                      />
                    )}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Voicemail Settings Section */}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Voicemail />
            <Typography variant="h6">Voicemail Settings</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={12}>
              <Controller
                name="voicemailSettings.enabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Enable voicemail"
                  />
                )}
              />
            </Grid>
            {watch('voicemailSettings.enabled') && (
              <>
                <Grid size={12}>
                  <Controller
                    name="voicemailSettings.greeting"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Voicemail Greeting"
                        multiline
                        rows={3}
                        fullWidth
                        helperText="Greeting message for voicemail"
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="voicemailSettings.maxDuration"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Max Duration (seconds)"
                        type="number"
                        fullWidth
                        inputProps={{ min: 10, max: 600 }}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="voicemailSettings.emailNotification"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="Email Notification"
                      />
                    )}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};

export default TelephonyRoutingTab;



