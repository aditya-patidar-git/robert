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
  );
};

export default ComplianceReportTab;



