import React from 'react';
import { Box, Paper, Typography, LinearProgress, Button, Chip } from '@mui/material';
import { GetApp, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';

/**
 * DSARExportProgress Component
 * Export progress indicator with download button
 */
const DSARExportProgress = ({ progress, status, onDownload, exportData }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle color="success" />,
          color: 'success',
          label: 'Export Ready'
        };
      case 'failed':
        return {
          icon: <ErrorIcon color="error" />,
          color: 'error',
          label: 'Export Failed'
        };
      case 'processing':
        return {
          icon: null,
          color: 'primary',
          label: 'Generating Export...'
        };
      default:
        return {
          icon: null,
          color: 'default',
          label: 'Not Started'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          Export Status
        </Typography>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
        />
      </Box>

      {status === 'processing' && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress || 0} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {progress || 0}% complete
          </Typography>
        </Box>
      )}

      {exportData && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Export ID: {exportData.exportId}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generated: {formatDateTime(exportData.generatedAt)}
          </Typography>
          {exportData.fileSize && (
            <Typography variant="body2" color="text.secondary">
              File Size: {(exportData.fileSize / 1024 / 1024).toFixed(2)} MB
            </Typography>
          )}
          {exportData.recordCount && (
            <Typography variant="body2" color="text.secondary">
              Records: {exportData.recordCount}
            </Typography>
          )}
        </Box>
      )}

      {status === 'completed' && exportData && (
        <Button
          variant="contained"
          startIcon={<GetApp />}
          onClick={() => onDownload && onDownload(exportData)}
          fullWidth
        >
          Download Export
        </Button>
      )}
    </Paper>
  );
};

export default DSARExportProgress;

