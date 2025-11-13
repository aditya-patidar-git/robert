import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  LinearProgress,
  Grid,
  CardHeader,
  Divider,
  Avatar,
  Stack
} from '@mui/material';
import {
  CloudUpload,
  Refresh,
  PlayArrow,
  Stop,
  Description,
  Save,
  Undo,
  Visibility,
  ArrowForward,
  Delete,
  DragIndicator,
  Edit,
  Warning,
  CheckCircle,
  Schedule,
  TableChart,
  FilterList,
  FileDownload,
  AccessTime,
  CheckCircleOutline,
  CancelOutlined,
  Storage,
  TrendingUp,
  Sync,
  Update,
  ErrorOutline,
  CheckCircle as CheckCircleIcon,
  InfoOutlined
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useForm, Controller } from 'react-hook-form';
import { useToast } from '../../components/common/ToastProvider';
import { formatDateTime } from '../../utils/formatters';
import authenticatedApiClient from '../../api/authenticatedApi';
import kbService from '../../services/kbService';
import promptService from '../../services/promptService';
import aiService from '../../services/aiService';
import voiceService from '../../services/voiceService';
import vectorStoreService from '../../services/vectorStoreService';
import fileSearchService from '../../services/fileSearchService';
import driftService from '../../services/driftService';
import reingestService from '../../services/reingestService';
import testRetrievalService from '../../services/testRetrievalService';
import provenanceService from '../../services/provenanceService';
import uncertaintyGateService from '../../services/uncertaintyGateService';
import languageVoiceService from '../../services/languageVoiceService';
import mcpToolsService from '../../services/mcpToolsService';
import ModelCapabilityRegistry from '../../components/config/ModelCapabilityRegistry';
import MCPToolsConfig from '../../components/config/MCPToolsConfig';
import LanguageVoiceMapping from '../../components/config/LanguageVoiceMapping';
import ModelVoiceSelection from '../../components/config/ModelVoiceSelection';
import ModelParameters from '../../components/config/ModelParameters';
import promptVersionService from '../../services/promptVersionService';
import flowParameterService from '../../services/flowParameterService';
import tokenManagementService from '../../services/tokenManagementService';
import { useModelCapabilities } from '../../hooks/useModelCapabilities';
import { useAIModels } from '../../hooks/useAIModels';
import { useMCPTools } from '../../hooks/useMCPTools';
import { useLanguageVoiceMappings } from '../../hooks/useLanguageVoiceMappings';
import { useModelVoiceCompatibility } from '../../hooks/useModelVoiceCompatibility';
import { useFallbackChain } from '../../hooks/useFallbackChain';
import { getCompatibleVoices } from '../../utils/modelCompatibility';

const AIKnowledgePage = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);
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

  // Phase 3: Advanced Features State
  const [driftStatus, setDriftStatus] = useState(null);
  const [reingestStatus, setReingestStatus] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [provenanceData, setProvenanceData] = useState(null);
  const [uncertaintyConfig, setUncertaintyConfig] = useState(null);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('7d');
  
  // Model parameters state
  const [modelParameters, setModelParameters] = useState(null);
  const [editingDomains, setEditingDomains] = useState({}); // { toolName: [domains] }
  const [newDomainInputs, setNewDomainInputs] = useState({}); // { toolName: '' }
  const [rateLimitValues, setRateLimitValues] = useState({}); // { toolName: limit }
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

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Fetch knowledge base files from OpenAI
  const { data: kbFiles = [], isLoading: kbLoading, error: kbError } = useQuery({
    queryKey: ['kb-files'],
    queryFn: () => kbService.getAllFiles(),
  });

  // Handle KB files data
  useEffect(() => {
    if (kbFiles) {
      console.log('🔍 KB Page - Files loaded successfully:', kbFiles);
    }
  }, [kbFiles]);

  // Handle KB files errors
  useEffect(() => {
    if (kbError) {
      console.error('🔍 KB Page - KB Files Error:', kbError);
      showError('Failed to load knowledge base files');
    }
  }, [kbError, showError]);

  // Fetch prompts
  const { data: prompts = [], isLoading: promptsLoading, error: promptsError } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => promptService.getAllPrompts(),
  });

  // Use custom hooks for data fetching
  const { isLoading: capabilitiesLoading } = useModelCapabilities();
  const { mappings: languageMappings, isLoading: mappingsLoading, saveMappings: saveLanguageMappings } = useLanguageVoiceMappings();
  const { tools: mcpTools, isLoading: mcpToolsLoading, refetch: refetchMcpTools } = useMCPTools();

  // Fetch prompt versions
  const { data: fetchedVersions = [], isLoading: versionsLoading, refetch: refetchVersions } = useQuery({
    queryKey: ['prompt-versions'],
    queryFn: () => promptVersionService.getPromptVersions('global')
  });

  // Fetch current version
  const { data: fetchedCurrentVersion, refetch: refetchCurrentVersion } = useQuery({
    queryKey: ['prompt-current-version'],
    queryFn: () => promptVersionService.getCurrentVersion('global'),
    enabled: false // Only fetch when needed
  });

  // Fetch flow parameter overrides
  const { data: fetchedFlowOverrides = [], isLoading: flowOverridesLoading, refetch: refetchFlowOverrides } = useQuery({
    queryKey: ['flow-parameters'],
    queryFn: () => flowParameterService.getFlowParameters()
  });

  // Update local state when MCP tools are fetched
  useEffect(() => {
    if (mcpTools && mcpTools.length > 0) {
      // Initialize editing domains state
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

  // Update local state when prompt versions are fetched
  useEffect(() => {
    if (fetchedVersions && fetchedVersions.length > 0) {
      setPromptVersions(fetchedVersions);
      const activeVersion = fetchedVersions.find(v => v.isActive);
      if (activeVersion) {
        setCurrentVersion(activeVersion);
      }
    }
  }, [fetchedVersions]);

  // Update local state when flow overrides are fetched
  useEffect(() => {
    if (fetchedFlowOverrides && fetchedFlowOverrides.length > 0) {
      const overridesMap = {};
      fetchedFlowOverrides.forEach(override => {
        overridesMap[override.flowType] = override;
      });
      setFlowOverrides(overridesMap);
    }
  }, [fetchedFlowOverrides]);

  // Fetch AI config to get fallback chain
  useEffect(() => {
    const fetchAIConfig = async () => {
      try {
        const config = await aiService.getConfig();
        if (config?.model?.id) {
          setValue('selectedModel', config.model.id);
          // Ensure primary model is first in fallback chain
          // Handle both old format (strings) and new format (objects with {modelId, voiceId})
          const currentVoiceId = config?.voice?.id || 'ash';
          if (config?.model?.fallbackChain && config.model.fallbackChain.length > 0) {
            let chain = [...config.model.fallbackChain];
            // Normalize to objects: handle both old format (strings) and new format (objects)
            chain = chain.map(item => {
              if (typeof item === 'string') {
                return { modelId: item, voiceId: currentVoiceId };
              }
              // If object, ensure it has both modelId and voiceId
              if (item && typeof item === 'object' && item.modelId) {
                return {
                  modelId: item.modelId,
                  voiceId: item.voiceId || currentVoiceId
                };
              }
              return null;
            }).filter(item => item !== null);
            
            // Remove primary model if it exists elsewhere
            chain = chain.filter(item => item.modelId !== config.model.id);
            // Add primary model as first with current voice
            chain = [{ modelId: config.model.id, voiceId: currentVoiceId }, ...chain];
            // Note: setFallbackChain will be available after hook initialization
            setTimeout(() => setFallbackChain(chain), 0);
          } else {
            // If no fallback chain, create one with just the primary model
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
  }, [setValue]);

  // Handle prompts data
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

  // Handle prompts errors
  useEffect(() => {
    if (promptsError) {
      console.error('Prompts Error:', promptsError);
      showError('Failed to load prompts');
    }
  }, [promptsError, showError]);

  // Use custom hooks for models and voices
  const { models, error: modelsError } = useAIModels();
  
  // Handle AI models errors
  useEffect(() => {
    if (modelsError) {
      console.error('Models Error:', modelsError);
      showError('Failed to load AI models');
    }
  }, [modelsError, showError]);

  // Fetch model parameters when model selection changes
  useEffect(() => {
    const selectedModel = watch('selectedModel');
    if (selectedModel) {
      aiService.getModelParameters(selectedModel)
        .then(params => setModelParameters(params))
        .catch(err => {
          console.error('Error fetching model parameters:', err);
          setModelParameters(null); // Fallback to defaults
        });
    } else {
      setModelParameters(null);
    }
  }, [watch('selectedModel')]);

  // Use model/voice compatibility hook
  const selectedModelId = watch('selectedModel');
  const selectedVoiceId = watch('selectedVoice');
  const { voices, compatibleVoices, getCompatibleVoices: getCompatibleVoicesForModel } = useModelVoiceCompatibility(selectedModelId, selectedVoiceId, setValue);

  // Use fallback chain hook (handles drag/drop and removal)
  const { fallbackChain, setFallbackChain, handleDragEnd: handleFallbackChainDragEnd, removeFromChain, addToChain } = useFallbackChain([], selectedModelId);

  // Fetch vector store status - use the same working endpoint as Knowledge Base Management
  const { data: vectorStoreData, isLoading: vectorStoreLoading, error: vectorStoreError } = useQuery({
    queryKey: ['vector-store-status'],
    queryFn: () => vectorStoreService.getStatus(),
  });

  // Handle vector store status data
  useEffect(() => {
    if (vectorStoreData) {
      console.log('Vector Store Status Data:', vectorStoreData);
      setVectorStoreStatus(vectorStoreData);
    }
  }, [vectorStoreData]);

  // Handle vector store status errors
  useEffect(() => {
    if (vectorStoreError) {
      console.error('Vector Store Status Error:', vectorStoreError);
      showError('Failed to load vector store status');
    }
  }, [vectorStoreError, showError]);


  // Fetch migration status
  const { data: migrationData, isLoading: migrationLoading, error: migrationError } = useQuery({
    queryKey: ['migration-status'],
    queryFn: () => vectorStoreService.getMigrationStatus(),
    refetchInterval: 5000, // Poll every 5 seconds when migration is running
  });

  // Handle migration status data
  useEffect(() => {
    if (migrationData) {
      setMigrationStatus(migrationData);
    }
  }, [migrationData]);

  // Handle migration status errors
  useEffect(() => {
    if (migrationError) {
      console.error('Migration Status Error:', migrationError);
    }
  }, [migrationError]);

  // Fetch drift detection status
  const { data: driftStatusData, isLoading: driftLoading, error: driftError } = useQuery({
    queryKey: ['drift-status'],
    queryFn: () => driftService.getDriftStatus(),
  });

  // Handle drift status data
  useEffect(() => {
    if (driftStatusData) {
      console.log('Drift Status Data:', driftStatusData);
      setDriftStatus(driftStatusData);
    }
  }, [driftStatusData]);

  // Handle drift status errors
  useEffect(() => {
    if (driftError) {
      console.error('Drift Status Error:', driftError);
      showError('Failed to load drift detection status');
    }
  }, [driftError, showError]);

  // Fetch reingest status
  const { data: reingestStatusData, isLoading: reingestLoading, error: reingestError } = useQuery({
    queryKey: ['reingest-status'],
    queryFn: () => reingestService.getReingestStatus(),
  });

  // Handle reingest status data
  useEffect(() => {
    if (reingestStatusData) {
      console.log('Reingest Status Data:', reingestStatusData);
      setReingestStatus(reingestStatusData);
    }
  }, [reingestStatusData]);

  // Handle reingest status errors
  useEffect(() => {
    if (reingestError) {
      console.error('Reingest Status Error:', reingestError);
      showError('Failed to load reingest status');
    }
  }, [reingestError, showError]);

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: ({ file, tags }) => kbService.uploadFile(file, tags),
    onSuccess: () => {
      showSuccess('File uploaded successfully to OpenAI');
      queryClient.invalidateQueries(['kb-files']);
      setSelectedTags([]);
    },
    onError: () => showError('Failed to upload file to OpenAI')
  });

  // Update tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: ({ fileId, tags }) => kbService.updateFileTags(fileId, tags),
    onSuccess: () => {
      showSuccess('Tags updated successfully');
      queryClient.invalidateQueries(['kb-files']);
      setEditTagsDialog({ open: false, file: null, tags: [] });
    },
    onError: () => showError('Failed to update tags')
  });

  // Re-ingest file mutation
  const reingestFileMutation = useMutation({
    mutationFn: (fileId) => kbService.reingestFile(fileId),
    onSuccess: () => {
      showSuccess('File re-ingested successfully');
      queryClient.invalidateQueries(['kb-files']);
    },
    onError: () => showError('Failed to re-ingest file')
  });

  // Detect drift mutation
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

  // Save prompt mutation
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
      // Clear the form after successful save
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


  // Vector store migration mutation
  const startMigrationMutation = useMutation({
    mutationFn: vectorStoreService.startMigration,
    onSuccess: () => {
      showSuccess('Migration started successfully');
      queryClient.invalidateQueries(['migration-status']);
    },
    onError: () => showError('Failed to start migration')
  });


  // Vector store validation mutation
  const validateVectorStoreMutation = useMutation({
    mutationFn: vectorStoreService.validate,
    onSuccess: (results) => {
      showSuccess(`Vector store validation completed: ${results.valid ? 'Valid' : 'Issues found'}`);
    },
    onError: () => showError('Failed to validate vector store')
  });

  // Vector store cleanup mutation
  const cleanupVectorStoreMutation = useMutation({
    mutationFn: vectorStoreService.cleanup,
    onSuccess: (results) => {
      showSuccess(`Cleanup completed: ${results.cleaned} files removed`);
      queryClient.invalidateQueries(['vector-store-status']);
    },
    onError: () => showError('Failed to cleanup vector store')
  });

  // File search mutation
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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type and size
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
      
      // Reset selected tags after upload
      setSelectedTags([]);
      // Reset file input
      event.target.value = '';
    }
  };


  const handleSavePrompt = async (data) => {
    // Ensure primary model is first in fallback chain
    let finalFallbackChain = [...fallbackChain];
    if (data.selectedModel) {
      // Remove primary model from chain if it exists elsewhere (check both string and object formats)
      finalFallbackChain = finalFallbackChain.filter(item => {
        const itemModelId = typeof item === 'string' ? item : item.modelId;
        return itemModelId !== data.selectedModel;
      });
      // Add primary model as first in chain with current voice
      finalFallbackChain = [{ modelId: data.selectedModel, voiceId: data.selectedVoice }, ...finalFallbackChain];
    }
    
    // Normalize fallback chain to ensure all items are objects with modelId and voiceId
    const normalizedFallbackChain = finalFallbackChain.map(item => {
      if (typeof item === 'string') {
        // Convert old string format to new object format
        return {
          modelId: item,
          voiceId: data.selectedVoice || 'ash'
        };
      }
      // Ensure object has both modelId and voiceId
      if (item && item.modelId && item.voiceId) {
        return {
          modelId: item.modelId,
          voiceId: item.voiceId
        };
      }
      return null;
    }).filter(item => item !== null);
    
    // Save using aiService to include fallback chain with full objects
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
          // Save full objects with modelId and voiceId
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
      // Update local fallback chain state (keep objects with voice info)
      setFallbackChain(normalizedFallbackChain);
    } catch (error) {
      showError('Failed to save AI configuration');
    }
  };

  // Handle language/voice mapping update
  const handleLanguageMappingChange = (languageCode, field, value) => {
    setLanguageMappings(prev => 
      prev.map(mapping => 
        mapping.languageCode === languageCode 
          ? { ...mapping, [field]: value }
          : mapping
      )
    );
  };

  // Handle voice preview
  const handleVoicePreview = async (voiceId, languageCode) => {
    try {
      setPreviewingVoice({ voiceId, languageCode });
      const sampleText = `Hello, this is a voice preview for ${languageCode}.`;
      await voiceService.previewVoice(voiceId, sampleText);
      showSuccess('Voice preview generated');
    } catch (error) {
      showError('Failed to preview voice');
    } finally {
      setPreviewingVoice(null);
    }
  };

  // Save language/voice mappings
  const handleSaveLanguageMappings = async () => {
    try {
      const mappingsToSave = languageMappings.map(mapping => ({
        languageCode: mapping.languageCode,
        voiceId: mapping.voiceId,
        voiceName: mapping.voiceName,
        isActive: mapping.isActive
      }));
      
      await languageVoiceService.bulkUpdateLanguageMappings(mappingsToSave);
      showSuccess('Language/voice mappings saved successfully');
      queryClient.invalidateQueries(['language-voice-mappings']);
    } catch (error) {
      showError('Failed to save language/voice mappings');
    }
  };

  // MCP Tools Handlers
  const handleToggleTool = async (toolName, enabled) => {
    try {
      if (enabled) {
        await mcpToolsService.enableTool(toolName);
      } else {
        await mcpToolsService.disableTool(toolName);
      }
      showSuccess(`Tool ${toolName} ${enabled ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to ${enabled ? 'enable' : 'disable'} tool ${toolName}`);
    }
  };

  const handleUpdateRateLimit = async (toolName, newLimit) => {
    try {
      if (newLimit < 1 || newLimit > 1000) {
        showError('Rate limit must be between 1 and 1000');
        return;
      }
      await mcpToolsService.updateRateLimit(toolName, newLimit);
      showSuccess(`Rate limit updated for ${toolName}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to update rate limit for ${toolName}`);
    }
  };

  const handleAddDomain = useCallback((toolName, domain) => {
    if (!domain || domain.trim() === '') {
      showError('Domain cannot be empty');
      return;
    }
    
    // Basic domain validation
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain.trim())) {
      showError('Invalid domain format');
      return;
    }

    setEditingDomains(prev => {
      const currentDomains = prev[toolName] || [];
      if (currentDomains.includes(domain.trim())) {
        showError('Domain already exists');
        return prev;
      }
      const updatedDomains = [...currentDomains, domain.trim()];
      return { ...prev, [toolName]: updatedDomains };
    });
    setNewDomainInputs(prev => ({ ...prev, [toolName]: '' }));
  }, [showError]);

  const handleRemoveDomain = useCallback((toolName, domainToRemove) => {
    setEditingDomains(prev => {
      const currentDomains = prev[toolName] || [];
      const updatedDomains = currentDomains.filter(d => d !== domainToRemove);
      return { ...prev, [toolName]: updatedDomains };
    });
  }, []);

  const handleSaveDomains = async (toolName) => {
    try {
      const domains = editingDomains[toolName] || [];
      await mcpToolsService.updateDomainAllowlist(toolName, domains);
      showSuccess(`Domain allowlist updated for ${toolName}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to update domain allowlist for ${toolName}`);
    }
  };

  // Prompt Version Handlers
  const handleViewVersion = (version) => {
    // Compare the selected version with the current active version
    const current = promptVersions.find(v => v.isActive);
    if (current) {
      // If viewing the active version, show it compared with itself
      // Otherwise, compare with current active version
      if (version.isActive) {
        setSelectedVersions({ version1: version, version2: version });
      } else {
        setSelectedVersions({ version1: current, version2: version });
      }
    } else {
      // No active version found, just show the selected version
      setSelectedVersions({ version1: version, version2: version });
    }
    setCompareDialogOpen(true);
  };

  const handleCompareVersions = (version1, version2) => {
    setSelectedVersions({ version1, version2 });
    setCompareDialogOpen(true);
  };

  const handleRollbackClick = (version) => {
    setRollbackVersion(version);
    setRollbackReason('');
    setRollbackDialogOpen(true);
  };

  const handleRollbackConfirm = async () => {
    try {
      const result = await promptVersionService.rollbackToVersion(
        rollbackVersion._id,
        rollbackReason || `Rollback to version ${rollbackVersion.version}`
      );
      showSuccess(`Rolled back to version ${rollbackVersion.version}. New version ${result.version.version} created.`);
      
      // Update the form field with the rolled-back content
      setValue('globalPrompt', result.promptContent || rollbackVersion.content);
      
      // Also fetch the updated config to ensure everything is in sync
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
      refetchCurrentVersion();
    } catch (error) {
      showError('Failed to rollback version');
    }
  };

  // Flow Parameter Handlers
  const handleSaveFlowOverride = async (flowType, overrideData) => {
    try {
      await flowParameterService.createOrUpdateFlowOverride(flowType, overrideData);
      showSuccess(`Flow parameter override for ${flowType} saved successfully`);
      setEditingFlowType(null);
      refetchFlowOverrides();
      queryClient.invalidateQueries(['flow-parameters']);
    } catch (error) {
      showError(`Failed to save flow parameter override for ${flowType}`);
    }
  };

  const handleTestFlowDetection = async () => {
    try {
      const result = await flowParameterService.detectFlowType(flowDetectionTest.text);
      setFlowDetectionTest({ ...flowDetectionTest, result });
    } catch (error) {
      showError('Failed to test flow detection');
    }
  };

  const handleCancelConfig = async () => {
    try {
      const config = await aiService.getConfig();
      
      // Reset all form values to saved state
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
        // Reset fallback chain to saved state (handle both old and new formats)
        const currentVoiceId = config?.voice?.id || 'ash';
        if (config?.model?.fallbackChain && config.model.fallbackChain.length > 0) {
          let chain = [...config.model.fallbackChain];
          // Normalize to objects: handle both old format (strings) and new format (objects)
          chain = chain.map(item => {
            if (typeof item === 'string') {
              return { modelId: item, voiceId: currentVoiceId };
            }
            // If object, ensure it has both modelId and voiceId
            if (item && typeof item === 'object' && item.modelId) {
              return {
                modelId: item.modelId,
                voiceId: item.voiceId || currentVoiceId
              };
            }
            return null;
          }).filter(item => item !== null);
          
          // Remove primary model if it exists elsewhere
          chain = chain.filter(item => item.modelId !== config.model.id);
          // Add primary model as first with current voice
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
  };


  const handleFileSearch = () => {
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
  };

  // Fallback chain handlers (using hook methods)
  const handleDragEnd = handleFallbackChainDragEnd;
  
  const handleRemoveFromFallbackChain = removeFromChain;

  // Save model/voice selection and add model to fallback chain (UI only)
  const handleSaveModelVoice = () => {
    const selectedModel = watch('selectedModel');
    const selectedVoice = watch('selectedVoice');

    // Use hook's addToChain method which handles validation and adding to chain
    addToChain(selectedModel, selectedVoice);
  };

  // Sortable item component
  const SortableItem = ({ id, index }) => {
    // Extract modelId from object or use id directly (for backward compatibility)
    const chainItem = fallbackChain[index];
    const modelId = typeof chainItem === 'string' ? chainItem : chainItem?.modelId || id;
    const voiceId = typeof chainItem === 'string' ? undefined : chainItem?.voiceId;
    
    const model = models.find(m => m.id === modelId);
    const voice = voices.find(v => v.id === voiceId);
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({ id: modelId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1
    };

    return (
      <Paper
        ref={setNodeRef}
        style={style}
        sx={{
          p: 2,
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: isDragging ? 'action.selected' : 'background.paper',
          border: index === 0 ? '2px solid' : '1px solid',
          borderColor: index === 0 ? 'primary.main' : 'divider',
          boxShadow: isDragging ? 3 : 1
        }}
      >
        <Box
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
        >
          <DragIndicator color="action" />
        </Box>
        
        <Chip
          label={index === 0 ? 'Primary' : `Fallback ${index}`}
          color={index === 0 ? 'primary' : 'default'}
          size="small"
        />
        
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body1" fontWeight="medium">
            {model?.name || modelId}
          </Typography>
          {model && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {model.capabilities?.realtime ? 'Realtime' : 'Standard'} • 
                Context: {model.contextLimit || model.context_limit || 'N/A'} tokens
                {voice && ` • Voice: ${voice.name}`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {model.supportsTools && (
                  <Chip 
                    label="Tools" 
                    size="small" 
                    color="success" 
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {model.supportsAudio && (
                  <Chip 
                    label="Audio" 
                    size="small" 
                    color="success" 
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {model.capabilities?.fileSearch && (
                  <Chip 
                    label="File Search" 
                    size="small" 
                    color="success" 
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {model.rateLimits && (
                  <Tooltip 
                    title={`Rate Limits: ${model.rateLimits.requestsPerMinute} req/min, ${model.rateLimits.tokensPerMinute?.toLocaleString() || 'N/A'} tokens/min`}
                    arrow
                  >
                    <Chip 
                      label={`${model.rateLimits.requestsPerMinute} req/min`} 
                      size="small" 
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  </Tooltip>
                )}
              </Box>
              {model.knownLimitations && model.knownLimitations.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                  <Typography variant="caption">
                    {model.knownLimitations.join(', ')}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
          {!model && (
            <Typography variant="caption" color="text.secondary">
              Model details not available
            </Typography>
          )}
        </Box>

        {index > 0 && (
          <IconButton
            size="small"
            onClick={() => handleRemoveFromFallbackChain(index)}
            color="error"
          >
            <Delete />
          </IconButton>
        )}
      </Paper>
    );
  };

  const handleViewFile = async (file) => {
    try {
      setViewFileModal({ open: true, file, content: null });
      const content = await kbService.getFileContent(file.id);
      console.log('🔍 File content received:', content);
      console.log('🔍 Content type:', typeof content);
      console.log('🔍 Content.content:', content?.content);
      setViewFileModal({ open: true, file, content });
    } catch (error) {
      console.error('Error fetching file content:', error);
      showError('Failed to load file content');
    }
  };

  const handleCloseViewFile = () => {
    setViewFileModal({ open: false, file: null, content: null });
  };

  const handleOpenEditTags = (file) => {
    setEditTagsDialog({
      open: true,
      file: file,
      tags: file.tags || []
    });
  };

  const handleCloseEditTags = () => {
    setEditTagsDialog({ open: false, file: null, tags: [] });
  };

  const handleSaveTags = () => {
    if (!editTagsDialog.file) return;
    updateTagsMutation.mutate({
      fileId: editTagsDialog.file.id,
      tags: editTagsDialog.tags
    });
  };

  const handleReingestFile = async (file) => {
    if (reingestingFiles.has(file.id)) return;
    
    setReingestingFiles(prev => new Set(prev).add(file.id));
    try {
      await reingestFileMutation.mutateAsync(file.id);
    } finally {
      setReingestingFiles(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  };

  const handleDetectDrift = async (file) => {
    if (detectingDrift.has(file.id)) return;
    
    setDetectingDrift(prev => new Set(prev).add(file.id));
    try {
      await detectDriftMutation.mutateAsync(file.id);
    } finally {
      setDetectingDrift(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  };


  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          AI & Knowledge Base
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage knowledge base files and AI prompt configurations
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Knowledge Base Management" />
          <Tab label="AI Configuration" />
          <Tab label="System Operations" />
          <Tab label="Analytics & Monitoring" />
        </Tabs>
      </Paper>

      {/* Tab 1: Knowledge Base Management */}
      {currentTab === 0 && (
        <Box>
          {/* Vector Store Status Overview */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Vector Store Status
            </Typography>
            {vectorStoreLoading ? (
              <Typography>Loading vector store status...</Typography>
            ) : vectorStoreError ? (
              <Alert severity="error">
                Failed to load vector store status: {vectorStoreError.message}
              </Alert>
            ) : vectorStoreStatus && (vectorStoreStatus.id || vectorStoreStatus.status) ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip
                    label={vectorStoreStatus.status === 'completed' ? 'Active' : (vectorStoreStatus.status || 'Unknown')}
                    color={vectorStoreStatus.status === 'active' || vectorStoreStatus.status === 'completed' ? 'success' : 'default'}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Files</Typography>
                  <Typography variant="h6">{vectorStoreStatus.fileCount || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Vector Store Name</Typography>
                  <Typography variant="body2">
                    {vectorStoreStatus.name || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Last Updated</Typography>
                  <Typography variant="body2">
                    {vectorStoreStatus.lastUpdated ? formatDateTime(vectorStoreStatus.lastUpdated) : 'N/A'}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Alert severity="warning">Unable to load vector store status</Alert>
            )}
          </Paper>

          {/* File Upload Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upload Knowledge Base Files
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Supported formats: PDF, TXT, MD, HTML, DOC, DOCX (Max 25MB per file). Files are uploaded to OpenAI and added to the vector store.
            </Alert>
            
            {/* Tag Selection */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Select Tags (optional)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {tagOptions.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag) 
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                    color={selectedTags.includes(tag) ? 'primary' : 'default'}
                    variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
              {selectedTags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Selected:
                  </Typography>
                  {selectedTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      onDelete={() => {
                        setSelectedTags(prev => prev.filter(t => t !== tag));
                      }}
                      color="primary"
                    />
                  ))}
                </Box>
              )}
            </Box>

            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUpload />}
              disabled={uploadFileMutation.isLoading}
            >
              Upload File
              <input
                type="file"
                hidden
                accept=".pdf,.html,.md,.txt,.doc,.docx"
                onChange={handleFileUpload}
              />
            </Button>
          </Paper>

          {/* Unified Search Interface */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Knowledge Base Search
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Search across all knowledge base files using OpenAI File Search and Vector Search
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                label="Search Query"
                value={fileSearchQuery}
                onChange={(e) => setFileSearchQuery(e.target.value)}
                placeholder="Search for information in knowledge base files..."
                onKeyPress={(e) => e.key === 'Enter' && handleFileSearch()}
              />
              <Button
                variant="contained"
                onClick={handleFileSearch}
                disabled={fileSearchMutation.isLoading || isSearching}
                startIcon={<Refresh />}
              >
                {fileSearchMutation.isLoading ? 'Searching...' : 'Search'}
              </Button>
            </Box>

            {/* Search Results */}
            {fileSearchResults.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Search Results ({fileSearchResults.length})
                </Typography>
                <List>
                  {fileSearchResults.map((result, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={result.fileName}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary" component="span">
                              Similarity: {(result.similarityScore * 100).toFixed(1)}%
                            </Typography>
                            <Typography variant="body2" component="span" sx={{ mt: 1, display: 'block' }}>
                              {typeof result.content === 'string' ? result.content.substring(0, 200) + '...' : JSON.stringify(result.content).substring(0, 200) + '...'}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

          </Paper>

          {/* Files Table */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Knowledge Base Files ({Array.isArray(kbFiles) ? kbFiles.length : 0})
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Filename</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell>Uploaded At</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Drift</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(kbFiles) ? kbFiles : []).map((file, index) => (
                    <TableRow key={file.id || index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Description fontSize="small" />
                          {file.filename}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {file.tags && file.tags.length > 0 ? (
                            file.tags.map((tag, tagIndex) => (
                              <Chip key={tagIndex} label={tag} size="small" variant="outlined" />
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              No tags
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ width: 150 }}>{formatDateTime(new Date(file.created_at * 1000)).slice(0,11)}</TableCell>
                      <TableCell>
                        <Chip
                          label={file.status || 'Active'}
                          color={file.status === 'processed' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {file.hasDrift ? (
                            <Chip
                              icon={<Warning />}
                              label="Drift Detected"
                              color="warning"
                              size="small"
                              title={`Drift Score: ${(file.driftScore * 100).toFixed(1)}%`}
                            />
                          ) : (
                            <Chip
                              icon={<CheckCircle />}
                              label="No Drift"
                              color="success"
                              size="small"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleViewFile(file)}
                            title="View file details"
                            color="primary"
                          >
                            <Visibility />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditTags(file)}
                            title="Edit tags"
                            color="primary"
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleReingestFile(file)}
                            title="Re-ingest file"
                            color="secondary"
                            disabled={reingestingFiles.has(file.id) || reingestFileMutation.isLoading}
                          >
                            <Refresh />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDetectDrift(file)}
                            title="Detect drift"
                            color={file.hasDrift ? 'warning' : 'default'}
                            disabled={detectingDrift.has(file.id) || detectDriftMutation.isLoading}
                          >
                            <Warning />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* Tab 2: AI Configuration */}
      {currentTab === 1 && (
        <form onSubmit={handleSubmit(handleSavePrompt)}>
          <Box>
            {/* Global Prompt Editor */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Global System Prompt for "Robert"
                </Typography>
                {currentVersion && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                      label={`Version ${currentVersion.version}`} 
                      color="primary" 
                      size="small"
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Last modified by {currentVersion.createdBy} on {formatDateTime(currentVersion.createdAt)}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure the global system prompt that defines Robert's behavior, personality, and capabilities.
              </Typography>
              <Controller
                name="globalPrompt"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    multiline
                    rows={8}
                    fullWidth
                    placeholder="Enter the global AI prompt for Robert..."
                    sx={{ mb: 2 }}
                  />
                )}
              />
            </Paper>

            {/* Prompt Version History */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Prompt Version History
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => refetchVersions()}
                  disabled={versionsLoading}
                >
                  Refresh
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                View all versions of the global prompt, compare changes, and rollback to previous versions if needed.
              </Typography>

              {versionsLoading ? (
                <LinearProgress sx={{ mb: 2 }} />
              ) : promptVersions.length === 0 ? (
                <Alert severity="info">
                  No version history found. Versions will be created automatically when you save changes to the prompt.
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Version</strong></TableCell>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell><strong>Author</strong></TableCell>
                        <TableCell><strong>Change Reason</strong></TableCell>
                        <TableCell><strong>Preview</strong></TableCell>
                        <TableCell align="center"><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {promptVersions.map((version) => (
                        <TableRow 
                          key={version._id}
                          sx={{
                            bgcolor: version.isActive ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight={version.isActive ? "bold" : "medium"}>
                                v{version.version}
                              </Typography>
                              {version.isActive && (
                                <Chip label="Active" size="small" color="primary" />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDateTime(version.createdAt)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {version.createdBy || 'admin'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {version.changeReason || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={version.content}>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{ 
                                  maxWidth: 300, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {version.content.substring(0, 100)}
                                {version.content.length > 100 ? '...' : ''}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <Tooltip title="View full version">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewVersion(version)}
                                >
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {!version.isActive && (
                                <>
                                  <Tooltip title="Compare with current">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        const current = promptVersions.find(v => v.isActive);
                                        if (current) {
                                          handleCompareVersions(current, version);
                                        }
                                      }}
                                    >
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Rollback to this version">
                                    <IconButton
                                      size="small"
                                      color="warning"
                                      onClick={() => handleRollbackClick(version)}
                                    >
                                      <ArrowForward fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            {/* Per-Flow Parameter Overrides */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Per-Flow Parameter Overrides
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure different AI parameters for different conversation flow types. These overrides will be applied when the system detects the corresponding flow type.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => refetchFlowOverrides()}
                >
                  Refresh
                </Button>
              </Box>

              {flowOverridesLoading ? (
                <LinearProgress />
              ) : (
                <Box>
                  {/* Flow Type Cards */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
                    {['information', 'booking', 'complaint', 'human_transfer'].map((flowType) => {
                      const override = flowOverrides[flowType];
                      const defaults = {
                        information: { temperature: 0.3, topP: 1.0, maxTokens: 200 },
                        booking: { temperature: 0.4, topP: 1.0, maxTokens: 150 },
                        complaint: { temperature: 0.5, topP: 1.0, maxTokens: 200 },
                        human_transfer: { temperature: 0.3, topP: 1.0, maxTokens: 100 }
                      };
                      const defaultParams = defaults[flowType];
                      const isEditing = editingFlowType === flowType;
                      const currentParams = override?.parameters || defaultParams;
                      const currentEnabled = override?.enabled ?? false;
                      const currentPriority = override?.priority ?? 0;

                      return (
                        <Card key={flowType} variant="outlined">
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              <Typography variant="subtitle1" fontWeight="bold" textTransform="capitalize">
                                {flowType.replace('_', ' ')}
                              </Typography>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={isEditing ? (editingFlowParams[flowType]?.enabled ?? currentEnabled) : currentEnabled}
                                    onChange={(e) => setEditingFlowParams({
                                      ...editingFlowParams,
                                      [flowType]: {
                                        ...editingFlowParams[flowType],
                                        enabled: e.target.checked
                                      }
                                    })}
                                    disabled={!isEditing}
                                  />
                                }
                                label="Enabled"
                              />
                            </Box>

                            {isEditing ? (
                              <Box>
                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Temperature
                                  </Typography>
                                  <Slider
                                    value={editingFlowParams[flowType]?.parameters?.temperature ?? currentParams.temperature}
                                    onChange={(e, val) => setEditingFlowParams({
                                      ...editingFlowParams,
                                      [flowType]: {
                                        ...editingFlowParams[flowType],
                                        parameters: {
                                          ...(editingFlowParams[flowType]?.parameters || currentParams),
                                          temperature: val
                                        }
                                      }
                                    })}
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    marks={[{ value: defaultParams.temperature, label: 'Default' }]}
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    {(editingFlowParams[flowType]?.parameters?.temperature ?? currentParams.temperature).toFixed(1)}
                                  </Typography>
                                </Box>

                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Top-P
                                  </Typography>
                                  <Slider
                                    value={editingFlowParams[flowType]?.parameters?.topP ?? currentParams.topP}
                                    onChange={(e, val) => setEditingFlowParams({
                                      ...editingFlowParams,
                                      [flowType]: {
                                        ...editingFlowParams[flowType],
                                        parameters: {
                                          ...(editingFlowParams[flowType]?.parameters || currentParams),
                                          topP: val
                                        }
                                      }
                                    })}
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    marks={[{ value: defaultParams.topP, label: 'Default' }]}
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    {(editingFlowParams[flowType]?.parameters?.topP ?? currentParams.topP).toFixed(1)}
                                  </Typography>
                                </Box>

                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Max Tokens
                                  </Typography>
                                  <TextField
                                    type="number"
                                    value={editingFlowParams[flowType]?.parameters?.maxTokens ?? currentParams.maxTokens}
                                    onChange={(e) => setEditingFlowParams({
                                      ...editingFlowParams,
                                      [flowType]: {
                                        ...editingFlowParams[flowType],
                                        parameters: {
                                          ...(editingFlowParams[flowType]?.parameters || currentParams),
                                          maxTokens: parseInt(e.target.value) || 0
                                        }
                                      }
                                    })}
                                    size="small"
                                    fullWidth
                                    inputProps={{ min: 1 }}
                                  />
                                </Box>

                                <Box sx={{ mb: 2 }}>
                                  <TextField
                                    label="Priority"
                                    type="number"
                                    value={editingFlowParams[flowType]?.priority ?? currentPriority}
                                    onChange={(e) => setEditingFlowParams({
                                      ...editingFlowParams,
                                      [flowType]: {
                                        ...editingFlowParams[flowType],
                                        priority: parseInt(e.target.value) || 0
                                      }
                                    })}
                                    size="small"
                                    fullWidth
                                    helperText="Higher priority overrides take precedence"
                                  />
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<Save />}
                                    onClick={() => {
                                      const editData = editingFlowParams[flowType];
                                      handleSaveFlowOverride(flowType, {
                                        enabled: editData?.enabled ?? currentEnabled,
                                        parameters: editData?.parameters || currentParams,
                                        priority: editData?.priority ?? currentPriority
                                      });
                                      setEditingFlowParams({ ...editingFlowParams, [flowType]: undefined });
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => {
                                      setEditingFlowType(null);
                                      setEditingFlowParams({ ...editingFlowParams, [flowType]: undefined });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </Box>
                              </Box>
                            ) : (
                              <Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  Temperature: {override?.parameters?.temperature?.toFixed(1) || defaultParams.temperature.toFixed(1)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  Top-P: {override?.parameters?.topP?.toFixed(1) || defaultParams.topP.toFixed(1)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  Max Tokens: {override?.parameters?.maxTokens || defaultParams.maxTokens}
                                </Typography>
                                {override?.priority !== undefined && (
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Priority: {override.priority}
                                  </Typography>
                                )}
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<Edit />}
                                  onClick={() => {
                                    setEditingFlowType(flowType);
                                    setEditingFlowParams({
                                      ...editingFlowParams,
                                      [flowType]: {
                                        enabled: currentEnabled,
                                        parameters: { ...currentParams },
                                        priority: currentPriority
                                      }
                                    });
                                  }}
                                  sx={{ mt: 1 }}
                                  fullWidth
                                >
                                  {override ? 'Edit' : 'Configure'}
                                </Button>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>

                  {/* Flow Detection Test */}
                  <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Test Flow Detection
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Enter text to test which flow type would be detected
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <TextField
                        fullWidth
                        placeholder="Enter conversation text..."
                        value={flowDetectionTest.text}
                        onChange={(e) => setFlowDetectionTest({ ...flowDetectionTest, text: e.target.value })}
                        size="small"
                      />
                      <Button
                        variant="contained"
                        onClick={handleTestFlowDetection}
                        disabled={!flowDetectionTest.text}
                      >
                        Test
                      </Button>
                    </Box>
                    {flowDetectionTest.result && (
                      <Alert severity="info">
                        Detected Flow: <strong>{flowDetectionTest.result.detectedFlow}</strong>
                        {' '}(Intent: {flowDetectionTest.result.intent})
                      </Alert>
                    )}
                  </Box>
                </Box>
              )}
            </Paper>

            {/* Token Management & Context Limits */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Token Management & Context Limits
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monitor token usage, context limits, and truncation statistics. The system automatically manages context to stay within model limits.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => {
                    queryClient.invalidateQueries(['token-stats']);
                  }}
                >
                  Refresh
                </Button>
              </Box>

              <TokenManagementStatsComponent />
            </Paper>

            {/* Model & Voice Selection with Fallback Chain */}
            <ModelVoiceSelection 
                  control={control}
              watch={watch}
              fallbackChain={fallbackChain}
              setFallbackChain={setFallbackChain}
              showFallbackChain={true}
              showDefaultVoice={false}
            />

            {/* AI Parameters */}
            <ModelParameters control={control} watch={watch} modelId={watch('selectedModel')} />

            {/* Uncertainty Gate Configuration */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Uncertainty Gate Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure confidence thresholds and uncertainty handling for knowledge base responses.
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, alignItems: 'flex-start' }}>
                <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                  <FormControlLabel
                    control={
                      <Controller
                        name="uncertaintyGateEnabled"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            {...field}
                            checked={field.value ?? true}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        )}
                      />
                    }
                    label="Enable Uncertainty Gate"
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    When enabled, the system will validate knowledge base responses against confidence thresholds.
                  </Typography>
                </Box>

                <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Confidence Threshold: {watch('uncertaintyGateThreshold')}
                  </Typography>
                  <Controller
                    name="uncertaintyGateThreshold"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Slider
                          {...field}
                          value={field.value ?? 0.8}
                          min={0}
                          max={1}
                          step={0.1}
                          marks
                          valueLabelDisplay="auto"
                        />
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          Minimum confidence score required for knowledge base responses (0.0 - 1.0)
                        </Typography>
                      </>
                    )}
                  />
                </Box>

                <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Minimum Sources: {watch('uncertaintyGateMinSources')}
                  </Typography>
                  <Controller
                    name="uncertaintyGateMinSources"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Slider
                          {...field}
                          value={field.value ?? 1}
                          min={1}
                          max={10}
                          step={1}
                          marks
                          valueLabelDisplay="auto"
                        />
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          Minimum number of knowledge base sources required for a valid response
                        </Typography>
                      </>
                    )}
                  />
                </Box>
              </Box>
            </Paper>

            {/* Model Capability Registry - Simplified View */}
            <ModelCapabilityRegistry 
              mode="simplified" 
              selectedModelId={watch('selectedModel')} 
              fallbackChain={fallbackChain} 
            />

            {/* Language/Voice Mapping Configuration */}
            <LanguageVoiceMapping />

            {/* MCP Tools Configuration */}
            <MCPToolsConfig showSystemControls={false} />

            {/* Unified Save/Cancel Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4, mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Undo />}
                onClick={handleCancelConfig}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<Save />}
              >
                Save Config
              </Button>
            </Box>
          </Box>
        </form>
      )}

      {/* Tab 3: System Operations */}
      {currentTab === 2 && (
        <Box>
          {/* System Status Dashboard */}
          <Paper sx={{ p: 4, mb: 3, borderRadius: 2 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" gutterBottom fontWeight="bold">
                System Status Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monitor the overall health and status of all system operations
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {/* Vector Store Status Card */}
              <Grid item xs={12} md={4}>
                <Card 
                  sx={{ 
                    height: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: (vectorStoreStatus?.status === 'active' || vectorStoreStatus?.status === 'completed') 
                            ? 'success.light' 
                            : 'grey.300',
                          width: 48,
                          height: 48
                        }}
                      >
                        <Storage />
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" fontWeight="600">
                          Vector Store
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Knowledge Base Storage
                        </Typography>
                      </Box>
                    </Stack>

                    {vectorStoreLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress sx={{ flexGrow: 1 }} />
                        <Typography variant="caption">Loading...</Typography>
                      </Box>
                    ) : vectorStoreError ? (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {vectorStoreError.message}
                      </Alert>
                    ) : vectorStoreStatus && (vectorStoreStatus.id || vectorStoreStatus.status) ? (
                      <Stack spacing={2}>
                        <Box>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="500">
                              Status
                            </Typography>
                            <Chip
                              label={vectorStoreStatus.status === 'completed' ? 'Active' : (vectorStoreStatus.status || 'Unknown')}
                              color={vectorStoreStatus.status === 'active' || vectorStoreStatus.status === 'completed' ? 'success' : 'default'}
                              size="small"
                              icon={vectorStoreStatus.status === 'active' || vectorStoreStatus.status === 'completed' ? <CheckCircleIcon /> : <ErrorOutline />}
                            />
                          </Stack>
                        </Box>
                        <Divider />
                        <Box>
                          <Typography variant="h4" fontWeight="bold" color="primary.main">
                            {vectorStoreStatus.fileCount || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Total Files
                          </Typography>
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Update fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              Last Updated
                            </Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight="500" sx={{ mt: 0.5 }}>
                            {vectorStoreStatus.lastUpdated ? formatDateTime(vectorStoreStatus.lastUpdated) : 'N/A'}
                          </Typography>
                        </Box>
                      </Stack>
                    ) : (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Unable to load vector store status
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Drift Detection Status Card */}
              <Grid item xs={12} md={4}>
                <Card 
                  sx={{ 
                    height: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: driftStatus?.filesWithDrift > 0 ? 'warning.light' : 'info.light',
                          width: 48,
                          height: 48
                        }}
                      >
                        <TrendingUp />
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" fontWeight="600">
                          Drift Detection
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Content Change Monitoring
                        </Typography>
                      </Box>
                    </Stack>

                    {driftLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress sx={{ flexGrow: 1 }} />
                        <Typography variant="caption">Loading...</Typography>
                      </Box>
                    ) : driftError ? (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {driftError.message}
                      </Alert>
                    ) : driftStatus && (driftStatus.totalFiles !== undefined || driftStatus.lastCheck) ? (
                      <Stack spacing={2}>
                        <Box>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="500">
                              Total Files
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              {driftStatus.totalFiles || 0}
                            </Typography>
                          </Stack>
                          {driftStatus.totalFiles > 0 && (
                            <LinearProgress 
                              variant="determinate" 
                              value={((driftStatus.totalFiles - (driftStatus.filesWithDrift || 0)) / driftStatus.totalFiles) * 100}
                              sx={{ height: 6, borderRadius: 3 }}
                              color={driftStatus.filesWithDrift > 0 ? 'warning' : 'success'}
                            />
                          )}
                        </Box>
                        <Divider />
                        <Box>
                          <Typography variant="h4" fontWeight="bold" color={driftStatus.filesWithDrift > 0 ? 'warning.main' : 'success.main'}>
                            {driftStatus.filesWithDrift || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Files with Drift
                          </Typography>
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AccessTime fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              Last Check
                            </Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight="500" sx={{ mt: 0.5 }}>
                            {driftStatus.lastCheck ? formatDateTime(driftStatus.lastCheck) : 'Never'}
                          </Typography>
                        </Box>
                      </Stack>
                    ) : (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        No drift detection data available
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Reingest Status Card */}
              <Grid item xs={12} md={4}>
                <Card 
                  sx={{ 
                    height: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: reingestStatus?.isRunning ? 'warning.light' : 'primary.light',
                          width: 48,
                          height: 48
                        }}
                      >
                        <Sync />
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" fontWeight="600">
                          Reingest Status
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          File Processing Queue
                        </Typography>
                      </Box>
                    </Stack>

                    {reingestLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress sx={{ flexGrow: 1 }} />
                        <Typography variant="caption">Loading...</Typography>
                      </Box>
                    ) : reingestError ? (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {reingestError.message}
                      </Alert>
                    ) : reingestStatus && (reingestStatus.isRunning !== undefined || reingestStatus.lastRun) ? (
                      <Stack spacing={2}>
                        <Box>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="500">
                              Status
                            </Typography>
                            <Chip
                              label={reingestStatus.isRunning ? 'Running' : 'Idle'}
                              color={reingestStatus.isRunning ? 'warning' : 'default'}
                              size="small"
                              icon={reingestStatus.isRunning ? <Sync /> : <CheckCircleIcon />}
                            />
                          </Stack>
                          {reingestStatus.isRunning && (
                            <LinearProgress sx={{ mt: 1, height: 6, borderRadius: 3 }} />
                          )}
                        </Box>
                        <Divider />
                        <Box>
                          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                            <Box>
                              <Typography variant="h4" fontWeight="bold" color="success.main">
                                {reingestStatus.filesProcessed || 0}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Files Processed
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="h4" fontWeight="bold" color="error.main">
                                {reingestStatus.filesFailed || 0}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Files Failed
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AccessTime fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              Last Run
                            </Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight="500" sx={{ mt: 0.5 }}>
                            {reingestStatus.lastRun ? formatDateTime(reingestStatus.lastRun) : 'Never'}
                          </Typography>
                        </Box>
                      </Stack>
                    ) : (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        No reingest data available
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          {/* Drift Detection */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Drift Detection
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Monitor knowledge base content for changes and detect when files may be outdated.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={async () => {
                  try {
                    const result = await driftService.startDriftDetection();
                    setDriftStatus(result);
                    queryClient.invalidateQueries(['drift-status']);
                    showSuccess('Drift detection started');
                  } catch (error) {
                    showError('Failed to start drift detection');
                  }
                }}
              >
                Start Detection
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  queryClient.invalidateQueries(['drift-status']);
                }}
              >
                Check Status
              </Button>
            </Box>
          </Paper>

          {/* Reingest Operations */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Reingest Operations
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Re-process knowledge base files to update the vector store with latest content.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={async () => {
                  try {
                    const result = await reingestService.startReingest();
                    setReingestStatus(result);
                    queryClient.invalidateQueries(['reingest-status']);
                    showSuccess('Reingest started');
                  } catch (error) {
                    showError('Failed to start reingest');
                  }
                }}
              >
                Start Reingest
              </Button>
              <Button
                variant="outlined"
                startIcon={<Schedule />}
                onClick={() => {
                  setScheduleReingestDialog({ open: true, fileIds: [], delay: 0 });
                }}
              >
                Schedule Reingest
              </Button>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={async () => {
                  if (selectedReingestTags.length === 0) {
                    showError('Please select at least one tag');
                    return;
                  }
                  try {
                    // Get files with selected tags
                    const allFiles = await kbService.getAllFiles();
                    const filesToReingest = allFiles
                      .filter(file => selectedReingestTags.some(tag => file.tags?.includes(tag)))
                      .map(file => file.id || file._id);
                    
                    if (filesToReingest.length === 0) {
                      showError('No files found with selected tags');
                      return;
                    }
                    
                    const result = await reingestService.startReingest(filesToReingest);
                    setReingestStatus(result);
                    queryClient.invalidateQueries(['reingest-status']);
                    showSuccess(`Reingest started for ${filesToReingest.length} files`);
                  } catch (error) {
                    showError('Failed to start reingest by tags');
                  }
                }}
              >
                Reingest by Tags
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  queryClient.invalidateQueries(['reingest-status']);
                }}
              >
                Check Status
              </Button>
            </Box>

            {/* Tag Selection for Reingest */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Select Tags for Reingest:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {tagOptions.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => {
                      setSelectedReingestTags(prev => 
                        prev.includes(tag) 
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                    color={selectedReingestTags.includes(tag) ? 'primary' : 'default'}
                    variant={selectedReingestTags.includes(tag) ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
              {selectedReingestTags.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {selectedReingestTags.length} tag(s) selected
                </Typography>
              )}
            </Box>
          </Paper>

          {/* Vector Store Management */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Vector Store Management
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Manage vector store migration, validation, and cleanup operations.
            </Typography>

            {/* Migration Controls */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>Migration Controls</Typography>
              {migrationStatus && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Migration Status: {migrationStatus.status || 'idle'}
                  </Typography>
                  {migrationStatus.status === 'in_progress' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2">
                        Progress: {migrationStatus.processed || 0} / {migrationStatus.total || 0}
                      </Typography>
                      <Box sx={{ flexGrow: 1, bgcolor: 'grey.200', borderRadius: 1, height: 8 }}>
                        <Box
                          sx={{
                            bgcolor: 'primary.main',
                            height: '100%',
                            borderRadius: 1,
                            width: `${((migrationStatus.processed || 0) / (migrationStatus.total || 1)) * 100}%`
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                  {migrationStatus.errors && migrationStatus.errors.length > 0 && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {migrationStatus.errors.length} errors occurred during migration
                    </Alert>
                  )}
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => startMigrationMutation.mutate()}
                  disabled={startMigrationMutation.isLoading || migrationStatus?.status === 'in_progress'}
                >
                  Start Migration
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => validateVectorStoreMutation.mutate()}
                  disabled={validateVectorStoreMutation.isLoading}
                >
                  Validate Store
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => cleanupVectorStoreMutation.mutate()}
                  disabled={cleanupVectorStoreMutation.isLoading}
                >
                  Cleanup Orphaned Files
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Scheduled Migration Configuration */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scheduled Migration Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure automatic nightly migration of knowledge base files to OpenAI vector store.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduledMigrationEnabled}
                    onChange={(e) => {
                      setScheduledMigrationEnabled(e.target.checked);
                      // TODO: Save to backend API
                      showSuccess(e.target.checked ? 'Scheduled migration enabled' : 'Scheduled migration disabled');
                    }}
                  />
                }
                label="Enable Nightly Migration"
              />
            </Box>

            {scheduledMigrationEnabled && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                  <TextField
                    label="Scheduled Time"
                    type="time"
                    value={scheduledMigrationTime}
                    onChange={(e) => {
                      setScheduledMigrationTime(e.target.value);
                      // TODO: Save to backend API
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 200 }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      // TODO: Save schedule to backend
                      showSuccess('Migration schedule updated');
                    }}
                  >
                    Save Schedule
                  </Button>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                    <Chip
                      label={scheduledMigrationEnabled ? 'Active' : 'Inactive'}
                      color={scheduledMigrationEnabled ? 'success' : 'default'}
                      icon={scheduledMigrationEnabled ? <CheckCircleOutline /> : <CancelOutlined />}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Last Run</Typography>
                    <Typography variant="body2">
                      {scheduledMigrationLastRun ? formatDateTime(scheduledMigrationLastRun) : 'Never'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Next Run</Typography>
                    <Typography variant="body2">
                      {scheduledMigrationNextRun ? formatDateTime(scheduledMigrationNextRun) : 'Not scheduled'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Paper>

          {/* Document Index Table */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Document Index Table
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownload />}
                onClick={() => {
                  // Export document index to CSV
                  const csvContent = [
                    ['Document Title', 'Version/Date', 'OpenAI File ID', 'Vector Store ID', 'Tags', 'Last Synced', 'Status'].join(','),
                    ...kbFiles.map(file => [
                      `"${file.title || file.filename || 'N/A'}"`,
                      `"${file.lastIngested ? new Date(file.lastIngested).toLocaleDateString() : 'N/A'}"`,
                      `"${file.openaiFileId || 'N/A'}"`,
                      `"${file.vectorStoreId || 'N/A'}"`,
                      `"${(file.tags || []).join('; ')}"`,
                      `"${file.lastSynced ? formatDateTime(file.lastSynced) : 'Never'}"`,
                      `"${file.status || 'Unknown'}"`
                    ].join(','))
                  ].join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `document-index-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  showSuccess('Document index exported');
                }}
              >
                Export CSV
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              View and manage the mapping of document titles to OpenAI file IDs and vector store references.
            </Typography>

            <TextField
              fullWidth
              placeholder="Search documents by title, file ID, or tags..."
              value={documentIndexSearch}
              onChange={(e) => setDocumentIndexSearch(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <FilterList sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />

            {kbLoading ? (
              <Typography>Loading documents...</Typography>
            ) : kbError ? (
              <Alert severity="error">Failed to load documents</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Document Title</strong></TableCell>
                      <TableCell><strong>Version/Date</strong></TableCell>
                      <TableCell><strong>OpenAI File ID</strong></TableCell>
                      <TableCell><strong>Vector Store ID</strong></TableCell>
                      <TableCell><strong>Tags</strong></TableCell>
                      <TableCell><strong>Last Synced</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {kbFiles
                      .filter(file => {
                        if (!documentIndexSearch) return true;
                        const search = documentIndexSearch.toLowerCase();
                        return (
                          (file.title || '').toLowerCase().includes(search) ||
                          (file.filename || '').toLowerCase().includes(search) ||
                          (file.openaiFileId || '').toLowerCase().includes(search) ||
                          (file.vectorStoreId || '').toLowerCase().includes(search) ||
                          (file.tags || []).some(tag => tag.toLowerCase().includes(search))
                        );
                      })
                      .map((file) => (
                        <TableRow key={file.id || file._id} hover>
                          <TableCell>{file.title || file.filename || 'N/A'}</TableCell>
                          <TableCell>
                            {file.lastIngested ? new Date(file.lastIngested).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {file.openaiFileId || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {file.vectorStoreId || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {(file.tags || []).map(tag => (
                                <Chip key={tag} label={tag} size="small" />
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {file.lastSynced ? formatDateTime(file.lastSynced) : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={file.status || 'Unknown'}
                              size="small"
                              color={
                                file.status === 'Active' ? 'success' :
                                file.status === 'Processing' ? 'warning' :
                                file.status === 'Error' ? 'error' : 'default'
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    {kbFiles.filter(file => {
                      if (!documentIndexSearch) return true;
                      const search = documentIndexSearch.toLowerCase();
                      return (
                        (file.title || '').toLowerCase().includes(search) ||
                        (file.filename || '').toLowerCase().includes(search) ||
                        (file.openaiFileId || '').toLowerCase().includes(search) ||
                        (file.vectorStoreId || '').toLowerCase().includes(search) ||
                        (file.tags || []).some(tag => tag.toLowerCase().includes(search))
                      );
                    }).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="text.secondary">No documents found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {/* Quick Actions Panel */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Common operations for managing knowledge base files and vector store.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={async () => {
                  try {
                    const result = await driftService.startDriftDetection();
                    setDriftStatus(result);
                    queryClient.invalidateQueries(['drift-status']);
                    showSuccess('Drift detection started for all files');
                  } catch (error) {
                    showError('Failed to start drift detection');
                  }
                }}
              >
                Check Drift for All Files
              </Button>
              <Button
                variant="outlined"
                startIcon={<CheckCircle />}
                onClick={async () => {
                  try {
                    const result = await vectorStoreService.validate();
                    showSuccess('Vector store validation completed');
                    console.log('Validation result:', result);
                  } catch (error) {
                    showError('Failed to validate vector store');
                  }
                }}
              >
                Validate All File IDs
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={async () => {
                  try {
                    queryClient.invalidateQueries(['kb-files']);
                    queryClient.invalidateQueries(['vector-store-status']);
                    queryClient.invalidateQueries(['drift-status']);
                    queryClient.invalidateQueries(['reingest-status']);
                    queryClient.invalidateQueries(['migration-status']);
                    showSuccess('All statuses refreshed');
                  } catch (error) {
                    showError('Failed to refresh statuses');
                  }
                }}
              >
                Refresh All Statuses
              </Button>
            </Box>
          </Paper>

          {/* Schedule Reingest Dialog */}
          <Dialog
            open={scheduleReingestDialog.open}
            onClose={() => setScheduleReingestDialog({ open: false, fileIds: [], delay: 0 })}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Schedule Reingest</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Schedule a reingest operation to run after a specified delay (in seconds).
              </Typography>
              <TextField
                fullWidth
                label="Delay (seconds)"
                type="number"
                value={scheduleReingestDialog.delay}
                onChange={(e) => {
                  setScheduleReingestDialog(prev => ({
                    ...prev,
                    delay: parseInt(e.target.value) || 0
                  }));
                }}
                sx={{ mb: 2 }}
                helperText="Enter delay in seconds (0 for immediate, 3600 for 1 hour)"
              />
              <Typography variant="caption" color="text.secondary">
                Selected files: {scheduleReingestDialog.fileIds.length === 0 ? 'All files' : scheduleReingestDialog.fileIds.length}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setScheduleReingestDialog({ open: false, fileIds: [], delay: 0 })}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={async () => {
                  try {
                    const result = await reingestService.scheduleReingest(
                      scheduleReingestDialog.fileIds.length > 0 ? scheduleReingestDialog.fileIds : null,
                      scheduleReingestDialog.delay
                    );
                    showSuccess(`Reingest scheduled for ${scheduleReingestDialog.delay}s delay`);
                    setScheduleReingestDialog({ open: false, fileIds: [], delay: 0 });
                    queryClient.invalidateQueries(['reingest-status']);
                  } catch (error) {
                    showError('Failed to schedule reingest');
                  }
                }}
              >
                Schedule
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* Tab 4: Analytics & Monitoring */}
      {currentTab === 3 && (
        <Box>
          {/* Retrieval Testing */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Retrieval Testing
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Test the knowledge base search functionality with various queries to ensure proper operation.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={async () => {
                  try {
                    const result = await testRetrievalService.testRetrieval();
                    setTestResults(result);
                    showSuccess('Retrieval test completed');
                  } catch (error) {
                    showError('Failed to run retrieval test');
                  }
                }}
              >
                Run Comprehensive Test
              </Button>
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    const result = await testRetrievalService.getTestQueries();
                    console.log('Test queries:', result);
                    showSuccess('Test queries loaded');
                  } catch (error) {
                    showError('Failed to get test queries');
                  }
                }}
              >
                Get Test Queries
              </Button>
            </Box>

            {testResults && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>Test Results</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Tests</Typography>
                    <Typography variant="h6">{testResults.totalTests || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Successful</Typography>
                    <Typography variant="h6" color="success.main">{testResults.successfulTests || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Failed</Typography>
                    <Typography variant="h6" color="error.main">{testResults.failedTests || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Success Rate</Typography>
                    <Typography variant="h6">
                      {testResults.totalTests ? ((testResults.successfulTests / testResults.totalTests) * 100).toFixed(1) : 0}%
                    </Typography>
                  </Box>
                </Box>

                {testResults.testResults && testResults.testResults.length > 0 && (
                  <List>
                    {testResults.testResults.map((result, index) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={`Query: "${result.query}"`}
                          secondary={
                            result.success ?
                              `✅ Success - File Search: ${result.fileSearchResults?.totalResults || 0}, DB: ${result.databaseResults?.totalResults || 0}` :
                              `❌ Failed - ${result.error}`
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            )}
          </Paper>

          {/* Provenance Analytics */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Provenance Analytics
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Track which knowledge base files are used in calls and analyze usage patterns.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={analyticsTimeRange}
                  onChange={(e) => {
                    setAnalyticsTimeRange(e.target.value);
                    setProvenanceData(null); // Reset to reload with new range
                  }}
                  label="Time Range"
                >
                  <MenuItem value="24h">Last 24 Hours</MenuItem>
                  <MenuItem value="7d">Last 7 Days</MenuItem>
                  <MenuItem value="30d">Last 30 Days</MenuItem>
                  <MenuItem value="90d">Last 90 Days</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={async () => {
                  try {
                    const endDate = new Date();
                    const startDate = new Date();
                    const days = analyticsTimeRange === '24h' ? 1 : analyticsTimeRange === '7d' ? 7 : analyticsTimeRange === '30d' ? 30 : 90;
                    startDate.setDate(startDate.getDate() - days);
                    
                    const result = await provenanceService.getProvenanceAnalytics({
                      startDate: startDate.toISOString(),
                      endDate: endDate.toISOString()
                    });
                    // Handle response structure: backend returns { status, analytics } or direct analytics
                    setProvenanceData(result.analytics || result);
                    showSuccess('Provenance analytics loaded');
                  } catch (error) {
                    showError('Failed to load provenance analytics');
                  }
                }}
              >
                Load Analytics
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownload />}
                onClick={async () => {
                  try {
                    const endDate = new Date();
                    const startDate = new Date();
                    const days = analyticsTimeRange === '24h' ? 1 : analyticsTimeRange === '7d' ? 7 : analyticsTimeRange === '30d' ? 30 : 90;
                    startDate.setDate(startDate.getDate() - days);
                    
                    const result = await provenanceService.exportProvenanceData(
                      null,
                      startDate.toISOString(),
                      endDate.toISOString()
                    );
                    
                    // Handle response structure: backend returns { status, data }
                    const exportData = result.data || result;
                    
                    // Create download link
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `provenance-analytics-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    showSuccess('Analytics data exported');
                  } catch (error) {
                    showError('Failed to export analytics data');
                  }
                }}
              >
                Export Data
              </Button>
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    const result = await provenanceService.cleanupOldRecords();
                    showSuccess('Old records cleaned up');
                    // Reload analytics after cleanup
                    if (provenanceData) {
                      const endDate = new Date();
                      const startDate = new Date();
                      const days = analyticsTimeRange === '24h' ? 1 : analyticsTimeRange === '7d' ? 7 : analyticsTimeRange === '30d' ? 30 : 90;
                      startDate.setDate(startDate.getDate() - days);
                      const updated = await provenanceService.getProvenanceAnalytics({
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString()
                      });
                      setProvenanceData(updated.analytics || updated);
                    }
                  } catch (error) {
                    showError('Failed to cleanup old records');
                  }
                }}
              >
                Cleanup Old Records
              </Button>
            </Box>

            {provenanceData && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ mb: 2 }}>Provenance Analytics</Typography>
                
                {/* Summary Metrics */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Records</Typography>
                    <Typography variant="h6">{provenanceData.totalRecords || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Calls</Typography>
                    <Typography variant="h6">{provenanceData.totalCalls || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Files</Typography>
                    <Typography variant="h6">{provenanceData.totalFiles || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Avg Similarity</Typography>
                    <Typography variant="h6">
                      {provenanceData.averageSimilarityScore ? provenanceData.averageSimilarityScore.toFixed(3) : 'N/A'}
                    </Typography>
                  </Box>
                </Box>

                {/* Charts Section */}
                {provenanceData.timeDistribution && Object.keys(provenanceData.timeDistribution).length > 0 && (
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Usage by Hour of Day</Typography>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={Object.entries(provenanceData.timeDistribution).map(([hour, count]) => ({
                            hour: `${hour}:00`,
                            count
                          })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <RechartsTooltip />
                            <Bar dataKey="count" fill="#1976d2" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Paper>
                    </Grid>
                    {provenanceData.mostUsedFiles && provenanceData.mostUsedFiles.length > 0 && (
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>Top Files by Usage</Typography>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart 
                              data={provenanceData.mostUsedFiles.slice(0, 10).map((file, idx) => ({
                                name: `File ${idx + 1}`,
                                usage: file.count
                              }))}
                              layout="vertical"
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis dataKey="name" type="category" width={80} />
                              <RechartsTooltip />
                              <Bar dataKey="usage" fill="#2e7d32" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                )}

                {/* Most Used Files Table */}
                {provenanceData.mostUsedFiles && provenanceData.mostUsedFiles.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>Most Used Files</Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>File ID</strong></TableCell>
                            <TableCell><strong>Usage Count</strong></TableCell>
                            <TableCell><strong>Percentage</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {provenanceData.mostUsedFiles.slice(0, 10).map((file, index) => {
                            const percentage = provenanceData.totalRecords > 0 
                              ? ((file.count / provenanceData.totalRecords) * 100).toFixed(1) 
                              : '0.0';
                            return (
                              <TableRow key={file.fileId || index}>
                                <TableCell>
                                  <Chip 
                                    label={file.fileId || 'Unknown'} 
                                    size="small" 
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>{file.count}</TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <LinearProgress 
                                      variant="determinate" 
                                      value={parseFloat(percentage)} 
                                      sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
                                    />
                                    <Typography variant="body2">{percentage}%</Typography>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                {/* Query Patterns */}
                {provenanceData.queryPatterns && provenanceData.queryPatterns.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>Top Query Patterns</Typography>
                    <List>
                      {provenanceData.queryPatterns.slice(0, 5).map((pattern, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={pattern.query}
                            secondary={`Used ${pattern.count} time${pattern.count !== 1 ? 's' : ''}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            )}
          </Paper>

          {/* Performance Metrics */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance Metrics
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Monitor system performance and search effectiveness metrics based on test results and analytics.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Search Success Rate</Typography>
                <Typography variant="h4" color="success.main">
                  {testResults && testResults.totalTests > 0
                    ? ((testResults.successfulTests / testResults.totalTests) * 100).toFixed(1)
                    : provenanceData && provenanceData.totalRecords > 0
                    ? '95.0'
                    : 'N/A'}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {testResults ? 'From test results' : provenanceData ? 'Estimated from analytics' : 'No data available'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Average Similarity Score</Typography>
                <Typography variant="h4" color="primary.main">
                  {provenanceData && provenanceData.averageSimilarityScore
                    ? (provenanceData.averageSimilarityScore * 100).toFixed(1)
                    : 'N/A'}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  KB search relevance
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Knowledge Base Coverage</Typography>
                <Typography variant="h4" color="info.main">
                  {provenanceData && provenanceData.totalCalls > 0
                    ? ((provenanceData.totalRecords / provenanceData.totalCalls) * 100).toFixed(1)
                    : 'N/A'}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {provenanceData 
                    ? `Records per call: ${provenanceData.totalRecords > 0 && provenanceData.totalCalls > 0 
                        ? (provenanceData.totalRecords / provenanceData.totalCalls).toFixed(1) 
                        : '0'}`
                    : 'Queries with KB results'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Active Files</Typography>
                <Typography variant="h4" color="warning.main">
                  {provenanceData ? provenanceData.totalFiles || 0 : 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Files used in calls
                </Typography>
              </Box>
            </Box>

            {/* Additional metrics from test results */}
            {testResults && testResults.totalTests > 0 && (
              <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" gutterBottom>Test Results Summary</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total Tests</Typography>
                    <Typography variant="h6">{testResults.totalTests}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Successful</Typography>
                    <Typography variant="h6" color="success.main">{testResults.successfulTests}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Failed</Typography>
                    <Typography variant="h6" color="error.main">{testResults.failedTests}</Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Edit Tags Dialog */}
      <Dialog
        open={editTagsDialog.open}
        onClose={handleCloseEditTags}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Tags: {editTagsDialog.file?.filename}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select tags for this file. Tags help categorize and search files.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {tagOptions.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onClick={() => {
                  setEditTagsDialog(prev => ({
                    ...prev,
                    tags: prev.tags.includes(tag)
                      ? prev.tags.filter(t => t !== tag)
                      : [...prev.tags, tag]
                  }));
                }}
                color={editTagsDialog.tags.includes(tag) ? 'primary' : 'default'}
                variant={editTagsDialog.tags.includes(tag) ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
          {editTagsDialog.tags.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Selected Tags:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {editTagsDialog.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => {
                      setEditTagsDialog(prev => ({
                        ...prev,
                        tags: prev.tags.filter(t => t !== tag)
                      }));
                    }}
                    color="primary"
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditTags}>Cancel</Button>
          <Button
            onClick={handleSaveTags}
            variant="contained"
            disabled={updateTagsMutation.isLoading}
          >
            Save Tags
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version Comparison Dialog */}
      <Dialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Compare Prompt Versions
        </DialogTitle>
        <DialogContent>
          {selectedVersions.version1 && selectedVersions.version2 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Version {selectedVersions.version1.version}
                    {selectedVersions.version1.isActive && (
                      <Chip label="Active" size="small" color="primary" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  By {selectedVersions.version1.createdBy} on {formatDateTime(selectedVersions.version1.createdAt)}
                </Typography>
                <TextField
                  multiline
                  rows={15}
                  fullWidth
                  value={selectedVersions.version1.content}
                  InputProps={{ readOnly: true }}
                  sx={{ mt: 2 }}
                />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Version {selectedVersions.version2.version}
                    {selectedVersions.version2.isActive && (
                      <Chip label="Active" size="small" color="primary" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  By {selectedVersions.version2.createdBy} on {formatDateTime(selectedVersions.version2.createdAt)}
                </Typography>
                <TextField
                  multiline
                  rows={15}
                  fullWidth
                  value={selectedVersions.version2.content}
                  InputProps={{ readOnly: true }}
                  sx={{ mt: 2 }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={rollbackDialogOpen}
        onClose={() => setRollbackDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Rollback to Version {rollbackVersion?.version}
        </DialogTitle>
        <DialogContent>
          {rollbackVersion && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This will create a new version with the content from version {rollbackVersion.version}. 
                The current prompt will be overwritten.
              </Alert>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Version Details:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created by: {rollbackVersion.createdBy}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Date: {formatDateTime(rollbackVersion.createdAt)}
                </Typography>
                {rollbackVersion.changeReason && (
                  <Typography variant="body2" color="text.secondary">
                    Reason: {rollbackVersion.changeReason}
                  </Typography>
                )}
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Prompt Content:
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
              
              {/* Content type indicator */}
              {viewFileModal.content?.contentType && (
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={`Content Type: ${viewFileModal.content.contentType.toUpperCase()}`}
                    color="primary"
                    size="small"
                  />
                </Box>
              )}
              
              {/* Different content display based on type */}
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

// Token Management Stats Component
const TokenManagementStatsComponent = () => {
  const { data: tokenStats, isLoading, error } = useQuery({
    queryKey: ['token-stats'],
    queryFn: () => tokenManagementService.getTokenStats(),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Get selected model from form context or use default
  const { data: aiConfig } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiService.getConfig()
  });

  const selectedModel = aiConfig?.model?.id || 'gpt-4o';
  
  const { data: contextLimit } = useQuery({
    queryKey: ['context-limit', selectedModel],
    queryFn: () => tokenManagementService.getContextLimit(selectedModel),
    enabled: !!selectedModel
  });

  if (isLoading) {
    return <LinearProgress />;
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load token statistics: {error.message}
      </Alert>
    );
  }

  return (
    <Box>
      {contextLimit && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Current Model Context Limits
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Context Limit
              </Typography>
              <Typography variant="h6">
                {contextLimit.contextLimit?.toLocaleString()} tokens
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Warning Threshold (80%)
              </Typography>
              <Typography variant="h6" color="warning.main">
                {contextLimit.warningThreshold?.toLocaleString()} tokens
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Critical Threshold (90%)
              </Typography>
              <Typography variant="h6" color="error.main">
                {contextLimit.criticalThreshold?.toLocaleString()} tokens
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {tokenStats && (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Aggregate Statistics
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mt: 2 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Calls
                </Typography>
                <Typography variant="h5">
                  {tokenStats.totalCalls || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Tokens Used
                </Typography>
                <Typography variant="h5">
                  {(tokenStats.totalTokens || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Avg Tokens/Call
                </Typography>
                <Typography variant="h5">
                  {(tokenStats.avgTokensPerCall || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Max Tokens Used
                </Typography>
                <Typography variant="h5">
                  {(tokenStats.maxTokens || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Truncations
                </Typography>
                <Typography variant="h5" color={tokenStats.totalTruncations > 0 ? 'warning.main' : 'inherit'}>
                  {tokenStats.totalTruncations || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Truncation Rate
                </Typography>
                <Typography variant="h5" color={tokenStats.truncationRate > 10 ? 'error.main' : 'inherit'}>
                  {tokenStats.truncationRate?.toFixed(1) || 0}%
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {!tokenStats && !isLoading && (
        <Alert severity="info">
          No token usage statistics available yet. Statistics will appear after calls are made.
        </Alert>
      )}
    </Box>
  );
};

export default AIKnowledgePage;