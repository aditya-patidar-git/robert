import React from 'react';
import { Box, Typography, Grid, Paper, Chip, CircularProgress } from '@mui/material';

const ComplianceReportTab = ({ state }) => {
  const {
    complianceReport,
    complianceLoading
  } = state;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Compliance Report
      </Typography>
      {complianceLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        complianceReport ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Metrics
                </Typography>
                <Typography variant="body2">Total Calls: {complianceReport.metrics?.totalCalls || 0}</Typography>
                <Typography variant="body2">Consent Rate: {((complianceReport.metrics?.consentRate || 0) * 100).toFixed(1)}%</Typography>
                <Typography variant="body2">DSAR Requests: {complianceReport.metrics?.dsarRequests || 0}</Typography>
                <Typography variant="body2">Data Exports: {complianceReport.metrics?.dataExports || 0}</Typography>
                <Typography variant="body2">Data Deletions: {complianceReport.metrics?.dataDeletions || 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Compliance Status
                </Typography>
                <Chip
                  label={complianceReport.complianceStatus || 'unknown'}
                  color={complianceReport.complianceStatus === 'compliant' ? 'success' : 'warning'}
                  sx={{ mb: 2 }}
                />
                <Typography variant="subtitle2" gutterBottom>
                  Recommendations
                </Typography>
                {complianceReport.recommendations && complianceReport.recommendations.length > 0 ? (
                  <ul>
                    {complianceReport.recommendations.map((rec, idx) => (
                      <li key={idx}>
                        <Typography variant="body2">{rec}</Typography>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recommendations available
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No compliance report data available
            </Typography>
          </Box>
        )
      )}
    </Box>
  );
};

export default ComplianceReportTab;



