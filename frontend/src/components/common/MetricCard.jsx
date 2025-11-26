import React from 'react';
import { Card, CardContent, Box, Typography, Skeleton } from '@mui/material';
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
      <TrendingUp sx={{ fontSize: 14, mr: 0.5 }} /> :
      <TrendingDown sx={{ fontSize: 14, mr: 0.5 }} />;
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: 2,
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 3
        } : {},
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 3, pb: '24px !important' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Header with Icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {title}
            </Typography>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                backgroundColor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: 0.9
              }}
            >
              {React.cloneElement(icon, { sx: { fontSize: 20 } })}
            </Box>
          </Box>

          {/* Value */}
          <Box>
            {loading ? (
              <Skeleton variant="text" width="60%" height={44} />
            ) : (
              <Typography 
                variant="h3" 
                component="div" 
                sx={{ 
                  fontWeight: 700,
                  fontSize: '2rem',
                  lineHeight: 1.2,
                  color: 'text.primary'
                }}
              >
                {value?.toLocaleString() || 0}
              </Typography>
            )}
            
            {/* Change Indicator */}
            {change && !loading && (
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  mt: 1,
                  color: changeType === 'positive' ? 'success.main' : 'error.main'
                }}
              >
                {getTrendIcon()}
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontSize: '0.8125rem',
                    fontWeight: 600
                  }}
                >
                  {change}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    ml: 0.5
                  }}
                >
                  vs last week
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MetricCard;