import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

/**
 * Reusable confirmation dialog shown before saving agent-affecting settings.
 * Displays a warning message and bullet list of effects on the agent; user must confirm to proceed.
 * If onConfirm returns a Promise, the dialog shows loading until it resolves and then closes on success.
 */
const ConfirmSaveDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm save',
  message = 'This change will affect how the agent behaves.',
  effects = [],
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  loading: loadingProp = false,
  confirmColor = 'primary'
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = loadingProp || internalLoading;
  const contentId = 'confirm-save-dialog-description';

  const handleConfirm = async () => {
    const result = onConfirm();
    if (result && typeof result.then === 'function') {
      setInternalLoading(true);
      try {
        await result;
        onClose();
      } catch (e) {
        // Caller handles error (e.g. toast); keep dialog open
      } finally {
        setInternalLoading(false);
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="confirm-save-dialog-title"
      aria-describedby={contentId}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle id="confirm-save-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id={contentId} component="div" sx={{ mb: effects?.length ? 2 : 0 }}>
          <Typography component="span" variant="body2">
            {message}
          </Typography>
        </DialogContentText>
        {effects && effects.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Effects on the agent:
            </Typography>
            <List dense disablePadding sx={{ listStyle: 'disc', pl: 2 }}>
              {effects.map((effect, index) => (
                <ListItem key={index} disablePadding sx={{ display: 'list-item', py: 0.25 }}>
                  <ListItemText
                    primary={effect}
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} aria-label={cancelLabel}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={handleConfirm}
          disabled={loading}
          aria-label={confirmLabel}
        >
          {(loading ? 'Saving...' : confirmLabel)}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmSaveDialog;
