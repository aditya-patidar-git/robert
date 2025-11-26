import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Divider,
  Grid,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material';
import {
  Save,
  GetApp,
  Delete,
  Warning,
  Security,
  Storage,
  Policy,
  Assessment,
  BugReport,
  History,
  CheckCircle,
  Description,
  Link as LinkIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { formatDateTime } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import privacyService from '../../services/privacyService';
import configService from '../../services/configService';

const PrivacyPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState({ open: false, userId: null });
  
  const canSeeAll = user?.role === 'owner' || user?.role === 'admin';

  const { control, handleSubmit, watch } = useForm({
    defaultValues: {
      consentScript: '',
      transcriptRetention: 90,
      recordingRetention: 90,
      metadataRetention: 365
    }
  });

  const [activeTab, setActiveTab] = useState(0);
  const [auditLogFilters, setAuditLogFilters] = useState({
    eventType: '',
    startDate: '',
    endDate: ''
  });
  const [breachDialog, setBreachDialog] = useState({ open: false });
  const [piaDialog, setPiaDialog] = useState({ open: false });
  const [dsarFormDialog, setDsarFormDialog] = useState({ open: false });

  // Fetch privacy configuration
  const { data: privacyConfig, isLoading: configLoading } = useQuery({
    queryKey: ['privacy-config'],
    queryFn: () => configService.getPrivacyConfig(),
    onSuccess: (data) => {
      if (data) {
        Object.keys(data).forEach(key => {
          if (key in control._defaultValues) {
            control._formValues[key] = data[key];
          }
        });
      }
    }
  });

  // Fetch DSAR requests
  const { data: dsarData, isLoading: dsarLoading } = useQuery({
    queryKey: ['dsar-requests'],
    queryFn: async () => {
      const response = await privacyService.getAllDSARRequests();
      return response.dsarRequests || [];
    }
  });
  const dsarRequests = dsarData || [];

  // Fetch audit logs
  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery({
    queryKey: ['audit-logs', auditLogFilters],
    queryFn: async () => {
      const response = await privacyService.getAuditLogs(auditLogFilters);
      return response.auditLogs || [];
    }
  });
  const auditLogs = auditLogsData || [];

  // Fetch retention policies
  const { data: retentionPoliciesData, isLoading: retentionLoading } = useQuery({
    queryKey: ['retention-policies'],
    queryFn: async () => {
      const response = await privacyService.checkRetentionPolicies();
      return response.retentionChecks || response || {};
    }
  });
  const retentionPolicies = { retentionChecks: retentionPoliciesData || {} };

  // Fetch compliance report
  const { data: complianceReportData, isLoading: complianceLoading } = useQuery({
    queryKey: ['compliance-report'],
    queryFn: async () => {
      const response = await privacyService.generateComplianceReport('monthly');
      return response.report;
    },
    enabled: canSeeAll && activeTab === 3
  });
  const complianceReport = { report: complianceReportData };

  // Save privacy configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: configService.updatePrivacyConfig,
    onSuccess: () => {
      showSuccess('Privacy configuration saved successfully');
      queryClient.invalidateQueries(['privacy-config']);
    },
    onError: () => showError('Failed to save privacy configuration')
  });

  // Export user data mutation
  const exportDataMutation = useMutation({
    mutationFn: (userId) => {
      if (canSeeAll && userId) {
        return privacyService.exportUserData(userId);
      } else {
        return privacyService.exportUserData(user?.id);
      }
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user_data_export.zip';
      a.click();
      showSuccess('Data export completed successfully');
    },
    onError: () => showError('Failed to export user data')
  });

  // Delete user data mutation
  const deleteDataMutation = useMutation({
    mutationFn: privacyService.deleteUserData,
    onSuccess: () => {
      showSuccess('User data deleted successfully');
      setDeleteDialog({ open: false, userId: null });
      queryClient.invalidateQueries(['dsar-requests']);
    },
    onError: () => showError('Failed to delete user data')
  });

  // Create DSAR request mutation
  const createDSARMutation = useMutation({
    mutationFn: privacyService.createDSARRequest,
    onSuccess: () => {
      showSuccess('DSAR request created successfully');
      queryClient.invalidateQueries(['dsar-requests']);
      setDsarFormDialog({ open: false });
    },
    onError: () => showError('Failed to create DSAR request')
  });

  // Cleanup expired data mutation
  const cleanupMutation = useMutation({
    mutationFn: privacyService.cleanupExpiredData,
    onSuccess: () => {
      showSuccess('Expired data cleanup completed');
      queryClient.invalidateQueries(['retention-policies']);
    },
    onError: () => showError('Failed to cleanup expired data')
  });

  // Generate PIA mutation
  const generatePIAMutation = useMutation({
    mutationFn: (processingActivity) => privacyService.generatePrivacyImpactAssessment(processingActivity),
    onSuccess: (data) => {
      showSuccess('Privacy Impact Assessment generated');
      setPiaDialog({ open: true, pia: data.pia });
    },
    onError: () => showError('Failed to generate PIA')
  });

  // Report breach mutation
  const reportBreachMutation = useMutation({
    mutationFn: (breachData) => privacyService.reportDataBreach({ breachData }),
    onSuccess: () => {
      showSuccess('Data breach reported successfully');
      setBreachDialog({ open: false });
      queryClient.invalidateQueries(['audit-logs']);
    },
    onError: () => showError('Failed to report data breach')
  });

  const onSubmit = (data) => {
    saveConfigMutation.mutate(data);
  };

  const handleExportData = (userId = null) => {
    exportDataMutation.mutate(userId);
  };

  const handleDeleteConfirm = () => {
    if (deleteDialog.userId) {
      deleteDataMutation.mutate(deleteDialog.userId);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1"
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '1.75rem', md: '2rem' },
            color: 'text.primary',
            mb: 1
          }}
        >
          Privacy & Compliance
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.9375rem'
          }}
        >
          {canSeeAll ? 
            'Manage GDPR compliance, data retention, and privacy policies' :
            'Manage your personal data and privacy settings'
          }
        </Typography>
      </Box>

      {canSeeAll ? (
        /* Admin/Owner View */
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Consent Script Editor */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Policy color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Consent Script Editor
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure the consent script displayed to users during data collection
            </Typography>

            <Controller
              name="consentScript"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  multiline
                  rows={6}
                  fullWidth
                  placeholder="Enter the consent script that users will see..."
                  sx={{ mb: 2 }}
                />
              )}
            />
            
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              disabled={saveConfigMutation.isLoading}
            >
              Save Consent Script
            </Button>
          </Paper>

          {/* Retention Controls */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Storage color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Data Retention Controls
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure automatic data retention periods for transcripts and recordings
            </Typography>

            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1" gutterBottom>
                  Transcript Retention: {watch('transcriptRetention')} days
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  How long to keep call transcripts before automatic deletion
                </Typography>
                <Controller
                  name="transcriptRetention"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={7}
                      max={365}
                      step={7}
                      marks={[
                        { value: 7, label: '7d' },
                        { value: 30, label: '30d' },
                        { value: 90, label: '90d' },
                        { value: 180, label: '180d' },
                        { value: 365, label: '1yr' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1" gutterBottom>
                  Recording Retention: {watch('recordingRetention')} days
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  How long to keep call recordings before automatic deletion
                </Typography>
                <Controller
                  name="recordingRetention"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={7}
                      max={180}
                      step={7}
                      marks={[
                        { value: 7, label: '7d' },
                        { value: 30, label: '30d' },
                        { value: 90, label: '90d' },
                        { value: 180, label: '180d' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1" gutterBottom>
                  Metadata Retention: {watch('metadataRetention')} days
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  How long to keep call metadata before automatic deletion
                </Typography>
                <Controller
                  name="metadataRetention"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      {...field}
                      min={30}
                      max={730}
                      step={30}
                      marks={[
                        { value: 30, label: '30d' },
                        { value: 90, label: '90d' },
                        { value: 180, label: '180d' },
                        { value: 365, label: '1yr' },
                        { value: 730, label: '2yr' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* DSAR Panel */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Security color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                DSAR Management Panel
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Data Subject Access Request (DSAR) management for GDPR compliance
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={() => handleExportData()}
                disabled={exportDataMutation.isLoading}
              >
                Export All User Data
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => setDeleteDialog({ open: true, userId: 'all' })}
              >
                Bulk Data Deletion
              </Button>
            </Box>

            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Data Processing Notice</Typography>
              All DSAR operations are logged for compliance audit trails. 
              Deletions are permanent and cannot be undone.
            </Alert>
          </Paper>

          {/* Lawful Basis & Privacy Notice */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Description color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Lawful Basis & Privacy Notice
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              UK GDPR compliance information and lawful basis for data processing
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                  Lawful Basis for Processing
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Chip label="Consent" color="primary" size="small" sx={{ mr: 1, mb: 1 }} />
                  <Chip label="Legitimate Interest" color="primary" size="small" sx={{ mr: 1, mb: 1 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  We process personal data based on consent and legitimate interest for service delivery and quality improvement.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                  Privacy Policy
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <LinkIcon fontSize="small" />
                  <Typography variant="body2">
                    For detailed privacy information, please refer to our Privacy Policy.
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  UK GDPR Compliant | Data Processing Location: UK
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Tabs for additional sections */}
          <Paper 
            elevation={0}
            sx={{ 
              mb: 3,
              borderRadius: 2
            }}
          >
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="DSAR Requests" />
              <Tab label="Audit Logs" />
              <Tab label="Retention Status" />
              <Tab label="Compliance Report" />
              <Tab label="Consent Management" />
            </Tabs>

            {/* DSAR Requests Tab */}
            {activeTab === 0 && (
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    DSAR Request Logs ({dsarRequests.length})
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => setDsarFormDialog({ open: true })}
                  >
                    Create DSAR Request
                  </Button>
                </Box>
                {dsarLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Requestor</TableCell>
                          <TableCell>Request Type</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dsarRequests.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography color="text.secondary">No DSAR requests found</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          dsarRequests.map((request) => (
                            <TableRow key={request.id}>
                              <TableCell>{request.requestorEmail || request.requestor}</TableCell>
                              <TableCell>
                                <Chip
                                  label={request.requestType || request.type}
                                  color={request.requestType === 'export' || request.type === 'export' ? 'info' : 'error'}
                                  size="small"
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>{formatDateTime(request.createdAt || request.date)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={request.status}
                                  color={getStatusColor(request.status)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                {request.status === 'completed' && (
                                  <Button size="small" startIcon={<GetApp />}>
                                    Download
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 1 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Privacy Audit Logs
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Event Type</InputLabel>
                    <Select
                      value={auditLogFilters.eventType}
                      label="Event Type"
                      onChange={(e) => setAuditLogFilters({ ...auditLogFilters, eventType: e.target.value })}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="consent_recorded">Consent Recorded</MenuItem>
                      <MenuItem value="dsar_created">DSAR Created</MenuItem>
                      <MenuItem value="data_exported">Data Exported</MenuItem>
                      <MenuItem value="data_deleted">Data Deleted</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    type="date"
                    label="Start Date"
                    value={auditLogFilters.startDate}
                    onChange={(e) => setAuditLogFilters({ ...auditLogFilters, startDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="End Date"
                    value={auditLogFilters.endDate}
                    onChange={(e) => setAuditLogFilters({ ...auditLogFilters, endDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                {auditLogsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>Event Type</TableCell>
                          <TableCell>Details</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} align="center">
                              <Typography color="text.secondary">No audit logs found</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          auditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                              <TableCell>
                                <Chip label={log.eventType} size="small" />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {JSON.stringify(log.eventData, null, 2)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}

            {/* Retention Status Tab */}
            {activeTab === 2 && (
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6">
                    Retention Policy Status
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => cleanupMutation.mutate()}
                    disabled={cleanupMutation.isLoading}
                  >
                    {cleanupMutation.isLoading ? 'Cleaning...' : 'Run Cleanup Now'}
                  </Button>
                </Box>
                {retentionLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Grid container spacing={3}>
                    {retentionPolicies?.retentionChecks && Object.entries(retentionPolicies.retentionChecks).map(([dataType, check]) => (
                      <Grid item xs={12} md={4} key={dataType}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Cutoff Date: {formatDateTime(check.cutoffDate)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Records to Delete: {check.recordsToDelete || 0}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            )}

            {/* Compliance Report Tab */}
            {activeTab === 3 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Compliance Report
                </Typography>
                {complianceLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  complianceReport?.report && (
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            Metrics
                          </Typography>
                          <Typography variant="body2">Total Calls: {complianceReport.report.metrics.totalCalls}</Typography>
                          <Typography variant="body2">Consent Rate: {(complianceReport.report.metrics.consentRate * 100).toFixed(1)}%</Typography>
                          <Typography variant="body2">DSAR Requests: {complianceReport.report.metrics.dsarRequests}</Typography>
                          <Typography variant="body2">Data Exports: {complianceReport.report.metrics.dataExports}</Typography>
                          <Typography variant="body2">Data Deletions: {complianceReport.report.metrics.dataDeletions}</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            Compliance Status
                          </Typography>
                          <Chip
                            label={complianceReport.report.complianceStatus}
                            color={complianceReport.report.complianceStatus === 'compliant' ? 'success' : 'warning'}
                            sx={{ mb: 2 }}
                          />
                          <Typography variant="subtitle2" gutterBottom>
                            Recommendations
                          </Typography>
                          <ul>
                            {complianceReport.report.recommendations?.map((rec, idx) => (
                              <li key={idx}>
                                <Typography variant="body2">{rec}</Typography>
                              </li>
                            ))}
                          </ul>
                        </Paper>
                      </Grid>
                    </Grid>
                  )
                )}
              </Box>
            )}

            {/* Consent Management Tab */}
            {activeTab === 4 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Consent Management
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Consent records are automatically logged when users provide or withdraw consent during calls.
                  Use the Audit Logs tab to view detailed consent history.
                </Alert>
                <Typography variant="body2" color="text.secondary">
                  To view consent records, filter the Audit Logs by event type "consent_recorded".
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Additional Admin Sections */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Assessment color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    Privacy Impact Assessment
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Generate a Privacy Impact Assessment for new processing activities
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const activity = prompt('Enter processing activity description:');
                    if (activity) {
                      generatePIAMutation.mutate(activity);
                    }
                  }}
                  disabled={generatePIAMutation.isLoading}
                >
                  Generate PIA
                </Button>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <BugReport color="error" />
                  <Typography variant="h6" fontWeight="bold">
                    Data Breach Reporting
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Report a data breach incident for compliance tracking
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setBreachDialog({ open: true })}
                >
                  Report Breach
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </form>
      ) : (
        /* User View */
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Security color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Your Data Rights
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Under GDPR and data protection regulations, you have the right to access, 
              export, and request deletion of your personal data.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={() => handleExportData()}
                disabled={exportDataMutation.isLoading}
              >
                {exportDataMutation.isLoading ? 'Exporting...' : 'Export My Data'}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => setDeleteDialog({ open: true, userId: user?.id })}
              >
                Request Data Deletion
              </Button>
            </Box>

            <Alert severity="info">
              <Typography variant="subtitle2">Data Export Information</Typography>
              Your data export will include all call transcripts, recordings, and 
              personal information associated with your account. The export will be 
              provided as a downloadable ZIP file.
            </Alert>
          </Paper>

          {/* DSAR Request Form */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Security color="primary" />
              <Typography variant="h5" component="h2" fontWeight="bold">
                Submit Data Request
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 3 }}>
              You can request access to your data or request deletion. You can also email us at{' '}
              <strong>complaints@universalmct.co.uk</strong> for DSAR requests.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={() => setDsarFormDialog({ open: true, type: 'export' })}
              >
                Request Data Export
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setDsarFormDialog({ open: true, type: 'delete' })}
              >
                Request Data Deletion
              </Button>
            </Box>
          </Paper>

          {/* User's DSAR History */}
          <Paper>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Your Data Requests ({dsarRequests.filter(req => (req.requestorEmail || req.requestor) === user?.email).length})
              </Typography>
            </Box>
            {dsarLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Request Type</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dsarRequests.filter(req => (req.requestorEmail || req.requestor) === user?.email).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="text.secondary">No requests found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      dsarRequests
                        .filter(req => (req.requestorEmail || req.requestor) === user?.email)
                        .map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <Chip
                                label={request.requestType || request.type}
                                color={request.requestType === 'export' || request.type === 'export' ? 'info' : 'error'}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{formatDateTime(request.createdAt || request.date)}</TableCell>
                            <TableCell>
                              <Chip
                                label={request.status}
                                color={getStatusColor(request.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {(request.requestType === 'export' || request.type === 'export') && request.status === 'completed' && (
                                <Button size="small" startIcon={<GetApp />}>
                                  Download
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, userId: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          Confirm Data Deletion
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This action cannot be undone. All user data including transcripts, 
            recordings, and personal information will be permanently deleted.
          </Alert>
          <Typography>
            Are you sure you want to proceed with data deletion?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, userId: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteDataMutation.isLoading}
          >
            {deleteDataMutation.isLoading ? 'Deleting...' : 'Delete Data'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DSAR Form Dialog */}
      <Dialog
        open={dsarFormDialog.open}
        onClose={() => setDsarFormDialog({ open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create DSAR Request</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              required
              id="dsar-name"
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              defaultValue={user?.email}
              id="dsar-email"
            />
            <FormControl fullWidth>
              <InputLabel>Request Type</InputLabel>
              <Select
                defaultValue={dsarFormDialog.type || 'export'}
                label="Request Type"
                id="dsar-type"
              >
                <MenuItem value="export">Export My Data</MenuItem>
                <MenuItem value="delete">Delete My Data</MenuItem>
                <MenuItem value="portability">Data Portability</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info">
              You can also submit DSAR requests via email at{' '}
              <strong>complaints@universalmct.co.uk</strong>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDsarFormDialog({ open: false })}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const name = document.getElementById('dsar-name')?.value;
              const email = document.getElementById('dsar-email')?.value;
              const type = document.getElementById('dsar-type')?.value;
              if (name && email && type) {
                createDSARMutation.mutate({ name, email, type });
              }
            }}
            disabled={createDSARMutation.isLoading}
          >
            {createDSARMutation.isLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Data Breach Dialog */}
      <Dialog
        open={breachDialog.open}
        onClose={() => setBreachDialog({ open: false })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReport color="error" />
          Report Data Breach
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Description"
              multiline
              rows={4}
              fullWidth
              required
              id="breach-description"
            />
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select defaultValue="medium" label="Severity" id="breach-severity">
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Affected Records (estimated)"
              type="number"
              fullWidth
              id="breach-records"
            />
            <Alert severity="warning">
              Data breaches must be reported to the ICO within 72 hours if they pose a risk to individuals' rights and freedoms.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBreachDialog({ open: false })}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              const description = document.getElementById('breach-description')?.value;
              const severity = document.getElementById('breach-severity')?.value;
              const affectedRecords = parseInt(document.getElementById('breach-records')?.value || '0');
              if (description && severity) {
                reportBreachMutation.mutate({
                  description,
                  severity,
                  affectedRecords
                });
              }
            }}
            disabled={reportBreachMutation.isLoading}
          >
            {reportBreachMutation.isLoading ? 'Reporting...' : 'Report Breach'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PIA Dialog */}
      <Dialog
        open={piaDialog.open}
        onClose={() => setPiaDialog({ open: false })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Privacy Impact Assessment</DialogTitle>
        <DialogContent>
          {piaDialog.pia && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Processing Activity: {piaDialog.pia.processingActivity}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                Data Types
              </Typography>
              <Box sx={{ mb: 2 }}>
                {piaDialog.pia.dataTypes?.map((type, idx) => (
                  <Chip key={idx} label={type} size="small" sx={{ mr: 1, mb: 1 }} />
                ))}
              </Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                Lawful Basis
              </Typography>
              <Box sx={{ mb: 2 }}>
                {piaDialog.pia.lawfulBasis?.map((basis, idx) => (
                  <Chip key={idx} label={basis} size="small" sx={{ mr: 1, mb: 1 }} />
                ))}
              </Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                Risks
              </Typography>
              <ul>
                {piaDialog.pia.risks?.map((risk, idx) => (
                  <li key={idx}><Typography variant="body2">{risk}</Typography></li>
                ))}
              </ul>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold" sx={{ mt: 2 }}>
                Mitigations
              </Typography>
              <ul>
                {piaDialog.pia.mitigations?.map((mitigation, idx) => (
                  <li key={idx}><Typography variant="body2">{mitigation}</Typography></li>
                ))}
              </ul>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPiaDialog({ open: false })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrivacyPage;