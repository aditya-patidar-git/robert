import React from 'react';
import { Box, Typography, Card, CardContent, CircularProgress, Divider } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

const cardSx = {
  height: '100%',
  borderRadius: 2,
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  '&:hover': {
    boxShadow: 2,
    borderColor: 'divider'
  }
};

const RetentionStatusTab = ({ state, handlers }) => {
  const {
    retentionPolicies,
    retentionLoading
  } = state;

  const { cleanupMutation } = handlers;

  return (
    <Box sx={{ p: 3 }}>
      {retentionLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {retentionPolicies && Object.keys(retentionPolicies).length > 0 ? (
            Object.entries(retentionPolicies).map(([dataType, check]) => (
              <Box key={dataType} sx={{ width: { xs: '100%', md: 'calc(33.333% - 16px)' }, minWidth: { md: '250px' } }}>
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
                        <ScheduleIcon sx={{ fontSize: 20 }} />
                      </Box>
                      <Typography variant="subtitle1" fontWeight="600" color="text.primary">
                        {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: 1.5 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Cutoff Date: {check?.cutoffDate != null ? formatDateTime(check.cutoffDate) : '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Records to Delete: {typeof check?.recordsToDelete === 'number' ? check.recordsToDelete : 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            ))
          ) : (
            <Box sx={{ width: '100%' }}>
              <Card variant="outlined" sx={cardSx}>
                <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No retention policy data available
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default RetentionStatusTab;
