import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  IconButton
} from '@mui/material';
import { Download, Close } from '@mui/icons-material';

/**
 * DSAR Export Preview Dialog Component
 * Displays exported DSAR data preview
 */
export function DSARExportPreviewDialog({
  open,
  onClose,
  exportData
}) {
  const handleDownload = () => {
    if (!exportData) return;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsar-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">DSAR Export Preview</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {exportData ? (
          <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
            <Box
              component="pre"
              sx={{
                overflow: 'auto',
                maxHeight: 500,
                fontSize: '0.875rem',
                fontFamily: 'monospace'
              }}
            >
              {JSON.stringify(exportData, null, 2)}
            </Box>
          </Paper>
        ) : (
          <Typography color="text.secondary">No export data available</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button
          startIcon={<Download />}
          onClick={handleDownload}
          variant="contained"
          disabled={!exportData}
        >
          Download JSON
        </Button>
      </DialogActions>
    </Dialog>
  );
}

