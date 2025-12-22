import React from 'react';
import { Paper, Box, Typography } from '@mui/material';

/**
 * Reusable Chart Container Component
 * Provides consistent styling for charts
 */
const ChartContainer = ({ 
  title, 
  subtitle = null,
  children, 
  height = 300,
  actions = null,
  loading = false
}) => {
  return (
    <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: subtitle ? 0.5 : 0 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box>{actions}</Box>}
      </Box>
      
      <Box 
        sx={{ 
          flex: 1, 
          minHeight: height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        {loading ? (
          <Typography variant="body2" color="text.secondary">
            Loading chart data...
          </Typography>
        ) : (
          children
        )}
      </Box>
    </Paper>
  );
};

export default ChartContainer;

