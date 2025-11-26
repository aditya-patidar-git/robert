import React from 'react';
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
import { formatDateTime } from '../../../utils/formatters';

const AlertsTab = ({
  alertsData,
  alertsLoading,
  acknowledgeAlertMutation,
  resolveAlertMutation
}) => {
  return (
    <Paper>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Active Alerts ({alertsData.length})
        </Typography>
      </Box>
      {alertsLoading ? (
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : alertsData.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
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
              {alertsData.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <Chip
                      label={alert.severity}
                      color={alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{alert.title}</TableCell>
                  <TableCell>{alert.message}</TableCell>
                  <TableCell>{alert.component}</TableCell>
                  <TableCell>{formatDateTime(alert.createdAt)}</TableCell>
                  <TableCell>
                    {alert.status === 'active' && (
                      <>
                        <Tooltip title="Acknowledge">
                          <IconButton
                            size="small"
                            onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                          >
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Resolve">
                          <IconButton
                            size="small"
                            onClick={() => resolveAlertMutation.mutate(alert.id)}
                          >
                            <Cancel fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default AlertsTab;

