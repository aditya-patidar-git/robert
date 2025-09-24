import React, { useState } from 'react';
import { 
  Box, 
  ButtonGroup, 
  Button, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress
} from '@mui/material';
import { 
  Build, 
  PauseCircle, 
  PlayCircle,
  Settings,
  RefreshRounded
} from '@mui/icons-material';
import { useToast } from './ToastProvider';

const QuickActionsPanel = ({ onToggleMCPTools, onPauseRouting, onRefreshSystem, systemStatus }) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, title: '', message: '' });
  const [loading, setLoading] = useState({ mcp: false, routing: false, refresh: false });

  const handleAction = async (actionType, actionFn, confirmRequired = true) => {
    if (confirmRequired) {
      const confirmData = getConfirmData(actionType);
      setConfirmDialog({
        open: true,
        action: () => executeAction(actionType, actionFn),
        ...confirmData
      });
    } else {
      await executeAction(actionType, actionFn);
    }
  };

  const executeAction = async (actionType, actionFn) => {
    try {
      setLoading(prev => ({ ...prev, [actionType]: true }));
      await actionFn();
      
      const successMessage = getSuccessMessage(actionType);
      showSuccess(successMessage);
    } catch (error) {
      console.error(`${actionType} action failed:`, error);
      showError(`Failed to execute ${actionType}. Please try again.`);
    } finally {
      setLoading(prev => ({ ...prev, [actionType]: false }));
      setConfirmDialog({ open: false, action: null, title: '', message: '' });
    }
  };

  const getConfirmData = (actionType) => {
    switch (actionType) {
      case 'routing':
        return {
          title: systemStatus?.routingEnabled ? 'Pause Call Routing' : 'Resume Call Routing',
          message: systemStatus?.routingEnabled 
            ? 'This will temporarily stop all incoming call routing. Active calls will not be affected.'
            : 'This will resume incoming call routing to the system.'
        };
      case 'mcp':
        return {
          title: 'Toggle MCP Tools',
          message: 'This will navigate to the MCP Tools configuration page.'
        };
      case 'refresh':
        return {
          title: 'Refresh System Status',
          message: 'This will refresh all system metrics and status information.'
        };
      default:
        return { title: 'Confirm Action', message: 'Are you sure you want to proceed?' };
    }
  };

  const getSuccessMessage = (actionType) => {
    switch (actionType) {
      case 'routing':
        return systemStatus?.routingEnabled ? 'Call routing paused successfully' : 'Call routing resumed successfully';
      case 'mcp':
        return 'Navigating to MCP Tools...';
      case 'refresh':
        return 'System status refreshed successfully';
      default:
        return 'Action completed successfully';
    }
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, action: null, title: '', message: '' });
  };

  const executeConfirmedAction = () => {
    if (confirmDialog.action) {
      confirmDialog.action();
    }
  };

  return (
    <>
      <Box>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <ButtonGroup 
          variant="contained" 
          size="medium"
          orientation="horizontal"
          sx={{ flexWrap: 'wrap', gap: 1 }}
        >
          <Button
            startIcon={loading.mcp ? <CircularProgress size={16} /> : <Build />}
            onClick={() => handleAction('mcp', onToggleMCPTools, false)}
            disabled={loading.mcp}
            color="primary"
          >
            MCP Tools
          </Button>

          <Button
            startIcon={loading.routing ? <CircularProgress size={16} /> : 
              (systemStatus?.routingEnabled ? <PauseCircle /> : <PlayCircle />)
            }
            onClick={() => handleAction('routing', onPauseRouting)}
            disabled={loading.routing}
            color={systemStatus?.routingEnabled ? "warning" : "success"}
          >
            {systemStatus?.routingEnabled ? 'Pause Routing' : 'Resume Routing'}
          </Button>

          <Button
            startIcon={loading.refresh ? <CircularProgress size={16} /> : <RefreshRounded />}
            onClick={() => handleAction('refresh', onRefreshSystem, false)}
            disabled={loading.refresh}
            color="info"
          >
            Refresh Status
          </Button>
        </ButtonGroup>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={closeConfirmDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog}>Cancel</Button>
          <Button 
            onClick={executeConfirmedAction}
            variant="contained"
            color="primary"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default QuickActionsPanel;