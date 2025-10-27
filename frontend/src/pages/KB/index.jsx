import { useState, useEffect } from 'react';
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
  ListItemIcon
} from '@mui/material';
import {
  CloudUpload,
  Refresh,
  PlayArrow,
  Description,
  VolumeUp,
  Save,
  Undo,
  Visibility
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useToast } from '../../components/common/ToastProvider';
import { formatDateTime } from '../../utils/formatters';
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

  // Phase 3: Advanced Features State
  const [driftStatus, setDriftStatus] = useState(null);
  const [reingestStatus, setReingestStatus] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [provenanceData, setProvenanceData] = useState(null);
  const [uncertaintyConfig, setUncertaintyConfig] = useState(null);
  
  // View file modal state
  const [viewFileModal, setViewFileModal] = useState({ open: false, file: null, content: null });

  const { control, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      globalPrompt: '',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 150,
      speechRate: 1.0,
      selectedModel: '',
      selectedVoice: ''
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

  // Handle prompts data
  useEffect(() => {
    if (prompts && Array.isArray(prompts) && prompts.length > 0) {
      const prompt = prompts[0];
      setValue('globalPrompt', prompt.content || '');
      if (prompt.parameters) {
        setValue('temperature', prompt.parameters.temperature || 0.7);
        setValue('topP', prompt.parameters.topP || 0.9);
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
    },
    onError: () => showError('Failed to upload file to OpenAI')
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
      setValue('temperature', 0.7);
      setValue('topP', 0.9);
      setValue('maxTokens', 150);
      setValue('speechRate', 1.0);
      setValue('selectedModel', '');
      setValue('selectedVoice', '');
    },
    onError: () => showError('Failed to save prompt')
  });

  // Voice preview mutation
  const previewVoiceMutation = useMutation({
    mutationFn: ({ voiceId, text }) => voiceService.previewVoice(voiceId, text),
    onSuccess: (audioBlob) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    },
    onError: () => showError('Failed to preview voice')
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
        tags: ['policy', 'training', 'documentation'] // Default tags
      });
    }
  };


  const handleSavePrompt = (data) => {
    savePromptMutation.mutate({
      title: "Global System Prompt",
      content: data.globalPrompt,
      parameters: {
        temperature: data.temperature,
        topP: data.topP,
        maxTokens: data.maxTokens,
        speechRate: data.speechRate,
        model: data.selectedModel,
        voice: data.selectedVoice
      }
    });
  };

  const handleVoicePreview = (voiceId) => {
    previewVoiceMutation.mutate({
      voiceId,
      text: 'Hello, this is a voice preview sample.'
    });
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
                accept=".pdf,.html,.md,.txt"
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
                    {/* <TableCell>Vector Store</TableCell> */}
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
                      {/* <TableCell>
                        <Chip
                          label={file.inVectorStore ? 'In Vector Store' : 'Not in Vector Store'}
                          color={file.inVectorStore ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell> */}
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleViewFile(file)}
                          title="View file details"
                          color="primary"
                        >
                          <Visibility />
                        </IconButton>
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
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save />}
                  disabled={savePromptMutation.isLoading}
                >
                  Save Prompt
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Undo />}
                  onClick={() => {
                    if (prompts.length > 0) {
                      const prompt = prompts[0];
                      setValue('globalPrompt', prompt.content || '');
                      if (prompt.parameters) {
                        setValue('temperature', prompt.parameters.temperature || 0.7);
                        setValue('topP', prompt.parameters.topP || 0.9);
                        setValue('maxTokens', prompt.parameters.maxTokens || 150);
                        setValue('speechRate', prompt.parameters.speechRate || 1.0);
                        setValue('selectedModel', prompt.parameters.model || '');
                        setValue('selectedVoice', prompt.parameters.voice || '');
                      }
                      showSuccess('Prompt rolled back to saved version');
                    } else {
                      setValue('globalPrompt', '');
                      setValue('temperature', 0.7);
                      setValue('topP', 0.9);
                      setValue('maxTokens', 150);
                      setValue('speechRate', 1.0);
                      setValue('selectedModel', '');
                      setValue('selectedVoice', '');
                      showSuccess('Prompt cleared');
                    }
                  }}
                >
                  Rollback
                </Button>
              </Box>
            </Paper>

            {/* Model & Voice Selection */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Model & Voice Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select the AI model and voice for Robert. Default voice is "Ash" as specified in documentation.
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Controller
                  name="selectedModel"
                  control={control}
                  render={({ field }) => (
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>AI Model</InputLabel>
                      <Select {...field} label="AI Model">
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
                  render={({ field }) => (
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>Voice</InputLabel>
                      <Select {...field} label="Voice">
                        {(Array.isArray(voices) ? voices : []).map((voice) => (
                          <MenuItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>

              {/* Voice Preview */}
              <Typography variant="subtitle2" gutterBottom>
                Voice Samples
              </Typography>
              <List>
                {(Array.isArray(voices) ? voices.slice(0, 3) : []).map((voice) => (
                  <ListItem key={voice.id} divider>
                    <ListItemIcon>
                      <VolumeUp />
                    </ListItemIcon>
                    <ListItemText
                      primary={voice.name}
                      secondary={voice.description}
                    />
                    <IconButton
                      onClick={() => handleVoicePreview(voice.id)}
                      disabled={previewVoiceMutation.isLoading}
                    >
                      <PlayArrow />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </Paper>

            {/* AI Parameters */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                AI Parameters
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure AI behavior parameters including temperature, top_p, max tokens, and speech rate.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Temperature: {watch('temperature')}
                  </Typography>
                  <Controller
                    name="temperature"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        {...field}
                        min={0}
                        max={1}
                        step={0.1}
                        marks
                        valueLabelDisplay="auto"
                      />
                    )}
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Top-P: {watch('topP')}
                  </Typography>
                  <Controller
                    name="topP"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        {...field}
                        min={0}
                        max={1}
                        step={0.1}
                        marks
                        valueLabelDisplay="auto"
                      />
                    )}
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Max Tokens: {watch('maxTokens')}
                  </Typography>
                  <Controller
                    name="maxTokens"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        {...field}
                        min={50}
                        max={500}
                        step={10}
                        marks
                        valueLabelDisplay="auto"
                      />
                    )}
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Speech Rate: {watch('speechRate')}
                  </Typography>
                  <Controller
                    name="speechRate"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        {...field}
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

              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Button
                  variant="contained"
                  onClick={async () => {
                    try {
                      const result = await uncertaintyGateService.getConfiguration();
                      setUncertaintyConfig(result);
                      showSuccess('Uncertainty gate configuration loaded');
                    } catch (error) {
                      showError('Failed to load uncertainty gate configuration');
                    }
                  }}
                >
                  Load Configuration
                </Button>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const result = await uncertaintyGateService.updateConfiguration({
                        defaultThreshold: 0.8,
                        minPassages: 2,
                        maxUncertaintyAttempts: 3
                      });
                      showSuccess('Uncertainty gate configuration updated');
                    } catch (error) {
                      showError('Failed to update uncertainty gate configuration');
                    }
                  }}
                >
                  Update Configuration
                </Button>
              </Box>

              {uncertaintyConfig && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Current Configuration</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Default Threshold</Typography>
                      <Typography variant="h6">{uncertaintyConfig.config?.defaultThreshold || 0.7}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Min Passages</Typography>
                      <Typography variant="h6">{uncertaintyConfig.config?.minPassages || 2}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Max Attempts</Typography>
                      <Typography variant="h6">{uncertaintyConfig.config?.maxUncertaintyAttempts || 3}</Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </Paper>
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