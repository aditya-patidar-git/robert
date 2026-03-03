import React from 'react';
import { Paper, Typography, Box, Chip } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

/**
 * Reusable Metric Card Component
 * Displays a single metric with optional trend indicator
 */
const MetricCard = ({ 
  title, 
  value, 
  unit = '', 
  trend = null, 
  trendLabel = null,
  color = 'primary',
  icon: Icon = null,
  subtitle = null,
  size = 'medium', // 'small' | 'medium' | 'large'
  type = null // 'percentage' | 'duration' for special formatting
}) => {
  const sizeStyles = {
    small: { padding: 1.5, titleVariant: 'body2', valueVariant: 'h6' },
    medium: { padding: 2, titleVariant: 'body2', valueVariant: 'h5' },
    large: { padding: 3, titleVariant: 'body1', valueVariant: 'h4' }
  };

  const styles = sizeStyles[size] || sizeStyles.medium;

  const formatValue = (val, valueType) => {
    if (val == null || typeof val !== 'number' || Number.isNaN(val)) return '–';
    if (valueType === 'percentage') return `${(val * 100).toFixed(1)}%`;
    if (valueType === 'duration') return `${Number(val).toFixed(2)} s`;
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    if (val < 1 && val > 0) return val.toFixed(3);
    return val.toFixed(1);
  };

  const displayValue = (type === 'percentage' || type === 'duration'
    ? formatValue(value, type)
    : `${formatValue(value)}${unit ? ` ${unit}` : ''}`) || '–';

  const getTrendColor = () => {
    if (!trend) return 'default';
    return trend > 0 ? 'success' : trend < 0 ? 'error' : 'default';
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: styles.padding,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          {Icon && <Icon color={color} fontSize="small" />}
          <Typography 
            variant={styles.titleVariant} 
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            {title}
          </Typography>
        </Box>
        {trend !== null && (
          <Chip
            icon={trend > 0 ? <TrendingUp /> : <TrendingDown />}
            label={trendLabel || `${Math.abs(trend)}%`}
            size="small"
            color={getTrendColor()}
            variant="outlined"
          />
        )}
      </Box>
      
      <Typography 
        variant={styles.valueVariant}
        sx={{ 
          fontWeight: 700,
          color: `${color}.main`,
          mb: subtitle ? 0.5 : 0
        }}
      >
        {displayValue}
      </Typography>
      
      {subtitle && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Paper>
  );
};

export default MetricCard;

