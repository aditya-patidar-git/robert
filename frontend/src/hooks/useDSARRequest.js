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
      // Handle normalized response structure: { success, data: { request }, ... }
      const requestData = response?.data?.request || response?.request || response?.data || response;
      setRequest(requestData);
      
      // Extract timeline if included in request response
      const timelineData = response?.data?.timeline || response?.timeline;
      if (Array.isArray(timelineData)) {
        setTimeline(timelineData);
      }
    } catch (error) {
      showError(error.message || 'Failed to load DSAR request');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadPreview = useCallback(async (dsarId, dataTypes) => {
    if (!dsarId) {
      setPreview(null);
      return;
    }
    
    setLoading(true);
    try {
      const response = await privacyService.previewDSARData(dsarId, dataTypes);
      // Handle normalized response structure: { success, data: { preview }, ... }
      const previewData = response?.data?.preview || response?.preview || response?.data || response;
      setPreview(previewData);
    } catch (error) {
      console.error('Failed to load preview:', error);
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
    if (!dsarId) {
      setTimeline([]);
      return;
    }
    
    setLoading(true);
    try {
      const response = await privacyService.getDSARRequestTimeline(dsarId);
      // Handle normalized response structure: { success, data: { timeline }, ... }
      const timelineData = response?.data?.timeline || response?.timeline || response?.data;
      setTimeline(Array.isArray(timelineData) ? timelineData : []);
    } catch (error) {
      console.error('Failed to load timeline:', error);
      showError(error.message || 'Failed to load timeline');
      setTimeline([]); // Reset to empty array on error
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

