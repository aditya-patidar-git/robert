import React, { useEffect, useState } from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress } from '@mui/material';
import { Close } from '@mui/icons-material';
import useDSARRequest from '../../../../hooks/useDSARRequest';
import DSARRequestInfo from './DSARRequestInfo';
import DSARDataPreview from '../../../../components/dsar/DSARDataPreview';
import DSARTimeline from '../../../../components/dsar/DSARTimeline';
import DSARExportProgress from '../../../../components/dsar/DSARExportProgress';
import DSARProcessActions from './DSARProcessActions';
import { useAuth } from '../../../../context/AuthContext';

/**
 * DSARRequestDetails Component
 * Main details component for DSAR requests
 */
const DSARRequestDetails = ({ requestId, open, onClose, onUpdate }) => {
  const { user } = useAuth();
  const { request, loadRequest, preview, loadPreview, export: exportData, generateExport, process, timeline, loadTimeline, loading } = useDSARRequest();
  const [selectedDataTypes, setSelectedDataTypes] = useState(['all']);
  const [exportStatus, setExportStatus] = useState('not_started');

  useEffect(() => {
    if (open && requestId) {
      loadRequest(requestId);
      loadTimeline(requestId);
    }
  }, [open, requestId, loadRequest, loadTimeline]);

  const handleDataTypeToggle = (dataTypes) => {
    setSelectedDataTypes(dataTypes);
    if (requestId) {
      loadPreview(requestId, dataTypes);
    }
  };

  const handlePreview = (dataTypes) => {
    if (requestId) {
      loadPreview(requestId, dataTypes);
    }
  };

  const handleGenerateExport = async () => {
    setExportStatus('processing');
    try {
      await generateExport(requestId, selectedDataTypes);
      setExportStatus('completed');
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      setExportStatus('failed');
    }
  };

  const handleProcess = async (action, adminUser, notes) => {
    try {
      await process(requestId, action, adminUser, notes);
      loadRequest(requestId); // Reload to get updated status
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDownload = (exportData) => {
    // In a real implementation, this would download the export file
    window.open(exportData.downloadUrl, '_blank');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">DSAR Request Details</Typography>
          <Button onClick={onClose} size="small">
            <Close />
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading && !request ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ width: '100%' }}>
              <DSARRequestInfo request={request} />
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' }, minWidth: { md: '300px' } }}>
                <DSARDataPreview
                  data={preview}
                  dataTypes={selectedDataTypes}
                  onDataTypeToggle={handleDataTypeToggle}
                  onPreview={handlePreview}
                />
              </Box>

              <Box sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' }, minWidth: { md: '300px' } }}>
                <DSARExportProgress
                  progress={exportStatus === 'processing' ? 50 : 100}
                  status={exportStatus}
                  onDownload={handleDownload}
                  exportData={exportData}
                />
                {request?.status === 'approved' && (
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleGenerateExport}
                    disabled={exportStatus === 'processing'}
                    sx={{ mt: 2 }}
                  >
                    {exportStatus === 'processing' ? 'Generating...' : 'Generate Export'}
                  </Button>
                )}
              </Box>
            </Box>

            <Box sx={{ width: '100%' }}>
              <DSARTimeline events={timeline} />
            </Box>

            <Box sx={{ width: '100%' }}>
              <DSARProcessActions
                request={request}
                onProcess={handleProcess}
                adminUser={user?.username || user?.email || 'admin'}
              />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DSARRequestDetails;

