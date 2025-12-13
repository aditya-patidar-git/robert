import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { formatDateTime, truncateText } from '../../../utils/formatters';

const AlertsTab = ({
  alertsData,
  alertsLoading,
  acknowledgeAlertMutation,
  resolveAlertMutation
}) => {
  const [processingAlertId, setProcessingAlertId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);

  const truncateMessage = (message, maxLength = 80) => {
    if (!message) return 'N/A';
    return truncateText(message, maxLength);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleAcknowledge = (alertId) => {
    setProcessingAlertId(alertId);
    setProcessingAction('acknowledge');
    acknowledgeAlertMutation.mutate(alertId, {
      onSettled: () => {
        setProcessingAlertId(null);
        setProcessingAction(null);
      }
    });
  };

  const handleResolve = (alertId) => {
    setProcessingAlertId(alertId);
    setProcessingAction('resolve');
    resolveAlertMutation.mutate(alertId, {
      onSettled: () => {
        setProcessingAlertId(null);
        setProcessingAction(null);
      }
    });
  };

  return (
    <Paper>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Active Alerts ({alertsData?.length || 0})
        </Typography>
      </Box>
      {alertsLoading ? (
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : !alertsData || alertsData.length === 0 ? (
        <Box sx={{ 
          p: 3, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 200
        }}>
          <Typography color="text.secondary">No active alerts</Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Severity</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Component</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alertsData.map((alert) => {
                const isProcessing = processingAlertId === alert.id;
                const isAcknowledging = isProcessing && processingAction === 'acknowledge';
                const isResolving = isProcessing && processingAction === 'resolve';
                const fullMessage = alert.message || 'N/A';
                const truncatedMessage = truncateMessage(fullMessage, 80);
                const isMessageTruncated = fullMessage !== 'N/A' && fullMessage.length > 80;

                return (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Chip
                        label={alert.severity || 'unknown'}
                        color={getSeverityColor(alert.severity)}
                        size="small"
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {alert.title || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {isMessageTruncated ? (
                        <Tooltip title={fullMessage} arrow>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              cursor: 'help',
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {truncatedMessage}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2">
                          {truncatedMessage}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        fontFamily="monospace" 
                        fontSize="0.75rem"
                      >
                        {alert.component || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {alert.createdAt ? formatDateTime(alert.createdAt) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {alert.status === 'active' && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Acknowledge">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleAcknowledge(alert.id)}
                                disabled={isProcessing || acknowledgeAlertMutation.isLoading || resolveAlertMutation.isLoading}
                                color="success"
                              >
                                {isAcknowledging ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <CheckCircle fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Resolve">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleResolve(alert.id)}
                                disabled={isProcessing || acknowledgeAlertMutation.isLoading || resolveAlertMutation.isLoading}
                                color="error"
                              >
                                {isResolving ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <Cancel fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default AlertsTab;

