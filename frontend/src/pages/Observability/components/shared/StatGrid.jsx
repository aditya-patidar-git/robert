import React from 'react';
import { Grid } from '@mui/material';
import MetricCard from './MetricCard';

/**
 * Reusable Statistics Grid Component
 * Displays multiple metric cards in a responsive grid
 */
const StatGrid = ({ 
  metrics = [], 
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
  spacing = 3
}) => {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  return (
    <Grid container spacing={spacing}>
      {metrics.map((metric, index) => (
        <Grid item {...columns} key={metric.id || index}>
          <MetricCard {...metric} />
        </Grid>
      ))}
    </Grid>
  );
};

export default StatGrid;

