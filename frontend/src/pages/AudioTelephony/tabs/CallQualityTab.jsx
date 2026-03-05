import React from 'react';
import { Paper, Box, Typography, FormControl, InputLabel, Select, MenuItem, IconButton, LinearProgress, Alert, Grid, Card, CardContent, Chip, Stack } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const CallQualityTab = ({ state }) => {
  const {
    audioMetrics,
    audioMetricsLoading,
    audioMetricsError,
    refetchAudioMetrics,
    historicalMetrics,
    historicalLoading,
    callQualityTimeRange,
    setCallQualityTimeRange
  } = state;

  return (
    <Paper sx={{ p: 3, mb: 3, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
            Call Quality Metrics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time audio quality monitoring and performance metrics
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={callQualityTimeRange}
              label="Time Range"
              onChange={(e) => setCallQualityTimeRange(e.target.value)}
            >
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={() => refetchAudioMetrics()} disabled={audioMetricsLoading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {audioMetricsLoading && (
        <Box sx={{ py: 4 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Loading metrics...
          </Typography>
        </Box>
      )}

      {audioMetricsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading audio metrics: {audioMetricsError.message || 'Unknown error'}
        </Alert>
      )}

      {!audioMetricsLoading && !audioMetricsError && (!audioMetrics?.metrics || audioMetrics.metrics.totalCalls === 0) && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No call quality data available for the selected time range. Metrics will appear here once calls are completed.
        </Alert>
      )}

      {!audioMetricsLoading && !audioMetricsError && audioMetrics?.metrics && audioMetrics.metrics.totalCalls > 0 && (
        <>
          {audioMetrics.metrics.lastUpdated && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Last updated: {new Date(audioMetrics.metrics.lastUpdated).toLocaleString()}
            </Typography>
          )}
          <Grid container spacing={3} sx={{ width: '100%' }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h4" color="primary">
                    {audioMetrics.metrics.averageLatency?.toFixed(1) || '0'}ms
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Average Latency
                  </Typography>
                  {audioMetrics.metrics.minLatency !== null && audioMetrics.metrics.maxLatency !== null && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Range: {audioMetrics.metrics.minLatency?.toFixed(1)} - {audioMetrics.metrics.maxLatency?.toFixed(1)}ms
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h4" color="success.main">
                    {audioMetrics.metrics.mosScore?.toFixed(2) || '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    MOS Score
                  </Typography>
                  {audioMetrics.metrics.callQuality && (
                    <Chip 
                      label={audioMetrics.metrics.callQuality} 
                      size="small" 
                      color={
                        audioMetrics.metrics.callQuality === 'excellent' ? 'success' :
                        audioMetrics.metrics.callQuality === 'good' ? 'info' :
                        audioMetrics.metrics.callQuality === 'fair' ? 'warning' : 'error'
                      }
                      sx={{ mt: 1 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h4" color="warning.main">
                    {audioMetrics.metrics.packetLoss?.toFixed(2) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Packet Loss
                  </Typography>
                  {audioMetrics.metrics.minPacketLoss !== null && audioMetrics.metrics.maxPacketLoss !== null && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Range: {audioMetrics.metrics.minPacketLoss?.toFixed(2)} - {audioMetrics.metrics.maxPacketLoss?.toFixed(2)}%
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h4" color="info.main">
                    {audioMetrics.metrics.jitter?.toFixed(2) || '0'}ms
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Jitter
                  </Typography>
                  {audioMetrics.metrics.minJitter !== null && audioMetrics.metrics.maxJitter !== null && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Range: {audioMetrics.metrics.minJitter?.toFixed(2)} - {audioMetrics.metrics.maxJitter?.toFixed(2)}ms
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            {audioMetrics.metrics.totalCalls > 0 && (
              <Grid size={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Summary Statistics
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total Calls: {audioMetrics.metrics.totalCalls}
                    </Typography>
                    {audioMetrics.metrics.qualityDistribution && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Quality Distribution:
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip label={`Excellent: ${audioMetrics.metrics.qualityDistribution.excellent}`} size="small" color="success" />
                          <Chip label={`Good: ${audioMetrics.metrics.qualityDistribution.good}`} size="small" color="info" />
                          <Chip label={`Fair: ${audioMetrics.metrics.qualityDistribution.fair}`} size="small" color="warning" />
                          <Chip label={`Poor: ${audioMetrics.metrics.qualityDistribution.poor}`} size="small" color="error" />
                        </Stack>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Historical Trend Charts */}
          {historicalMetrics?.data && historicalMetrics.data.length > 0 && (
            <Grid container spacing={3} sx={{ mt: 2, width: '100%' }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Latency Trend
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={historicalMetrics.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                        <RechartsTooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                          formatter={(value) => [`${value?.toFixed(1)}ms`, 'Latency']}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="latency" 
                          stroke="#1976d2" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Latency (ms)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Jitter Trend
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={historicalMetrics.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                        <RechartsTooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                          formatter={(value) => [`${value?.toFixed(2)}ms`, 'Jitter']}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="jitter" 
                          stroke="#0288d1" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Jitter (ms)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Packet Loss Trend
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={historicalMetrics.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                        <RechartsTooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                          formatter={(value) => [`${value?.toFixed(2)}%`, 'Packet Loss']}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="packetLoss" 
                          stroke="#ed6c02" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Packet Loss (%)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      MOS Score Trend
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={historicalMetrics.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis domain={[1, 5]} label={{ value: 'MOS', angle: -90, position: 'insideLeft' }} />
                        <RechartsTooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                          formatter={(value) => [`${value?.toFixed(2)}`, 'MOS Score']}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="mosScore" 
                          stroke="#2e7d32" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="MOS Score"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Paper>
  );
};

export default CallQualityTab;



