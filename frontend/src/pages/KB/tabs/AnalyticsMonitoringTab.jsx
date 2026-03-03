import React, { useState } from 'react';
import { Box, Paper, Typography, Button, FormControl, InputLabel, Select, MenuItem, List, ListItem, ListItemText, Alert, CircularProgress, LinearProgress } from '@mui/material';
import { PlayArrow, FileDownload } from '@mui/icons-material';
import testRetrievalService from '../../../services/testRetrievalService';
import provenanceService from '../../../services/provenanceService';
import { useToast } from '../../../components/common/ToastProvider';

const AnalyticsMonitoringTab = ({ state }) => {
  const { showSuccess, showError } = useToast();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const {
    testResults,
    setTestResults,
    provenanceData,
    setProvenanceData,
    analyticsTimeRange,
    setAnalyticsTimeRange
  } = state;

  const handleRunTest = async () => {
    setIsTestRunning(true);
    try {
      const result = await testRetrievalService.testRetrieval();
      // Extract data from normalized response, or use result directly if not normalized
      const testData = result.data || result;
      setTestResults(testData);
      showSuccess('Retrieval test completed');
    } catch (error) {
      showError('Failed to run retrieval test');
    } finally {
      setIsTestRunning(false);
    }
  };

  const handleLoadAnalytics = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      const days = analyticsTimeRange === '24h' ? 1 : analyticsTimeRange === '7d' ? 7 : analyticsTimeRange === '30d' ? 30 : 90;
      startDate.setDate(startDate.getDate() - days);
      
      const result = await provenanceService.getProvenanceAnalytics({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      // Extract data from normalized response, or use result directly if not normalized
      const analyticsData = result.data?.analytics || result.analytics || result.data || result;
      setProvenanceData(analyticsData);
      showSuccess('Provenance analytics loaded');
    } catch (error) {
      showError('Failed to load provenance analytics');
    }
  };

  const handleExportData = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      const days = analyticsTimeRange === '24h' ? 1 : analyticsTimeRange === '7d' ? 7 : analyticsTimeRange === '30d' ? 30 : 90;
      startDate.setDate(startDate.getDate() - days);

      const result = await provenanceService.exportProvenanceData(
        null,
        startDate.toISOString(),
        endDate.toISOString()
      );

      const exportData = result.data?.data || result.data || result;
      if (!Array.isArray(exportData)) {
        showError('Export returned no data or invalid format');
        return;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const baseName = `provenance-analytics-${dateStr}`;
      const escapeCsv = (v) => {
        if (v == null) return '';
        const s = String(v);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const headers = ['callId', 'sessionId', 'query', 'filesUsed', 'similarityScores', 'timestamp', 'model', 'confidence'];
      const rows = exportData.map((row) => [
        escapeCsv(row.callId),
        escapeCsv(row.sessionId),
        escapeCsv(row.query),
        escapeCsv(Array.isArray(row.filesUsed) ? row.filesUsed.join('; ') : row.filesUsed),
        escapeCsv(Array.isArray(row.similarityScores) ? row.similarityScores.join('; ') : row.similarityScores),
        escapeCsv(row.timestamp ? new Date(row.timestamp).toISOString() : ''),
        escapeCsv(row.model),
        escapeCsv(row.confidence != null ? String(row.confidence) : '')
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess('Analytics data exported');
    } catch (error) {
      showError('Failed to export analytics data');
    }
  };

  return (
    <Box>
      {/* Retrieval Testing */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Retrieval Testing
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Test the knowledge base search functionality with various queries to ensure proper operation.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={isTestRunning ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
              onClick={handleRunTest}
              disabled={isTestRunning}
            >
              {isTestRunning ? 'Running Tests...' : 'Run Comprehensive Test'}
            </Button>
          </Box>
          {isTestRunning && (
            <Box sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ mb: 1 }}>
                Running comprehensive retrieval tests. This may take a few moments...
              </Alert>
              <LinearProgress />
            </Box>
          )}
        </Box>

        {testResults && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>Test Results</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Total Tests</Typography>
                <Typography variant="h6">{testResults.totalTests || 0}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Successful</Typography>
                <Typography variant="h6" color="success.main">{testResults.successfulTests || 0}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Failed</Typography>
                <Typography variant="h6" color="error.main">{testResults.failedTests || 0}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Success Rate</Typography>
                <Typography variant="h6">
                  {testResults.totalTests ? ((testResults.successfulTests / testResults.totalTests) * 100).toFixed(1) : 0}%
                </Typography>
              </Box>
            </Box>

            {testResults.testResults && testResults.testResults.length > 0 && (
              <List>
                {testResults.testResults.map((result, index) => (
                  <ListItem key={`${result.query ?? ''}-${index}`} divider>
                    <ListItemText
                      primary={`Query: "${result.query}"`}
                      secondary={
                        result.success ?
                          `✅ Success - File Search: ${result.fileSearchResults?.totalResults || 0}, DB: ${result.databaseResults?.totalResults || 0}` :
                          `❌ Failed - ${result.error}`
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Paper>

      {/* Provenance Analytics */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Provenance Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Track which knowledge base files are used in calls and analyze usage patterns.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={analyticsTimeRange}
              onChange={(e) => {
                setAnalyticsTimeRange(e.target.value);
                setProvenanceData(null);
              }}
              label="Time Range"
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={handleLoadAnalytics}
          >
            Load Analytics
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExportData}
          >
            Export CSV
          </Button>
        </Box>

        {provenanceData && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>Analytics Summary</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Records</Typography>
                <Typography variant="h6">{provenanceData.totalRecords ?? 0}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Calls</Typography>
                <Typography variant="h6">{provenanceData.totalCalls ?? 0}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Files</Typography>
                <Typography variant="h6">{provenanceData.totalFiles ?? 0}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Avg Similarity</Typography>
                <Typography variant="h6">
                  {typeof provenanceData.averageSimilarityScore === 'number'
                    ? (provenanceData.averageSimilarityScore * 100).toFixed(1) + '%'
                    : '—'}
                </Typography>
              </Box>
            </Box>

            {Array.isArray(provenanceData.mostUsedFiles) && provenanceData.mostUsedFiles.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Most Used Files</Typography>
                <List dense disablePadding sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                  {provenanceData.mostUsedFiles.map((item, idx) => (
                    <ListItem key={item.fileId ?? idx}>
                      <ListItemText
                        primary={item.fileId}
                        secondary={`Used ${item.count} time${item.count !== 1 ? 's' : ''}`}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {Array.isArray(provenanceData.queryPatterns) && provenanceData.queryPatterns.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Top Query Patterns</Typography>
                <List dense disablePadding sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                  {provenanceData.queryPatterns.map((item, idx) => (
                    <ListItem key={`${item.query ?? ''}-${idx}`}>
                      <ListItemText
                        primary={item.query}
                        secondary={`${item.count} time${item.count !== 1 ? 's' : ''}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {provenanceData.timeDistribution && typeof provenanceData.timeDistribution === 'object' && Object.keys(provenanceData.timeDistribution).length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Usage by Hour (UTC)</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(provenanceData.timeDistribution)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([hour, count]) => (
                      <Typography key={hour} component="span" variant="body2" sx={{ px: 1, py: 0.5, bgcolor: 'action.selected', borderRadius: 1 }}>
                        {hour}:00 — {count}
                      </Typography>
                    ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AnalyticsMonitoringTab;



