import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useToast } from '../../../components/common/ToastProvider';
import kbService from '../../../services/kbService';
import promptService from '../../../services/promptService';
import aiService from '../../../services/aiService';
import vectorStoreService from '../../../services/vectorStoreService';
import fileSearchService from '../../../services/fileSearchService';
import driftService from '../../../services/driftService';
import reingestService from '../../../services/reingestService';
import promptVersionService from '../../../services/promptVersionService';
import flowParameterService from '../../../services/flowParameterService';
import { useModelCapabilities } from '../../../hooks/useModelCapabilities';
import { useAIModels } from '../../../hooks/useAIModels';
import { useMCPTools } from '../../../hooks/useMCPTools';
import { useLanguageVoiceMappings } from '../../../hooks/useLanguageVoiceMappings';
import { useModelVoiceCompatibility } from '../../../hooks/useModelVoiceCompatibility';
import { useFallbackChain } from '../../../hooks/useFallbackChain';

export const useKBPageState = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const { control, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      globalPrompt: '',
      temperature: 0.4,
      topP: 1.0,
      maxTokens: 150,
      speechRate: 1.0,
      selectedModel: '',
      selectedVoice: '',
      uncertaintyGateEnabled: true,
      uncertaintyGateThreshold: 0.8,
      uncertaintyGateMinSources: 1
    }
  });

  // Basic state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [vectorStoreStatus, setVectorStoreStatus] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileSearchResults, setFileSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Tag management state
  const [selectedTags, setSelectedTags] = useState([]);
  const [editTagsDialog, setEditTagsDialog] = useState({ open: false, file: null, tags: [] });
  const [reingestingFiles, setReingestingFiles] = useState(new Set());
  const [detectingDrift, setDetectingDrift] = useState(new Set());
  
  // Predefined tag options
  const tagOptions = ['policy', 'courses', 'pricing', 'T&Cs', 'training', 'documentation', 'procedures', 'forms'];

  // Advanced Features State
  const [driftStatus, setDriftStatus] = useState(null);
  const [reingestStatus, setReingestStatus] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [provenanceData, setProvenanceData] = useState(null);
  const [uncertaintyConfig, setUncertaintyConfig] = useState(null);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('7d');
  
  // Model parameters state
  const [modelParameters, setModelParameters] = useState(null);
  const [editingDomains, setEditingDomains] = useState({});
  const [newDomainInputs, setNewDomainInputs] = useState({});
  const [rateLimitValues, setRateLimitValues] = useState({});
  const [promptVersions, setPromptVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState({ version1: null, version2: null });
  const [rollbackVersion, setRollbackVersion] = useState(null);
  const [rollbackReason, setRollbackReason] = useState('');
  
  // Flow parameter state
  const [flowOverrides, setFlowOverrides] = useState({});
  const [editingFlowType, setEditingFlowType] = useState(null);
  const [editingFlowParams, setEditingFlowParams] = useState({});
  const [flowDetectionTest, setFlowDetectionTest] = useState({ text: '', result: null });
  
  // View file modal state
  const [viewFileModal, setViewFileModal] = useState({ open: false, file: null, content: null });
  
  // System Operations state
  const [scheduledMigrationEnabled, setScheduledMigrationEnabled] = useState(false);
  const [scheduledMigrationTime, setScheduledMigrationTime] = useState('02:00');
  const [scheduledMigrationLastRun, setScheduledMigrationLastRun] = useState(null);
  const [scheduledMigrationNextRun, setScheduledMigrationNextRun] = useState(null);
  const [documentIndexSearch, setDocumentIndexSearch] = useState('');
  const [scheduleReingestDialog, setScheduleReingestDialog] = useState({ open: false, fileIds: [], delay: 0 });
  const [selectedReingestTags, setSelectedReingestTags] = useState([]);

  // Queries
  const { data: kbFiles = [], isLoading: kbLoading, error: kbError } = useQuery({
    queryKey: ['kb-files'],
    queryFn: () => kbService.getAllFiles(),
  });

  const { data: prompts = [], isLoading: promptsLoading, error: promptsError } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => promptService.getAllPrompts(),
  });

  const { isLoading: capabilitiesLoading } = useModelCapabilities();
  const { mappings: languageMappings, isLoading: mappingsLoading, saveMappings: saveLanguageMappings } = useLanguageVoiceMappings();
  const { tools: mcpTools, isLoading: mcpToolsLoading, refetch: refetchMcpTools } = useMCPTools();

  const { data: fetchedVersions = [], isLoading: versionsLoading, refetch: refetchVersions } = useQuery({
    queryKey: ['prompt-versions'],
    queryFn: () => promptVersionService.getPromptVersions('global')
  });

  const { data: fetchedCurrentVersion, refetch: refetchCurrentVersion } = useQuery({
    queryKey: ['prompt-current-version'],
    queryFn: () => promptVersionService.getCurrentVersion('global'),
    enabled: false
  });

  const { data: fetchedFlowOverrides = [], isLoading: flowOverridesLoading, refetch: refetchFlowOverrides } = useQuery({
    queryKey: ['flow-parameters'],
    queryFn: () => flowParameterService.getFlowParameters()
  });

  const { data: vectorStoreData, isLoading: vectorStoreLoading, error: vectorStoreError } = useQuery({
    queryKey: ['vector-store-status'],
    queryFn: () => vectorStoreService.getStatus(),
  });

  const { data: migrationData, isLoading: migrationLoading, error: migrationError } = useQuery({
    queryKey: ['migration-status'],
    queryFn: () => vectorStoreService.getMigrationStatus(),
    refetchInterval: 5000,
  });

  const { data: driftStatusData, isLoading: driftLoading, error: driftError } = useQuery({
    queryKey: ['drift-status'],
    queryFn: () => driftService.getDriftStatus(),
  });

  const { data: reingestStatusData, isLoading: reingestLoading, error: reingestError } = useQuery({
    queryKey: ['reingest-status'],
    queryFn: () => reingestService.getReingestStatus(),
  });

  // Use custom hooks
  const { models, error: modelsError } = useAIModels();
  const selectedModelId = watch('selectedModel');
  const selectedVoiceId = watch('selectedVoice');
  const { voices, compatibleVoices, getCompatibleVoices: getCompatibleVoicesForModel } = useModelVoiceCompatibility(selectedModelId, selectedVoiceId, setValue);
  const { fallbackChain, setFallbackChain, handleDragEnd: handleFallbackChainDragEnd, removeFromChain, addToChain } = useFallbackChain([], selectedModelId);

  // Mutations
  const uploadFileMutation = useMutation({
    mutationFn: ({ file, tags }) => kbService.uploadFile(file, tags),
    onSuccess: () => {
      showSuccess('File uploaded successfully to OpenAI');
      queryClient.invalidateQueries(['kb-files']);
      setSelectedTags([]);
    },
    onError: () => showError('Failed to upload file to OpenAI')
  });

  const updateTagsMutation = useMutation({
    mutationFn: ({ fileId, tags }) => kbService.updateFileTags(fileId, tags),
    onSuccess: () => {
      showSuccess('Tags updated successfully');
      queryClient.invalidateQueries(['kb-files']);
      setEditTagsDialog({ open: false, file: null, tags: [] });
    },
    onError: () => showError('Failed to update tags')
  });

  const reingestFileMutation = useMutation({
    mutationFn: (fileId) => kbService.reingestFile(fileId),
    onSuccess: () => {
      showSuccess('File re-ingested successfully');
      queryClient.invalidateQueries(['kb-files']);
    },
    onError: () => showError('Failed to re-ingest file')
  });

  const detectDriftMutation = useMutation({
    mutationFn: (fileId) => kbService.detectFileDrift(fileId),
    onSuccess: (drift) => {
      if (drift.hasDrift) {
        showError(`Drift detected: ${drift.reason || 'Content may be outdated'}`);
      } else {
        showSuccess('No drift detected');
      }
      queryClient.invalidateQueries(['kb-files']);
    },
    onError: () => showError('Failed to detect drift')
  });

  const savePromptMutation = useMutation({
    mutationFn: (data) => {
      if (prompts.length > 0) {
        return promptService.updatePrompt(prompts[0].id, data);
      } else {
        return promptService.createPrompt(data);
      }
    },
    onSuccess: () => {
      showSuccess('Prompt saved successfully');
      queryClient.invalidateQueries(['prompts']);
      setValue('globalPrompt', '');
      setValue('temperature', 0.4);
      setValue('topP', 1.0);
      setValue('maxTokens', 150);
      setValue('speechRate', 1.0);
      setValue('selectedModel', '');
      setValue('selectedVoice', '');
    },
    onError: () => showError('Failed to save prompt')
  });

  const startMigrationMutation = useMutation({
    mutationFn: vectorStoreService.startMigration,
    onSuccess: () => {
      showSuccess('Migration started successfully');
      queryClient.invalidateQueries(['migration-status']);
    },
    onError: () => showError('Failed to start migration')
  });

  const validateVectorStoreMutation = useMutation({
    mutationFn: vectorStoreService.validate,
    onSuccess: (results) => {
      showSuccess(`Vector store validation completed: ${results.valid ? 'Valid' : 'Issues found'}`);
    },
    onError: () => showError('Failed to validate vector store')
  });

  const cleanupVectorStoreMutation = useMutation({
    mutationFn: vectorStoreService.cleanup,
    onSuccess: (results) => {
      showSuccess(`Cleanup completed: ${results.cleaned} files removed`);
      queryClient.invalidateQueries(['vector-store-status']);
    },
    onError: () => showError('Failed to cleanup vector store')
  });

  const addQAPairMutation = useMutation({
    mutationFn: ({ question, answer }) => kbService.addQAPair(question, answer),
    onSuccess: () => {
      showSuccess('Q&A pair added successfully to vector store');
      queryClient.invalidateQueries(['kb-files']);
    },
    onError: (error) => {
      showError(error.message || 'Failed to add Q&A pair to vector store');
    }
  });

  const fileSearchMutation = useMutation({
    mutationFn: ({ query, options }) => fileSearchService.searchFiles(query, options),
    onSuccess: (results) => {
      setFileSearchResults(results.results || []);
      showSuccess(`Found ${results.totalResults} results`);
    },
    onError: (error) => {
      console.error('File search error:', error);
      showError('File search failed');
    }
  });

  // Effects
  useEffect(() => {
    if (kbFiles) {
      console.log('🔍 KB Page - Files loaded successfully:', kbFiles);
    }
  }, [kbFiles]);

  useEffect(() => {
    if (kbError) {
      console.error('🔍 KB Page - KB Files Error:', kbError);
      showError('Failed to load knowledge base files');
    }
  }, [kbError, showError]);

  useEffect(() => {
    if (prompts && Array.isArray(prompts) && prompts.length > 0) {
      const prompt = prompts[0];
      setValue('globalPrompt', prompt.content || '');
      if (prompt.parameters) {
        setValue('temperature', prompt.parameters.temperature || 0.4);
        setValue('topP', prompt.parameters.topP || 1.0);
        setValue('maxTokens', prompt.parameters.maxTokens || 150);
        setValue('speechRate', prompt.parameters.speechRate || 1.0);
        setValue('selectedModel', prompt.parameters.model || '');
        setValue('selectedVoice', prompt.parameters.voice || '');
      }
    }
  }, [prompts, setValue]);

  useEffect(() => {
    if (promptsError) {
      console.error('Prompts Error:', promptsError);
      showError('Failed to load prompts');
    }
  }, [promptsError, showError]);

  useEffect(() => {
    if (modelsError) {
      console.error('Models Error:', modelsError);
      showError('Failed to load AI models');
    }
  }, [modelsError, showError]);

  useEffect(() => {
    const selectedModel = watch('selectedModel');
    if (selectedModel) {
      aiService.getModelParameters(selectedModel)
        .then(params => setModelParameters(params))
        .catch(err => {
          console.error('Error fetching model parameters:', err);
          setModelParameters(null);
        });
    } else {
      setModelParameters(null);
    }
  }, [watch('selectedModel')]);

  useEffect(() => {
    if (mcpTools && mcpTools.length > 0) {
      const domainsState = {};
      const rateLimitState = {};
      mcpTools.forEach(tool => {
        domainsState[tool.name] = [...(tool.domains || [])];
        rateLimitState[tool.name] = tool.rateLimit?.limit || 100;
      });
      setEditingDomains(domainsState);
      setRateLimitValues(rateLimitState);
    }
  }, [mcpTools]);

  useEffect(() => {
    if (fetchedVersions && fetchedVersions.length > 0) {
      setPromptVersions(fetchedVersions);
      const activeVersion = fetchedVersions.find(v => v.isActive);
      if (activeVersion) {
        setCurrentVersion(activeVersion);
      }
    }
  }, [fetchedVersions]);

  useEffect(() => {
    if (fetchedFlowOverrides && fetchedFlowOverrides.length > 0) {
      const overridesMap = {};
      fetchedFlowOverrides.forEach(override => {
        overridesMap[override.flowType] = override;
      });
      setFlowOverrides(overridesMap);
    }
  }, [fetchedFlowOverrides]);

  useEffect(() => {
    const fetchAIConfig = async () => {
      try {
        const config = await aiService.getConfig();
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
            setTimeout(() => setFallbackChain(chain), 0);
          } else {
            setTimeout(() => setFallbackChain([{ modelId: config.model.id, voiceId: currentVoiceId }]), 0);
          }
        }
        if (config?.voice?.id) {
          setValue('selectedVoice', config.voice.id);
        }
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
      } catch (error) {
        console.error('Error fetching AI config:', error);
      }
    };
    fetchAIConfig();
  }, [setValue, setFallbackChain]);

  useEffect(() => {
    if (vectorStoreData) {
      console.log('Vector Store Status Data:', vectorStoreData);
      setVectorStoreStatus(vectorStoreData);
    }
  }, [vectorStoreData]);

  useEffect(() => {
    if (vectorStoreError) {
      console.error('Vector Store Status Error:', vectorStoreError);
      showError('Failed to load vector store status');
    }
  }, [vectorStoreError, showError]);

  useEffect(() => {
    if (migrationData) {
      setMigrationStatus(migrationData);
    }
  }, [migrationData]);

  useEffect(() => {
    if (migrationError) {
      console.error('Migration Status Error:', migrationError);
    }
  }, [migrationError]);

  useEffect(() => {
    if (driftStatusData) {
      console.log('Drift Status Data:', driftStatusData);
      setDriftStatus(driftStatusData);
    }
  }, [driftStatusData]);

  useEffect(() => {
    if (driftError) {
      console.error('Drift Status Error:', driftError);
      showError('Failed to load drift detection status');
    }
  }, [driftError, showError]);

  useEffect(() => {
    if (reingestStatusData) {
      console.log('Reingest Status Data:', reingestStatusData);
      setReingestStatus(reingestStatusData);
    }
  }, [reingestStatusData]);

  useEffect(() => {
    if (reingestError) {
      console.error('Reingest Status Error:', reingestError);
      showError('Failed to load reingest status');
    }
  }, [reingestError, showError]);

  return {
    // Form
    control,
    handleSubmit,
    setValue,
    watch,
    
    // State
    uploadedFiles,
    setUploadedFiles,
    vectorStoreStatus,
    setVectorStoreStatus,
    migrationStatus,
    setMigrationStatus,
    fileSearchQuery,
    setFileSearchQuery,
    fileSearchResults,
    setFileSearchResults,
    isSearching,
    setIsSearching,
    selectedTags,
    setSelectedTags,
    editTagsDialog,
    setEditTagsDialog,
    reingestingFiles,
    setReingestingFiles,
    detectingDrift,
    setDetectingDrift,
    tagOptions,
    driftStatus,
    setDriftStatus,
    reingestStatus,
    setReingestStatus,
    testResults,
    setTestResults,
    provenanceData,
    setProvenanceData,
    uncertaintyConfig,
    setUncertaintyConfig,
    analyticsTimeRange,
    setAnalyticsTimeRange,
    modelParameters,
    setModelParameters,
    editingDomains,
    setEditingDomains,
    newDomainInputs,
    setNewDomainInputs,
    rateLimitValues,
    setRateLimitValues,
    promptVersions,
    setPromptVersions,
    currentVersion,
    setCurrentVersion,
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
    setFlowOverrides,
    editingFlowType,
    setEditingFlowType,
    editingFlowParams,
    setEditingFlowParams,
    flowDetectionTest,
    setFlowDetectionTest,
    viewFileModal,
    setViewFileModal,
    scheduledMigrationEnabled,
    setScheduledMigrationEnabled,
    scheduledMigrationTime,
    setScheduledMigrationTime,
    scheduledMigrationLastRun,
    setScheduledMigrationLastRun,
    scheduledMigrationNextRun,
    setScheduledMigrationNextRun,
    documentIndexSearch,
    setDocumentIndexSearch,
    scheduleReingestDialog,
    setScheduleReingestDialog,
    selectedReingestTags,
    setSelectedReingestTags,
    
    // Queries
    kbFiles,
    kbLoading,
    kbError,
    prompts,
    promptsLoading,
    promptsError,
    capabilitiesLoading,
    languageMappings,
    mappingsLoading,
    saveLanguageMappings,
    mcpTools,
    mcpToolsLoading,
    refetchMcpTools,
    fetchedVersions,
    versionsLoading,
    refetchVersions,
    fetchedCurrentVersion,
    refetchCurrentVersion,
    fetchedFlowOverrides,
    flowOverridesLoading,
    refetchFlowOverrides,
    vectorStoreLoading,
    vectorStoreError,
    migrationLoading,
    migrationError,
    driftLoading,
    driftError,
    reingestLoading,
    reingestError,
    models,
    modelsError,
    voices,
    compatibleVoices,
    getCompatibleVoicesForModel,
    fallbackChain,
    setFallbackChain,
    handleFallbackChainDragEnd,
    removeFromChain,
    addToChain,
    
    // Mutations
    uploadFileMutation,
    updateTagsMutation,
    reingestFileMutation,
    detectDriftMutation,
    savePromptMutation,
    startMigrationMutation,
    validateVectorStoreMutation,
    cleanupVectorStoreMutation,
    fileSearchMutation,
    addQAPairMutation,
    
    // Query client
    queryClient,
    
    // Toast
    showSuccess,
    showError
  };
};



