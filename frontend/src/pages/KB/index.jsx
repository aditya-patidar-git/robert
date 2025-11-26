import React, { useState, useCallback } from 'react';
import {
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Alert
} from '@mui/material';
import { useKBPageState } from './hooks/useKBPageState';
import KnowledgeBaseManagementTab from './tabs/KnowledgeBaseManagementTab';
import AIConfigurationTab from './tabs/AIConfigurationTab';
import SystemOperationsTab from './tabs/SystemOperationsTab';
import AnalyticsMonitoringTab from './tabs/AnalyticsMonitoringTab';
import kbService from '../../services/kbService';
import aiService from '../../services/aiService';
import promptVersionService from '../../services/promptVersionService';
import flowParameterService from '../../services/flowParameterService';
import { formatDateTime } from '../../utils/formatters';

const AIKnowledgePage = () => {
  const [currentTab, setCurrentTab] = useState(0);
  
  // Get all state and functions from the hook
  const state = useKBPageState();
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    showSuccess,
    showError,
    queryClient,
    models,
    voices,
    fallbackChain,
    setFallbackChain,
    refetchVersions,
    refetchFlowOverrides,
    // State
    selectedTags,
    setSelectedTags,
    fileSearchQuery,
    setFileSearchQuery,
    fileSearchResults,
    setIsSearching,
    reingestingFiles,
    detectingDrift,
    promptVersions,
    currentVersion,
    compareDialogOpen,
    setCompareDialogOpen,
    rollbackDialogOpen,
    setRollbackDialogOpen,
    selectedVersions,
    setSelectedVersions,
    rollbackVersion,
    setRollbackVersion,
    rollbackReason,
    setRollbackReason,
    flowOverrides,
    flowOverridesLoading,
    editingFlowType,
    editingFlowParams,
    setEditingFlowType,
    setEditingFlowParams,
    flowDetectionTest,
    setFlowDetectionTest,
    viewFileModal,
    setViewFileModal,
    editTagsDialog,
    setEditTagsDialog,
    testResults,
    setTestResults,
    provenanceData,
    setProvenanceData,
    analyticsTimeRange,
    setAnalyticsTimeRange,
    // Queries
    kbFiles,
    vectorStoreStatus,
    vectorStoreLoading,
    vectorStoreError,
    driftStatus,
    driftLoading,
    driftError,
    reingestStatus,
    reingestLoading,
    reingestError,
    // Mutations
    uploadFileMutation,
    updateTagsMutation,
    reingestFileMutation,
    detectDriftMutation,
    fileSearchMutation
  } = state;

  // Handlers
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'text/html',
        'text/markdown',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      const maxSize = 25 * 1024 * 1024; // 25MB

      if (!allowedTypes.includes(file.type)) {
        showError('Only PDF, TXT, MD, HTML, DOC, DOCX files are allowed');
        return;
      }

      if (file.size > maxSize) {
        showError('File size must be less than 25MB');
        return;
      }

      uploadFileMutation.mutate({
        file,
        tags: selectedTags.length > 0 ? selectedTags : []
      });
      
      setSelectedTags([]);
      event.target.value = '';
    }
  }, [selectedTags, uploadFileMutation, showError, setSelectedTags]);

  const handleFileSearch = useCallback(() => {
    if (!fileSearchQuery.trim()) {
      showError('Please enter a search query');
      return;
    }
    setIsSearching(true);
    fileSearchMutation.mutate({
      query: fileSearchQuery,
      options: {
        maxResults: 5,
        similarityThreshold: 0.7
      }
    });
  }, [fileSearchQuery, fileSearchMutation, showError, setIsSearching]);

  const handleSavePrompt = useCallback(async (data) => {
    let finalFallbackChain = [...fallbackChain];
    if (data.selectedModel) {
      finalFallbackChain = finalFallbackChain.filter(item => {
        const itemModelId = typeof item === 'string' ? item : item.modelId;
        return itemModelId !== data.selectedModel;
      });
      finalFallbackChain = [{ modelId: data.selectedModel, voiceId: data.selectedVoice }, ...finalFallbackChain];
    }
    
    const normalizedFallbackChain = finalFallbackChain.map(item => {
      if (typeof item === 'string') {
        return {
          modelId: item,
          voiceId: data.selectedVoice || 'ash'
        };
      }
      if (item && item.modelId && item.voiceId) {
        return {
          modelId: item.modelId,
          voiceId: item.voiceId
        };
      }
      return null;
    }).filter(item => item !== null);
    
    try {
      await aiService.updateConfig({
        globalPrompt: data.globalPrompt,
        parameters: {
          temperature: data.temperature,
          topP: data.topP,
          maxTokens: data.maxTokens,
          speechRate: data.speechRate
        },
        model: {
          id: data.selectedModel,
          name: models.find(m => m.id === data.selectedModel)?.name || 'Unknown',
          fallbackChain: normalizedFallbackChain.length > 0 ? normalizedFallbackChain : (data.selectedModel ? [{ modelId: data.selectedModel, voiceId: data.selectedVoice }] : [])
        },
        voice: {
          id: data.selectedVoice,
          name: voices.find(v => v.id === data.selectedVoice)?.name || 'Unknown'
        },
        uncertaintyGate: {
          enabled: data.uncertaintyGateEnabled,
          confidenceThreshold: data.uncertaintyGateThreshold,
          minSources: data.uncertaintyGateMinSources
        }
      });
      showSuccess('All configurations saved successfully');
      queryClient.invalidateQueries(['prompts']);
      queryClient.invalidateQueries(['prompt-versions']);
      queryClient.invalidateQueries(['prompt-current-version']);
      refetchVersions();
      setFallbackChain(normalizedFallbackChain);
    } catch (error) {
      showError('Failed to save AI configuration');
    }
  }, [fallbackChain, models, voices, setFallbackChain, showSuccess, showError, queryClient, refetchVersions]);

  const handleCancelConfig = useCallback(async () => {
    try {
      const config = await aiService.getConfig();
      
      if (config?.globalPrompt) {
        setValue('globalPrompt', config.globalPrompt);
      }
      if (config?.parameters) {
        setValue('temperature', config.parameters.temperature || 0.4);
        setValue('topP', config.parameters.topP || 1.0);
        setValue('maxTokens', config.parameters.maxTokens || 150);
        setValue('speechRate', config.parameters.speechRate || 1.0);
      }
      if (config?.uncertaintyGate) {
        setValue('uncertaintyGateEnabled', config.uncertaintyGate.enabled !== undefined ? config.uncertaintyGate.enabled : true);
        setValue('uncertaintyGateThreshold', config.uncertaintyGate.confidenceThreshold || 0.8);
        setValue('uncertaintyGateMinSources', config.uncertaintyGate.minSources || 1);
      }
      if (config?.model?.id) {
        setValue('selectedModel', config.model.id);
        const currentVoiceId = config?.voice?.id || 'ash';
        if (config?.model?.fallbackChain && config.model.fallbackChain.length > 0) {
          let chain = [...config.model.fallbackChain];
          chain = chain.map(item => {
            if (typeof item === 'string') {
              return { modelId: item, voiceId: currentVoiceId };
            }
            if (item && typeof item === 'object' && item.modelId) {
              return {
                modelId: item.modelId,
                voiceId: item.voiceId || currentVoiceId
              };
            }
            return null;
          }).filter(item => item !== null);
          
          chain = chain.filter(item => item.modelId !== config.model.id);
          chain = [{ modelId: config.model.id, voiceId: currentVoiceId }, ...chain];
          setFallbackChain(chain);
        } else if (config.model.id) {
          setFallbackChain([{ modelId: config.model.id, voiceId: currentVoiceId }]);
        }
      }
      if (config?.voice?.id) {
        setValue('selectedVoice', config.voice.id);
      }
      
      showSuccess('Configuration reverted to saved state');
    } catch (error) {
      console.error('Error reverting configuration:', error);
      showError('Failed to revert configuration');
    }
  }, [setValue, setFallbackChain, showSuccess, showError]);

  const handleViewFile = useCallback(async (file) => {
    try {
      setViewFileModal({ open: true, file, content: null });
      const content = await kbService.getFileContent(file.id);
      setViewFileModal({ open: true, file, content });
    } catch (error) {
      console.error('Error fetching file content:', error);
      showError('Failed to load file content');
    }
  }, [setViewFileModal, showError]);

  const handleCloseViewFile = useCallback(() => {
    setViewFileModal({ open: false, file: null, content: null });
  }, [setViewFileModal]);

  const handleOpenEditTags = useCallback((file) => {
    setEditTagsDialog({
      open: true,
      file: file,
      tags: file.tags || []
    });
  }, [setEditTagsDialog]);

  const handleCloseEditTags = useCallback(() => {
    setEditTagsDialog({ open: false, file: null, tags: [] });
  }, [setEditTagsDialog]);

  const handleSaveTags = useCallback(() => {
    if (!editTagsDialog.file) return;
    updateTagsMutation.mutate({
      fileId: editTagsDialog.file.id,
      tags: editTagsDialog.tags
    });
  }, [editTagsDialog, updateTagsMutation]);

  const handleReingestFile = useCallback(async (file) => {
    if (reingestingFiles.has(file.id)) return;
    
    state.setReingestingFiles(prev => new Set(prev).add(file.id));
    try {
      await reingestFileMutation.mutateAsync(file.id);
    } finally {
      state.setReingestingFiles(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  }, [reingestingFiles, reingestFileMutation, state]);

  const handleDetectDrift = useCallback(async (file) => {
    if (detectingDrift.has(file.id)) return;
    
    state.setDetectingDrift(prev => new Set(prev).add(file.id));
    try {
      await detectDriftMutation.mutateAsync(file.id);
    } finally {
      state.setDetectingDrift(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  }, [detectingDrift, detectDriftMutation, state]);

  const handleViewVersion = useCallback((version) => {
    const current = promptVersions.find(v => v.isActive);
    if (current) {
      if (version.isActive) {
        setSelectedVersions({ version1: version, version2: version });
      } else {
        setSelectedVersions({ version1: current, version2: version });
      }
    } else {
      setSelectedVersions({ version1: version, version2: version });
    }
    setCompareDialogOpen(true);
  }, [promptVersions, setSelectedVersions, setCompareDialogOpen]);

  const handleCompareVersions = useCallback((version1, version2) => {
    setSelectedVersions({ version1, version2 });
    setCompareDialogOpen(true);
  }, [setSelectedVersions, setCompareDialogOpen]);

  const handleRollbackClick = useCallback((version) => {
    setRollbackVersion(version);
    setRollbackReason('');
    setRollbackDialogOpen(true);
  }, [setRollbackVersion, setRollbackReason, setRollbackDialogOpen]);

  const handleRollbackConfirm = useCallback(async () => {
    try {
      const result = await promptVersionService.rollbackToVersion(
        rollbackVersion._id,
        rollbackReason || `Rollback to version ${rollbackVersion.version}`
      );
      showSuccess(`Rolled back to version ${rollbackVersion.version}. New version ${result.version.version} created.`);
      
      setValue('globalPrompt', result.promptContent || rollbackVersion.content);
      
      const config = await aiService.getConfig();
      if (config?.globalPrompt) {
        setValue('globalPrompt', config.globalPrompt);
      }
      
      setRollbackDialogOpen(false);
      setRollbackVersion(null);
      setRollbackReason('');
      queryClient.invalidateQueries(['prompt-versions']);
      queryClient.invalidateQueries(['prompt-current-version']);
      queryClient.invalidateQueries(['ai-config']);
      refetchVersions();
    } catch (error) {
      showError('Failed to rollback version');
    }
  }, [rollbackVersion, rollbackReason, setValue, showSuccess, showError, queryClient, refetchVersions, setRollbackDialogOpen, setRollbackVersion, setRollbackReason]);

  const handleSaveFlowOverride = useCallback(async (flowType, overrideData) => {
    try {
      await flowParameterService.createOrUpdateFlowOverride(flowType, overrideData);
      showSuccess(`Flow parameter override for ${flowType} saved successfully`);
      setEditingFlowType(null);
      refetchFlowOverrides();
      queryClient.invalidateQueries(['flow-parameters']);
    } catch (error) {
      showError(`Failed to save flow parameter override for ${flowType}`);
    }
  }, [showSuccess, showError, setEditingFlowType, refetchFlowOverrides, queryClient]);

  const handleTestFlowDetection = useCallback(async () => {
    try {
      const result = await flowParameterService.detectFlowType(flowDetectionTest.text);
      setFlowDetectionTest({ ...flowDetectionTest, result });
    } catch (error) {
      showError('Failed to test flow detection');
    }
  }, [flowDetectionTest, setFlowDetectionTest, showError]);

  // Prepare state and handlers for tabs
  const tabState = {
    ...state,
    tagOptions: ['policy', 'courses', 'pricing', 'T&Cs', 'training', 'documentation', 'procedures', 'forms']
  };

  const tabHandlers = {
    handleFileUpload,
    handleFileSearch,
    handleViewFile,
    handleOpenEditTags,
    handleReingestFile,
    handleDetectDrift,
    handleSavePrompt,
    handleCancelConfig,
    handleViewVersion,
    handleCompareVersions,
    handleRollbackClick,
    handleRollbackConfirm,
    handleSaveFlowOverride,
    handleTestFlowDetection
  };

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1"
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '1.75rem', md: '2rem' },
            color: 'text.primary',
            mb: 1
          }}
        >
          AI & Knowledge Base
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.9375rem'
          }}
        >
          Manage knowledge base files and AI prompt configurations
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3,
          borderRadius: 2
        }}
      >
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Knowledge Base Management" />
          <Tab label="AI Configuration" />
          <Tab label="System Operations" />
          <Tab label="Analytics & Monitoring" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {currentTab === 0 && (
        <KnowledgeBaseManagementTab state={tabState} handlers={tabHandlers} />
      )}

      {currentTab === 1 && (
        <AIConfigurationTab state={tabState} handlers={tabHandlers} />
      )}

      {currentTab === 2 && (
        <SystemOperationsTab state={tabState} handlers={tabHandlers} />
      )}

      {currentTab === 3 && (
        <AnalyticsMonitoringTab state={tabState} handlers={tabHandlers} />
      )}

      {/* Dialogs */}
      {/* Edit Tags Dialog */}
      <Dialog
        open={editTagsDialog.open}
        onClose={handleCloseEditTags}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Tags for {editTagsDialog.file?.filename}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Tags (comma-separated)"
            value={editTagsDialog.tags.join(', ')}
            onChange={(e) => {
              const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
              setEditTagsDialog({ ...editTagsDialog, tags });
            }}
            placeholder="policy, courses, pricing"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditTags}>Cancel</Button>
          <Button onClick={handleSaveTags} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Compare Versions Dialog */}
      <Dialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Compare Prompt Versions</DialogTitle>
        <DialogContent>
          {selectedVersions.version1 && selectedVersions.version2 && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Version {selectedVersions.version1.version} (Created: {formatDateTime(selectedVersions.version1.createdAt)})
                </Typography>
                <TextField
                  multiline
                  rows={6}
                  fullWidth
                  value={selectedVersions.version1.content}
                  InputProps={{ readOnly: true }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Version {selectedVersions.version2.version} (Created: {formatDateTime(selectedVersions.version2.createdAt)})
                </Typography>
                <TextField
                  multiline
                  rows={6}
                  fullWidth
                  value={selectedVersions.version2.content}
                  InputProps={{ readOnly: true }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rollback Dialog */}
      <Dialog
        open={rollbackDialogOpen}
        onClose={() => setRollbackDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Rollback to Version {rollbackVersion?.version}</DialogTitle>
        <DialogContent>
          {rollbackVersion && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This will create a new version with the content from version {rollbackVersion.version}. The current active version will remain unchanged until you save.
              </Alert>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Version {rollbackVersion.version} Content:
                </Typography>
                <TextField
                  multiline
                  rows={8}
                  fullWidth
                  value={rollbackVersion.content}
                  InputProps={{ readOnly: true }}
                />
              </Box>
              <TextField
                label="Rollback Reason (Optional)"
                multiline
                rows={2}
                fullWidth
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Enter reason for rollback..."
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRollbackDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleRollbackConfirm} 
            variant="contained" 
            color="warning"
          >
            Confirm Rollback
          </Button>
        </DialogActions>
      </Dialog>

      {/* View File Modal */}
      <Dialog
        open={viewFileModal.open}
        onClose={handleCloseViewFile}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          File Details: {viewFileModal.file?.filename}
        </DialogTitle>
        <DialogContent>
          {viewFileModal.content ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                File Information
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Filename:</strong> {viewFileModal.content.filename}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Size:</strong> {viewFileModal.content.bytes} bytes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Status:</strong> {viewFileModal.content.status}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Purpose:</strong> {viewFileModal.content.purpose}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Created:</strong> {formatDateTime(new Date(viewFileModal.content.created_at * 1000))}
                </Typography>
              </Box>
              
              <Typography variant="h6" gutterBottom>
                File Content
              </Typography>
              
              {viewFileModal.content?.contentType && (
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={`Content Type: ${viewFileModal.content.contentType.toUpperCase()}`}
                    color="primary"
                    size="small"
                  />
                </Box>
              )}
              
              {viewFileModal.content?.contentType === 'restricted' ? (
                <Box
                  sx={{
                    bgcolor: 'warning.light',
                    p: 2,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'warning.main'
                  }}
                >
                  <Typography variant="h6" color="warning.dark" gutterBottom>
                    ⚠️ File Access Restricted
                  </Typography>
                  <Typography variant="body2" color="warning.dark">
                    This file cannot be downloaded due to OpenAI security restrictions.
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                      {viewFileModal.content?.content || 'No content available'}
                    </pre>
                  </Box>
                </Box>
              ) : viewFileModal.content?.contentType === 'image' ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 300,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    p: 2
                  }}
                >
                  <img
                    src={`data:image/jpeg;base64,${viewFileModal.content.content}`}
                    alt={viewFileModal.content.filename}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      objectFit: 'contain'
                    }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    bgcolor: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 400,
                    overflow: 'auto',
                    fontFamily: viewFileModal.content?.contentType === 'pdf' ? 'monospace' : 'inherit',
                    fontSize: '0.875rem'
                  }}
                >
                  {viewFileModal.content?.contentType === 'pdf' ? (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {viewFileModal.content?.content || 'No content available'}
                    </pre>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {viewFileModal.content?.content || 'No content available'}
                    </div>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading file content...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewFile} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AIKnowledgePage;
