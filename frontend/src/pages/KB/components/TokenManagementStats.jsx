import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, LinearProgress, Alert, Card, CardContent } from '@mui/material';
import tokenManagementService from '../../../services/tokenManagementService';
import aiService from '../../../services/aiService';

const TokenManagementStats = () => {
  const { data: tokenStats, isLoading, error } = useQuery({
    queryKey: ['token-stats'],
    queryFn: async () => {
      const stats = await tokenManagementService.getTokenStats();
      // Ensure we return the stats object directly
      return stats;
    },
    refetchInterval: 30000
  });

  const { data: aiConfig } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiService.getConfig()
  });

  const selectedModel = aiConfig?.model?.id || 'gpt-4o';
  
  const { data: contextLimit } = useQuery({
    queryKey: ['context-limit', selectedModel],
    queryFn: () => tokenManagementService.getContextLimit(selectedModel),
    enabled: !!selectedModel
  });

  if (isLoading) {
    return <LinearProgress />;
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load token statistics: {error.message}
      </Alert>
    );
  }

  return (
    <Box>
      {contextLimit && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Current Model Context Limits
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Context Limit
              </Typography>
              <Typography variant="h6">
                {contextLimit.contextLimit?.toLocaleString()} tokens
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Warning Threshold (80%)
              </Typography>
              <Typography variant="h6" color="warning.main">
                {contextLimit.warningThreshold?.toLocaleString()} tokens
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Critical Threshold (90%)
              </Typography>
              <Typography variant="h6" color="error.main">
                {contextLimit.criticalThreshold?.toLocaleString()} tokens
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {tokenStats && (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Aggregate Statistics
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mt: 2 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Calls
                </Typography>
                <Typography variant="h5">
                  {tokenStats.totalCalls || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Tokens Used
                </Typography>
                <Typography variant="h5">
                  {(tokenStats.totalTokens || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Avg Tokens/Call
                </Typography>
                <Typography variant="h5">
                  {(tokenStats.avgTokensPerCall || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Max Tokens Used
                </Typography>
                <Typography variant="h5">
                  {(tokenStats.maxTokens || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Truncations
                </Typography>
                <Typography variant="h5" color={tokenStats.totalTruncations > 0 ? 'warning.main' : 'inherit'}>
                  {tokenStats.totalTruncations || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Truncation Rate
                </Typography>
                <Typography variant="h5" color={tokenStats.truncationRate > 10 ? 'error.main' : 'inherit'}>
                  {tokenStats.truncationRate?.toFixed(1) || 0}%
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {!tokenStats && !isLoading && (
        <Alert severity="info">
          No token usage statistics available yet. Statistics will appear after calls are made.
        </Alert>
      )}
    </Box>
  );
};

export default TokenManagementStats;



