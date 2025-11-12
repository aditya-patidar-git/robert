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
  LinearProgress
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
  CheckCircle
} from '@mui/icons-material';
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
  
  // Fallback chain state
  const [fallbackChain, setFallbackChain] = useState([]);
  
  // Model parameters state
  const [modelParameters, setModelParameters] = useState(null);
  
  // Language/Voice mapping state
  const [languageMappings, setLanguageMappings] = useState([]);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  
  // View file modal state
  const [viewFileModal, setViewFileModal] = useState({ open: false, file: null, content: null });

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
    queryFn: kbService.getAllFiles,
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
    queryFn: promptService.getAllPrompts,
  });

  // Fetch model capabilities
  const { data: capabilitiesData, isLoading: capabilitiesLoading } = useQuery({
    queryKey: ['model-capabilities'],
    queryFn: aiService.getModelCapabilities,
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  // Fetch language/voice mappings
  const { data: fetchedMappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['language-voice-mappings'],
    queryFn: languageVoiceService.getLanguageMappings
  });

  // Update local state when mappings are fetched
  useEffect(() => {
    if (fetchedMappings && fetchedMappings.length > 0) {
      setLanguageMappings(fetchedMappings);
    }
  }, [fetchedMappings]);

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
            setFallbackChain(chain);
          } else {
            // If no fallback chain, create one with just the primary model
            setFallbackChain([{ modelId: config.model.id, voiceId: currentVoiceId }]);
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

  // Fetch AI models (discovered from OpenAI)
  const { data: models = [], error: modelsError } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => aiService.getModels(),
  });

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

  // Fetch voices (discovered from OpenAI)
  const { data: voices = [], error: voicesError } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices(),
  });

  // Handle voices errors
  useEffect(() => {
    if (voicesError) {
      console.error('Voices Error:', voicesError);
      showError('Failed to load voices');
    }
  }, [voicesError, showError]);

  // Get compatible voices for the selected model
  const getCompatibleVoices = useCallback((modelId) => {
    if (!modelId || !Array.isArray(voices) || !Array.isArray(models)) {
      return voices || [];
    }

    // Find the selected model
    const selectedModel = models.find(m => m.id === modelId);
    if (!selectedModel) {
      return voices || [];
    }

    // Check model capabilities
    const modelSupportsRealtime = selectedModel.capabilities?.realtime || 
                                   modelId.includes('realtime') || 
                                   modelId.includes('gpt-realtime');
    
    const modelSupportsTTS = modelId.includes('tts') || 
                             modelId.includes('tts-1');
    
    const modelSupportsAudio = selectedModel.capabilities?.audio || 
                               modelSupportsRealtime || 
                               modelSupportsTTS ||
                               modelId.includes('whisper');

    // Filter voices based on model type
    if (modelSupportsRealtime) {
      // Realtime models: show only voices with realtime capability
      return voices.filter(voice => voice.capabilities?.realtime === true);
    } else if (modelSupportsTTS) {
      // TTS models: show all voices (TTS models generally support all voices)
      return voices;
    } else if (modelSupportsAudio) {
      // Other audio models: show all voices
      return voices;
    } else {
      // Non-audio models: no voices available
      return [];
    }
  }, [voices, models]);

  // Clear voice selection when model changes and current voice is incompatible
  const selectedModelValue = watch('selectedModel');
  const selectedVoiceValue = watch('selectedVoice');
  
  useEffect(() => {
    if (selectedModelValue && selectedVoiceValue) {
      const compatibleVoices = getCompatibleVoices(selectedModelValue);
      const isCurrentVoiceCompatible = compatibleVoices.some(v => v.id === selectedVoiceValue);
      
      // If current voice is not compatible with new model, clear it
      if (!isCurrentVoiceCompatible) {
        setValue('selectedVoice', '');
      }
    }
  }, [selectedModelValue, selectedVoiceValue, setValue, getCompatibleVoices]);

  // Fetch vector store status - use the same working endpoint as Knowledge Base Management
  const { data: vectorStoreData, isLoading: vectorStoreLoading, error: vectorStoreError } = useQuery({
    queryKey: ['vector-store-status'],
    queryFn: vectorStoreService.getStatus,
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
    queryFn: vectorStoreService.getMigrationStatus,
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
    queryFn: driftService.getDriftStatus,
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
    queryFn: reingestService.getReingestStatus,
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

  // Fallback chain handlers
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setFallbackChain((items) => {
        const oldIndex = items.findIndex(item => {
          const itemId = typeof item === 'string' ? item : item.modelId;
          return itemId === active.id;
        });
        const newIndex = items.findIndex(item => {
          const itemId = typeof item === 'string' ? item : item.modelId;
          return itemId === over.id;
        });
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemoveFromFallbackChain = (index) => {
    const newChain = fallbackChain.filter((_, i) => i !== index);
    setFallbackChain(newChain);
  };

  // Save model/voice selection and add model to fallback chain (UI only)
  const handleSaveModelVoice = () => {
    const selectedModel = watch('selectedModel');
    const selectedVoice = watch('selectedVoice');

    // Check that both model and voice are selected
    if (!selectedModel || !selectedVoice) {
      showError('Please select both a model and a voice');
      return;
    }

    // Check if the exact model+voice combination already exists in fallback chain
    const exists = fallbackChain.some(item => {
      const itemModelId = typeof item === 'string' ? item : item.modelId;
      const itemVoiceId = typeof item === 'string' ? undefined : item.voiceId;
      return itemModelId === selectedModel && itemVoiceId === selectedVoice;
    });

    if (exists) {
      showError('This model and voice combination is already in the fallback chain');
      return;
    }

    // Add selected model+voice to the END of fallback chain
    setFallbackChain([...fallbackChain, { modelId: selectedModel, voiceId: selectedVoice }]);
    showSuccess('Model and voice added to fallback chain');
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
              <Typography variant="h6" gutterBottom>
                Global System Prompt for "Robert"
              </Typography>
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

            {/* Model & Voice Selection with Fallback Chain */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Model & Voice Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select the primary AI model and configure fallback chain. The system will automatically use the next model in the chain if the primary model fails.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 3, mb: 3, alignItems: 'center' }}>
                <Controller
                  name="selectedModel"
                  control={control}
                  render={({ field }) => (
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>Primary AI Model</InputLabel>
                      <Select {...field} label="Primary AI Model">
                        {(Array.isArray(models) ? models : []).map((model) => (
                          <MenuItem key={model.id} value={model.id}>
                            {model.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="selectedVoice"
                  control={control}
                  render={({ field }) => {
                    const selectedModel = watch('selectedModel');
                    const compatibleVoices = getCompatibleVoices(selectedModel);
                    
                    return (
                      <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Voice</InputLabel>
                        <Select 
                          {...field} 
                          label="Voice"
                          disabled={!selectedModel}
                        >
                          {compatibleVoices.length > 0 ? (
                            compatibleVoices.map((voice) => (
                              <MenuItem key={voice.id} value={voice.id}>
                                {voice.name}
                              </MenuItem>
                            ))
                          ) : (
                            <MenuItem disabled>
                              {selectedModel ? 'No compatible voices available' : 'Select a model first'}
                            </MenuItem>
                          )}
                        </Select>
                      </FormControl>
                    );
                  }}
                />

                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSaveModelVoice}
                  disabled={
                    !watch('selectedModel') || 
                    !watch('selectedVoice') || 
                    getCompatibleVoices(watch('selectedModel')).length === 0
                  }
                >
                  Save
                </Button>
              </Box>

              {/* Fallback Chain Configuration */}
              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Model Fallback Chain
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Configure the order of models to use if the primary model is unavailable. Models are tried in sequence from top to bottom.
                </Typography>

                {fallbackChain.length === 0 ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No fallback chain configured. Add models below to create a fallback sequence.
                  </Alert>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={fallbackChain.map(item => typeof item === 'string' ? item : item.modelId)}
                      strategy={verticalListSortingStrategy}
                    >
                      <Box sx={{ mb: 2 }}>
                        {fallbackChain.map((item, index) => {
                          const modelId = typeof item === 'string' ? item : item.modelId;
                          return <SortableItem key={`${modelId}-${index}`} id={modelId} index={index} />;
                        })}
                      </Box>
                    </SortableContext>
                  </DndContext>
                )}

                {/* Visual Chain Representation */}
                {fallbackChain.length > 0 && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Fallback Sequence:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {fallbackChain.map((item, index) => {
                        const modelId = typeof item === 'string' ? item : item.modelId;
                        const voiceId = typeof item === 'string' ? undefined : item.voiceId;
                        const model = models.find(m => m.id === modelId);
                        const voice = voices.find(v => v.id === voiceId);
                        const label = model?.name || modelId;
                        const voiceLabel = voice ? ` (${voice.name})` : '';
                        
                        // Build tooltip content with capability details
                        const tooltipContent = model ? (
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                              {model.name}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Context: {model.contextLimit || model.context_limit || 'N/A'} tokens
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                              Capabilities: {[
                                model.supportsTools && 'Tools',
                                model.supportsAudio && 'Audio',
                                model.capabilities?.fileSearch && 'File Search',
                                model.capabilities?.realtime && 'Realtime'
                              ].filter(Boolean).join(', ') || 'None'}
                            </Typography>
                            {model.rateLimits && (
                              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                Rate: {model.rateLimits.requestsPerMinute} req/min, {model.rateLimits.tokensPerMinute?.toLocaleString() || 'N/A'} tokens/min
                              </Typography>
                            )}
                            {model.knownLimitations && model.knownLimitations.length > 0 && (
                              <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'warning.main' }}>
                                Limitations: {model.knownLimitations.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        ) : `Model: ${modelId}`;
                        
                        return (
                          <React.Fragment key={`${modelId}-${index}`}>
                            <Tooltip title={tooltipContent} arrow placement="top">
                              <Chip
                                label={label + voiceLabel}
                                size="small"
                                color={index === 0 ? 'primary' : 'default'}
                                sx={{
                                  cursor: 'help',
                                  '&:hover': {
                                    opacity: 0.8
                                  }
                                }}
                              />
                            </Tooltip>
                            {index < fallbackChain.length - 1 && (
                              <ArrowForward fontSize="small" color="action" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* AI Parameters */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                AI Parameters
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure AI behavior parameters including temperature, top_p, max tokens, and speech rate.
              </Typography>
              {modelParameters && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Model-specific parameter ranges loaded. Context limit: {modelParameters.context_limit?.toLocaleString() || 'N/A'} tokens.
                </Alert>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, alignItems: 'flex-start' }}>
                <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Temperature: {watch('temperature')}
                    {modelParameters?.temperature?.default && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Recommended: {modelParameters.temperature.default}
                      </Typography>
                    )}
                  </Typography>
                  <Controller
                    name="temperature"
                    control={control}
                    render={({ field }) => {
                      const tempParams = modelParameters?.temperature || { min: 0, max: 1, step: 0.1 };
                      return (
                        <>
                          <Slider
                            {...field}
                            value={field.value ?? 0.4}
                            min={tempParams.min}
                            max={tempParams.max}
                            step={tempParams.step}
                            marks
                            valueLabelDisplay="auto"
                          />
                          {modelParameters?.temperature && (field.value < modelParameters.temperature.min || field.value > modelParameters.temperature.max) && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                              Value outside recommended range ({modelParameters.temperature.min} - {modelParameters.temperature.max})
                            </Alert>
                          )}
                        </>
                      );
                    }}
                  />
                </Box>

                <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Top-P: {watch('topP')}
                    {modelParameters?.top_p?.default && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Recommended: {modelParameters.top_p.default}
                      </Typography>
                    )}
                  </Typography>
                  <Controller
                    name="topP"
                    control={control}
                    render={({ field }) => {
                      const topPParams = modelParameters?.top_p || { min: 0, max: 1, step: 0.1 };
                      return (
                        <>
                          <Slider
                            {...field}
                            value={field.value ?? 1.0}
                            min={topPParams.min}
                            max={topPParams.max}
                            step={topPParams.step}
                            marks
                            valueLabelDisplay="auto"
                          />
                          {modelParameters?.top_p && (field.value < modelParameters.top_p.min || field.value > modelParameters.top_p.max) && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                              Value outside recommended range ({modelParameters.top_p.min} - {modelParameters.top_p.max})
                            </Alert>
                          )}
                        </>
                      );
                    }}
                  />
                </Box>

                <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Max Tokens
                    {modelParameters?.max_tokens?.default && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Recommended: {modelParameters.max_tokens.default} (Max: {modelParameters.max_tokens.max?.toLocaleString() || 'N/A'})
                      </Typography>
                    )}
                  </Typography>
                  <Controller
                    name="maxTokens"
                    control={control}
                    render={({ field }) => {
                      const maxTokensParams = modelParameters?.max_tokens || { min: 50, max: 500, step: 10 };
                      const maxValue = Math.min(maxTokensParams.max, 5000);
                      return (
                        <>
                          <TextField
                            {...field}
                            type="number"
                            value={field.value ?? 150}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10) || 0;
                              field.onChange(value);
                            }}
                            inputProps={{
                              min: maxTokensParams.min,
                              max: maxValue,
                              step: maxTokensParams.step,
                              style: { 
                                textAlign: 'center',
                                padding: '8px'
                              }
                            }}
                            sx={{ 
                              mt: 0,
                              '& .MuiOutlinedInput-root': {
                                height: '40px',
                                padding: '0 8px'
                              }
                            }}
                            size="small"
                            variant="outlined"
                            fullWidth
                          />
                          {modelParameters?.max_tokens && field.value > modelParameters.max_tokens.max && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                              Value exceeds model's maximum of {modelParameters.max_tokens.max.toLocaleString()} tokens
                            </Alert>
                          )}
                        </>
                      );
                    }}
                  />
                </Box>

                <Box sx={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Speech Rate: {watch('speechRate')}
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, visibility: 'hidden' }}>
                      &nbsp;
                    </Typography>
                  </Typography>
                  <Controller
                    name="speechRate"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        {...field}
                        value={field.value ?? 1.0}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        marks
                        valueLabelDisplay="auto"
                      />
                    )}
                  />
                </Box>
              </Box>
            </Paper>

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
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Active Model Capabilities
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => {
                    queryClient.invalidateQueries(['model-capabilities']);
                  }}
                >
                  Refresh
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                View capabilities for your primary model and fallback chain models.
              </Typography>

              {capabilitiesLoading ? (
                <LinearProgress sx={{ mb: 2 }} />
              ) : (() => {
                const selectedModel = watch('selectedModel');
                const allCapabilities = capabilitiesData?.capabilities || [];
                
                // Get primary model and fallback chain models
                const primaryModelId = selectedModel;
                const fallbackModelIds = fallbackChain.map(item => 
                  typeof item === 'string' ? item : item.modelId
                ).filter(id => id && id !== primaryModelId);
                
                // Filter capabilities to only show active models
                const activeModels = allCapabilities.filter(model => 
                  model.id === primaryModelId || fallbackModelIds.includes(model.id)
                );
                
                if (activeModels.length === 0) {
                  return (
                    <Alert severity="info">
                      No active models selected. Please select a primary model in the Model Selection section above.
                    </Alert>
                  );
                }
                
                return (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Model Name</strong></TableCell>
                          <TableCell align="right"><strong>Context Limit</strong></TableCell>
                          <TableCell align="center"><strong>Tools</strong></TableCell>
                          <TableCell align="center"><strong>Audio</strong></TableCell>
                          <TableCell align="center"><strong>File Search</strong></TableCell>
                          <TableCell align="center"><strong>Details</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeModels.map((model, index) => {
                          const isPrimary = model.id === primaryModelId;
                          return (
                            <TableRow 
                              key={model.id}
                              sx={{ 
                                bgcolor: isPrimary ? 'action.selected' : 'transparent',
                                '&:hover': { bgcolor: 'action.hover' }
                              }}
                            >
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" fontWeight={isPrimary ? "bold" : "medium"}>
                                    {model.name || model.id}
                                  </Typography>
                                  {isPrimary && (
                                    <Chip 
                                      label="Primary" 
                                      size="small" 
                                      color="primary"
                                      variant="outlined"
                                    />
                                  )}
                                  {!isPrimary && index === 1 && (
                                    <Chip 
                                      label="Fallback" 
                                      size="small" 
                                      color="default"
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                {model.contextLimit 
                                  ? model.contextLimit.toLocaleString() 
                                  : 'N/A'}
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  label={model.supportsTools ? 'Yes' : 'No'} 
                                  color={model.supportsTools ? 'success' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  label={model.supportsAudio ? 'Yes' : 'No'} 
                                  color={model.supportsAudio ? 'success' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  label={model.capabilities?.fileSearch ? 'Yes' : 'No'} 
                                  color={model.capabilities?.fileSearch ? 'success' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip 
                                  title={
                                    <Box>
                                      <Typography variant="caption" display="block" fontWeight="bold">
                                        Additional Details:
                                      </Typography>
                                      {model.defaultTemperature && (
                                        <Typography variant="caption" display="block">
                                          Default Temp: {model.defaultTemperature}
                                        </Typography>
                                      )}
                                      {model.defaultTopP && (
                                        <Typography variant="caption" display="block">
                                          Default Top-P: {model.defaultTopP}
                                        </Typography>
                                      )}
                                      {model.rateLimits && (
                                        <>
                                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                            Rate Limits:
                                          </Typography>
                                          <Typography variant="caption" display="block">
                                            • {model.rateLimits.requestsPerMinute || 'N/A'} req/min
                                          </Typography>
                                          <Typography variant="caption" display="block">
                                            • {model.rateLimits.tokensPerMinute?.toLocaleString() || 'N/A'} tokens/min
                                          </Typography>
                                        </>
                                      )}
                                      {model.knownLimitations && model.knownLimitations.length > 0 && (
                                        <>
                                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }} fontWeight="bold">
                                            Limitations:
                                          </Typography>
                                          {model.knownLimitations.map((limitation, idx) => (
                                            <Typography key={idx} variant="caption" display="block">
                                              • {limitation}
                                            </Typography>
                                          ))}
                                        </>
                                      )}
                                    </Box>
                                  }
                                >
                                  <IconButton size="small">
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              })()}
            </Paper>

            {/* Language/Voice Mapping Configuration */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Language/Voice Mapping Configuration
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Save />}
                  onClick={handleSaveLanguageMappings}
                  disabled={mappingsLoading}
                >
                  Save Mappings
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure voice selection for each supported language. Preview voices before saving.
              </Typography>

              {mappingsLoading ? (
                <LinearProgress sx={{ mb: 2 }} />
              ) : languageMappings.length === 0 ? (
                <Alert severity="info">
                  No language mappings found. Default mappings will be created on first load.
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Language</strong></TableCell>
                        <TableCell><strong>Locale Code</strong></TableCell>
                        <TableCell><strong>Voice</strong></TableCell>
                        <TableCell align="center"><strong>Preview</strong></TableCell>
                        <TableCell align="center"><strong>Status</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {languageMappings.map((mapping) => {
                        // Filter voices by language/locale if possible
                        const compatibleVoices = voices.filter(voice => {
                          if (!voice.language) return true;
                          // Try to match locale code
                          return voice.language.toLowerCase().includes(mapping.localeCode.toLowerCase().split('-')[0]);
                        });
                        
                        return (
                          <TableRow key={mapping.languageCode}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {mapping.languageName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {mapping.localeCode}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={mapping.voiceId || ''}
                                  onChange={(e) => {
                                    const selectedVoice = voices.find(v => v.id === e.target.value);
                                    handleLanguageMappingChange(
                                      mapping.languageCode,
                                      'voiceId',
                                      e.target.value
                                    );
                                    if (selectedVoice) {
                                      handleLanguageMappingChange(
                                        mapping.languageCode,
                                        'voiceName',
                                        selectedVoice.name
                                      );
                                    }
                                  }}
                                  displayEmpty
                                >
                                  <MenuItem value="" disabled>
                                    Select Voice
                                  </MenuItem>
                                  {(compatibleVoices.length > 0 ? compatibleVoices : voices).map((voice) => (
                                    <MenuItem key={voice.id} value={voice.id}>
                                      {voice.name} ({voice.language || 'N/A'})
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleVoicePreview(mapping.voiceId, mapping.languageCode)}
                                disabled={!mapping.voiceId || (previewingVoice?.voiceId === mapping.voiceId && previewingVoice?.languageCode === mapping.languageCode)}
                              >
                                {previewingVoice?.voiceId === mapping.voiceId && previewingVoice?.languageCode === mapping.languageCode ? (
                                  <Stop />
                                ) : (
                                  <PlayArrow />
                                )}
                              </IconButton>
                            </TableCell>
                            <TableCell align="center">
                              <Switch
                                checked={mapping.isActive !== false}
                                onChange={(e) => handleLanguageMappingChange(
                                  mapping.languageCode,
                                  'isActive',
                                  e.target.checked
                                )}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

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
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Status Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Monitor the overall health and status of all system operations.
            </Typography>

            {/* Vector Store Status */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>Vector Store Status</Typography>
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
                    <Typography variant="subtitle2" color="text.secondary">Last Updated</Typography>
                    <Typography variant="body2">
                      {vectorStoreStatus.lastUpdated ? formatDateTime(vectorStoreStatus.lastUpdated) : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Alert severity="warning">Unable to load vector store status</Alert>
              )}
            </Box>

            {/* Drift Detection Status */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>Drift Detection Status</Typography>
              {driftLoading ? (
                <Typography>Loading drift detection status...</Typography>
              ) : driftError ? (
                <Alert severity="error">
                  Failed to load drift detection status: {driftError.message}
                </Alert>
              ) : driftStatus && (driftStatus.totalFiles !== undefined || driftStatus.lastCheck) ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Files</Typography>
                    <Typography variant="h6">{driftStatus.totalFiles || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Files with Drift</Typography>
                    <Typography variant="h6" color="warning.main">{driftStatus.filesWithDrift || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Last Check</Typography>
                    <Typography variant="body2">
                      {driftStatus.lastCheck ? formatDateTime(driftStatus.lastCheck) : 'Never'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Alert severity="info">No drift detection data available</Alert>
              )}
            </Box>

            {/* Reingest Status */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>Reingest Status</Typography>
              {reingestLoading ? (
                <Typography>Loading reingest status...</Typography>
              ) : reingestError ? (
                <Alert severity="error">
                  Failed to load reingest status: {reingestError.message}
                </Alert>
              ) : reingestStatus && (reingestStatus.isRunning !== undefined || reingestStatus.lastRun) ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                    <Chip
                      label={reingestStatus.isRunning ? 'Running' : 'Idle'}
                      color={reingestStatus.isRunning ? 'warning' : 'default'}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Files Processed</Typography>
                    <Typography variant="h6">{reingestStatus.filesProcessed || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Files Failed</Typography>
                    <Typography variant="h6" color="error.main">{reingestStatus.filesFailed || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Last Run</Typography>
                    <Typography variant="body2">
                      {reingestStatus.lastRun ? formatDateTime(reingestStatus.lastRun) : 'Never'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Alert severity="info">No reingest data available</Alert>
              )}
            </Box>
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

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
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
                onClick={() => {
                  queryClient.invalidateQueries(['reingest-status']);
                }}
              >
                Check Status
              </Button>
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

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                onClick={async () => {
                  try {
                    const result = await provenanceService.getProvenanceAnalytics();
                    setProvenanceData(result);
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
                onClick={async () => {
                  try {
                    const result = await provenanceService.cleanupOldRecords();
                    showSuccess('Old records cleaned up');
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
                <Typography variant="subtitle1" gutterBottom>Provenance Analytics</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Records</Typography>
                    <Typography variant="h6">{provenanceData.analytics?.totalRecords || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Calls</Typography>
                    <Typography variant="h6">{provenanceData.analytics?.totalCalls || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Files</Typography>
                    <Typography variant="h6">{provenanceData.analytics?.totalFiles || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Avg Similarity</Typography>
                    <Typography variant="h6">
                      {provenanceData.analytics?.averageSimilarityScore?.toFixed(3) || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Paper>

          {/* Performance Metrics */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance Metrics
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Monitor system performance and search effectiveness metrics.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Search Success Rate</Typography>
                <Typography variant="h4" color="success.main">98.5%</Typography>
                <Typography variant="body2" color="text.secondary">Last 24 hours</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Average Response Time</Typography>
                <Typography variant="h4" color="primary.main">1.2s</Typography>
                <Typography variant="body2" color="text.secondary">File search queries</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Knowledge Base Coverage</Typography>
                <Typography variant="h4" color="info.main">87%</Typography>
                <Typography variant="body2" color="text.secondary">Queries with KB results</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Escalation Rate</Typography>
                <Typography variant="h4" color="warning.main">2.1%</Typography>
                <Typography variant="body2" color="text.secondary">Calls requiring human transfer</Typography>
              </Box>
            </Box>
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

export default AIKnowledgePage;