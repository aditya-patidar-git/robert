import React from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, Stack, Avatar, Chip, LinearProgress, Alert, Divider, Button } from '@mui/material';
import { Storage, TrendingUp, Sync, CheckCircle as CheckCircleIcon, ErrorOutline, AccessTime, Update } from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

const SystemOperationsTab = ({ state, handlers }) => {
  const {
    vectorStoreStatus,
    vectorStoreLoading,
    vectorStoreError,
    driftStatus,
    driftLoading,
    driftError,
    reingestStatus,
    reingestLoading,
    reingestError
  } = state;

  return (
    <Box>
      {/* System Status Dashboard */}
      <Paper sx={{ p: 4, mb: 3, borderRadius: 2 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom fontWeight="bold">
            System Status Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor the overall health and status of all system operations
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Vector Store Status Card */}
          <Grid item xs={12} md={4}>
            <Card 
              sx={{ 
                height: '100%',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: (vectorStoreStatus?.status === 'active' || vectorStoreStatus?.status === 'completed') 
                        ? 'success.light' 
                        : 'grey.300',
                      width: 48,
                      height: 48
                    }}
                  >
                    <Storage />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight="600">
                      Vector Store
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Knowledge Base Storage
                    </Typography>
                  </Box>
                </Stack>

                {vectorStoreLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress sx={{ flexGrow: 1 }} />
                    <Typography variant="caption">Loading...</Typography>
                  </Box>
                ) : vectorStoreError ? (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {vectorStoreError.message}
                  </Alert>
                ) : vectorStoreStatus && (vectorStoreStatus.id || vectorStoreStatus.status) ? (
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="500">
                          Status
                        </Typography>
                        <Chip
                          label={vectorStoreStatus.status === 'completed' ? 'Active' : (vectorStoreStatus.status || 'Unknown')}
                          color={vectorStoreStatus.status === 'active' || vectorStoreStatus.status === 'completed' ? 'success' : 'default'}
                          size="small"
                          icon={vectorStoreStatus.status === 'active' || vectorStoreStatus.status === 'completed' ? <CheckCircleIcon /> : <ErrorOutline />}
                        />
                      </Stack>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="h4" fontWeight="bold" color="primary.main">
                        {vectorStoreStatus.fileCount || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total Files
                      </Typography>
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Update fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Last Updated
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight="500" sx={{ mt: 0.5 }}>
                        {vectorStoreStatus.lastUpdated ? formatDateTime(vectorStoreStatus.lastUpdated) : 'N/A'}
                      </Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Unable to load vector store status
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Drift Detection Status Card */}
          <Grid item xs={12} md={4}>
            <Card 
              sx={{ 
                height: '100%',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: driftStatus?.filesWithDrift > 0 ? 'warning.light' : 'info.light',
                      width: 48,
                      height: 48
                    }}
                  >
                    <TrendingUp />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight="600">
                      Drift Detection
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Content Change Monitoring
                    </Typography>
                  </Box>
                </Stack>

                {driftLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress sx={{ flexGrow: 1 }} />
                    <Typography variant="caption">Loading...</Typography>
                  </Box>
                ) : driftError ? (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {driftError.message}
                  </Alert>
                ) : driftStatus && (driftStatus.totalFiles !== undefined || driftStatus.lastCheck) ? (
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="500">
                          Total Files
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {driftStatus.totalFiles || 0}
                        </Typography>
                      </Stack>
                      {driftStatus.totalFiles > 0 && (
                        <LinearProgress 
                          variant="determinate" 
                          value={((driftStatus.totalFiles - (driftStatus.filesWithDrift || 0)) / driftStatus.totalFiles) * 100}
                          sx={{ height: 6, borderRadius: 3 }}
                          color={driftStatus.filesWithDrift > 0 ? 'warning' : 'success'}
                        />
                      )}
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="h4" fontWeight="bold" color={driftStatus.filesWithDrift > 0 ? 'warning.main' : 'success.main'}>
                        {driftStatus.filesWithDrift || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Files with Drift
                      </Typography>
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AccessTime fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Last Check
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight="500" sx={{ mt: 0.5 }}>
                        {driftStatus.lastCheck ? formatDateTime(driftStatus.lastCheck) : 'Never'}
                      </Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No drift detection data available
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Reingest Status Card */}
          <Grid item xs={12} md={4}>
            <Card 
              sx={{ 
                height: '100%',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: reingestStatus?.isRunning ? 'warning.light' : 'primary.light',
                      width: 48,
                      height: 48
                    }}
                  >
                    <Sync />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight="600">
                      Reingest Status
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      File Processing Queue
                    </Typography>
                  </Box>
                </Stack>

                {reingestLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress sx={{ flexGrow: 1 }} />
                    <Typography variant="caption">Loading...</Typography>
                  </Box>
                ) : reingestError ? (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {reingestError.message}
                  </Alert>
                ) : reingestStatus && (reingestStatus.isRunning !== undefined || reingestStatus.lastRun) ? (
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="500">
                          Status
                        </Typography>
                        <Chip
                          label={reingestStatus.isRunning ? 'Running' : 'Idle'}
                          color={reingestStatus.isRunning ? 'warning' : 'default'}
                          size="small"
                          icon={reingestStatus.isRunning ? <Sync /> : <CheckCircleIcon />}
                        />
                      </Stack>
                      {reingestStatus.isRunning && (
                        <LinearProgress sx={{ mt: 1, height: 6, borderRadius: 3 }} />
                      )}
                    </Box>
                    <Divider />
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                        <Box>
                          <Typography variant="h4" fontWeight="bold" color="success.main">
                            {reingestStatus.filesProcessed || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Files Processed
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="h4" fontWeight="bold" color="error.main">
                            {reingestStatus.filesFailed || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Files Failed
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AccessTime fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Last Run
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight="500" sx={{ mt: 0.5 }}>
                        {reingestStatus.lastRun ? formatDateTime(reingestStatus.lastRun) : 'Never'}
                      </Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No reingest data available
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default SystemOperationsTab;



