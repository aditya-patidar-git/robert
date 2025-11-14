import React from 'react';
import { Box, Paper, Typography, Button, FormControl, InputLabel, Select, MenuItem, List, ListItem, ListItemText, Alert } from '@mui/material';
import { PlayArrow, FileDownload } from '@mui/icons-material';
import testRetrievalService from '../../../services/testRetrievalService';
import provenanceService from '../../../services/provenanceService';
import { useToast } from '../../../components/common/ToastProvider';

const AnalyticsMonitoringTab = ({ state, handlers }) => {
  const { showSuccess, showError } = useToast();
  const {
    testResults,
    setTestResults,
    provenanceData,
    setProvenanceData,
    analyticsTimeRange,
    setAnalyticsTimeRange
  } = state;

  const handleRunTest = async () => {
    try {
      const result = await testRetrievalService.testRetrieval();
      setTestResults(result);
      showSuccess('Retrieval test completed');
    } catch (error) {
      showError('Failed to run retrieval test');
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
      setProvenanceData(result.analytics || result);
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
      
      const exportData = result.data || result;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `provenance-analytics-${new Date().toISOString().split('T')[0]}.json`;
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

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={handleRunTest}
          >
            Run Comprehensive Test
          </Button>
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
                  <ListItem key={index} divider>
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
            Export Data
          </Button>
        </Box>

        {provenanceData && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>Analytics Summary</Typography>
            <Alert severity="info">
              Analytics data loaded. Total records: {provenanceData.totalRecords || 0}
            </Alert>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AnalyticsMonitoringTab;



