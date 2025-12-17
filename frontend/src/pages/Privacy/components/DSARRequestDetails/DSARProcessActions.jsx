import React, { useState } from 'react';
import { Box, Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';

/**
 * DSARProcessActions Component
 * Process request actions (approve/deny)
 */
const DSARProcessActions = ({ request, onProcess, adminUser }) => {
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [notes, setNotes] = useState('');

  const handleProcess = (processAction) => {
    setAction(processAction);
    setProcessDialogOpen(true);
  };

  const handleConfirm = () => {
    if (onProcess) {
      onProcess(action, adminUser, notes);
    }
    setProcessDialogOpen(false);
    setNotes('');
    setAction(null);
  };

  if (!request || request.status === 'completed') {
    return null;
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom fontWeight="bold">
        Process Request
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Button
          variant="contained"
          color="success"
          startIcon={<CheckCircle />}
          onClick={() => handleProcess('approve')}
        >
          Approve
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<Cancel />}
          onClick={() => handleProcess('reject')}
        >
          Reject
        </Button>
      </Box>

      <Dialog
        open={processDialogOpen}
        onClose={() => {
          setProcessDialogOpen(false);
          setNotes('');
          setAction(null);
        }}
      >
        <DialogTitle>
          {action === 'approve' ? 'Approve' : 'Reject'} DSAR Request
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Add any notes about this decision..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setProcessDialogOpen(false);
            setNotes('');
            setAction(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={action === 'approve' ? 'success' : 'error'}
            onClick={handleConfirm}
          >
            Confirm {action === 'approve' ? 'Approval' : 'Rejection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default DSARProcessActions;

