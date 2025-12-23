import React from 'react';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import { DataUsage, Description, VolumeUp } from '@mui/icons-material';

/**
 * Retention Status Tab Component
 * Displays data retention status and statistics
 */
export function RetentionStatusTab({ retention, loading }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const stats = [
    {
      title: 'Call Records',
      count: retention?.callRecords?.total || 0,
      retained: retention?.callRecords?.retained || 0,
      icon: <DataUsage />,
      color: 'primary'
    },
    {
      title: 'Transcripts',
      count: retention?.transcripts?.total || 0,
      retained: retention?.transcripts?.retained || 0,
      icon: <Description />,
      color: 'secondary'
    },
    {
      title: 'Audio Files',
      count: retention?.audioFiles?.total || 0,
      retained: retention?.audioFiles?.retained || 0,
      icon: <VolumeUp />,
      color: 'success'
    }
  ];

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>Data Retention Status</Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {stats.map((stat) => {
          const percentage = stat.count > 0 ? (stat.retained / stat.count) * 100 : 0;
          return (
            <Box key={stat.title} sx={{ width: { xs: '100%', md: 'calc(33.333% - 16px)' }, minWidth: { md: '250px' } }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ color: `${stat.color}.main`, mr: 2 }}>
                      {stat.icon}
                    </Box>
                    <Typography variant="h6">{stat.title}</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ mb: 1 }}>
                    {stat.retained} / {stat.count}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={percentage}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {percentage.toFixed(1)}% retained
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

