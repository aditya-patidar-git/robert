import React from 'react';
import { Box, Typography, Card, CardContent, Chip, CircularProgress, Divider } from '@mui/material';
import { Assessment as AssessmentIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';

const cardSx = {
  height: '100%',
  borderRadius: 2,
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  '&:hover': {
    boxShadow: 2,
    borderColor: 'divider'
  }
};

const ComplianceReportTab = ({ state }) => {
  const {
    complianceReport,
    complianceLoading
  } = state;

  const metrics = complianceReport?.metrics ?? {};
  const recommendations = Array.isArray(complianceReport?.recommendations) ? complianceReport.recommendations : [];
  const status = complianceReport?.complianceStatus ?? 'unknown';

  return (
    <Box sx={{ p: 3 }}>
      {complianceLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : complianceReport ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' }, minWidth: { md: '300px' } }}>
            <Card variant="outlined" sx={cardSx}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <AssessmentIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight="600" color="text.primary">
                    Metrics
                  </Typography>
                </Box>
                <Divider sx={{ mb: 1.5 }} />
                <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography component="li" variant="body2">
                    Total Calls: {metrics.totalCalls ?? 0}
                  </Typography>
                  <Typography component="li" variant="body2">
                    Consent Rate: {typeof metrics.consentRate === 'number' ? (metrics.consentRate * 100).toFixed(1) : '0'}%
                  </Typography>
                  <Typography component="li" variant="body2">
                    DSAR Requests: {metrics.dsarRequests ?? 0}
                  </Typography>
                  <Typography component="li" variant="body2">
                    Data Exports: {metrics.dataExports ?? 0}
                  </Typography>
                  <Typography component="li" variant="body2">
                    Data Deletions: {metrics.dataDeletions ?? 0}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' }, minWidth: { md: '300px' } }}>
            <Card variant="outlined" sx={cardSx}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: status === 'compliant' ? 'success.main' : 'warning.main',
                      color: status === 'compliant' ? 'success.contrastText' : 'warning.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight="600" color="text.primary">
                    Compliance Status
                  </Typography>
                </Box>
                <Divider sx={{ mb: 1.5 }} />
                <Chip
                  label={String(status)}
                  color={status === 'compliant' ? 'success' : 'warning'}
                  size="small"
                  sx={{ mb: 2 }}
                />
                <Typography variant="subtitle2" fontWeight="600" color="text.secondary" gutterBottom>
                  Recommendations
                </Typography>
                {recommendations.length > 0 ? (
                  <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {recommendations.map((rec, idx) => (
                      <Typography component="li" key={idx} variant="body2" color="text.primary">
                        {typeof rec === 'string' ? rec : String(rec)}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recommendations available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      ) : (
        <Card variant="outlined" sx={cardSx}>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No compliance report data available
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ComplianceReportTab;
