import React from 'react';
import { Box } from '@mui/material';
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

  // Convert columns prop to flexbox breakpoints
  const getFlexValue = (cols) => {
    if (cols === 1) return '1 1 100%';
    if (cols === 2) return '1 1 calc(50% - 12px)';
    if (cols === 3) return '1 1 calc(33.333% - 16px)';
    if (cols === 4) return '1 1 calc(25% - 18px)';
    return '1 1 100%';
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: spacing 
    }}>
      {metrics.map((metric, index) => (
        <Box 
          key={metric.id || index}
          sx={{ 
            flex: {
              xs: getFlexValue(columns.xs || 1),
              sm: getFlexValue(columns.sm || columns.xs || 1),
              md: getFlexValue(columns.md || columns.sm || columns.xs || 1),
              lg: getFlexValue(columns.lg || columns.md || columns.sm || columns.xs || 1)
            },
            minWidth: 0
          }}
        >
          <MetricCard {...metric} />
        </Box>
      ))}
    </Box>
  );
};

export default StatGrid;

