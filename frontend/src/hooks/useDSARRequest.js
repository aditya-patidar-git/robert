import { useState, useCallback } from 'react';
import { useToast } from '../components/common/ToastProvider';
import privacyService from '../services/privacyService';

/**
 * useDSARRequest Hook
 * Reusable hook for DSAR operations
 */
const useDSARRequest = () => {
  const { showSuccess, showError } = useToast();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const loadRequest = useCallback(async (dsarId) => {
    if (!dsarId) {
      setRequest(null);
      return;
    }

    setLoading(true);
    try {
      const response = await privacyService.getDSARRequestDetails(dsarId);
      setRequest(response.request || response);
      if (response.timeline) {
        setTimeline(response.timeline);
      }
    } catch (error) {
      showError(error.message || 'Failed to load DSAR request');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadPreview = useCallback(async (dsarId, dataTypes) => {
    setLoading(true);
    try {
      const response = await privacyService.previewDSARData(dsarId, dataTypes);
      setPreview(response.preview || response);
    } catch (error) {
      showError(error.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const generateExport = useCallback(async (dsarId, dataTypes) => {
    setLoading(true);
    try {
      const response = await privacyService.generateDSARExport(dsarId, dataTypes);
      setExportData(response.export || response);
      showSuccess('Export generated successfully');
      return response.export || response;
    } catch (error) {
      showError(error.message || 'Failed to generate export');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError]);

  const process = useCallback(async (dsarId, action, adminUser, notes) => {
    setLoading(true);
    try {
      const response = await privacyService.processDSARRequest(dsarId, action, adminUser, notes);
      showSuccess(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      return response.result || response;
    } catch (error) {
      showError(error.message || 'Failed to process request');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError]);

  const loadTimeline = useCallback(async (dsarId) => {
    setLoading(true);
    try {
      const response = await privacyService.getDSARRequestTimeline(dsarId);
      setTimeline(response.timeline || response);
    } catch (error) {
      showError(error.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  return {
    request,
    setRequest,
    loadRequest,
    preview,
    loadPreview,
    export: exportData,
    generateExport,
    process,
    timeline,
    loadTimeline,
    loading
  };
};

export default useDSARRequest;

