import React from 'react';
import { Card, CardContent, Box, Typography, IconButton, Chip } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

const MetricCard = ({ 
  title, 
  value, 
  icon, 
  color = 'primary', 
  change, 
  changeType = 'positive',
  onClick,
  loading = false 
}) => {
  const getTrendIcon = () => {
    if (!change) return null;
    return changeType === 'positive' ? 
      <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} /> : 
      <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />;
  };

  return (
    <Card 
      sx={{ 
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: 4
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold" sx={{ mb: 1 }}>
              {loading ? '---' : value}
            </Typography>
            {change && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {getTrendIcon()}
                <Typography 
                  variant="body2" 
                  color={changeType === 'positive' ? 'success.main' : 'error.main'}
                  fontWeight="medium"
                >
                  {change}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  vs last period
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: `${color}.main`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ml: 2
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MetricCard;