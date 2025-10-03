import React, { useState } from 'react';
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
  Divider
} from '@mui/material';
import {
  CloudUpload,
  Refresh,
  PlayArrow,
  Description,
  Warning,
  VolumeUp,
  Save,
  Undo
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
  const [retrievalQuery, setRetrievalQuery] = useState('');
  const [retrievalResults, setRetrievalResults] = useState([]);
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

  // Fetch knowledge base files
  const { data: kbFiles = [], isLoading: kbLoading, error: kbError } = useQuery({
    queryKey: ['kb-files'],
    queryFn: kbService.getAllArticles,
    onError: (error) => {
      console.error('KB Files Error:', error);
      showError('Failed to load knowledge base files');
    }
  });

  // Debug logging
  console.log('KB Files Data:', kbFiles);
  console.log('KB Files Type:', typeof kbFiles);
  console.log('KB Files is Array:', Array.isArray(kbFiles));

  // Fetch prompts
  const { data: prompts = [], isLoading: promptsLoading, error: promptsError } = useQuery({
    queryKey: ['prompts'],
    queryFn: promptService.getAllPrompts,
    onSuccess: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        setValue('globalPrompt', data[0].content || '');
      }
    },
    onError: (error) => {
      console.error('Prompts Error:', error);
      showError('Failed to load prompts');
    }
  });

  // Fetch AI models (discovered from OpenAI)
  const { data: models = [], error: modelsError } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => aiService.getModels(),
    onError: (error) => {
      console.error('Models Error:', error);
      showError('Failed to load AI models');
    }
  });

  // Fetch voices (discovered from OpenAI)
  const { data: voices = [], error: voicesError } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices(),
    onError: (error) => {
      console.error('Voices Error:', error);
      showError('Failed to load voices');
    }
  });

  // Fetch vector store status
  const { data: vectorStoreData, isLoading: vectorStoreLoading, error: vectorStoreError } = useQuery({
    queryKey: ['vector-store-status'],
    queryFn: vectorStoreService.getStatus,
    onSuccess: (data) => {
      console.log('Vector Store Status Data:', data);
      setVectorStoreStatus(data);
    },
    onError: (error) => {
      console.error('Vector Store Status Error:', error);
      showError('Failed to load vector store status');
    }
  });


  // Fetch migration status
  const { data: migrationData, isLoading: migrationLoading } = useQuery({
    queryKey: ['migration-status'],
    queryFn: vectorStoreService.getMigrationStatus,
    refetchInterval: 5000, // Poll every 5 seconds when migration is running
    onSuccess: (data) => {
      setMigrationStatus(data);
    },
    onError: (error) => {
      console.error('Migration Status Error:', error);
    }
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: kbService.createArticle,
    onSuccess: () => {
      showSuccess('File uploaded successfully');
      queryClient.invalidateQueries(['kb-files']);
    },
    onError: () => showError('Failed to upload file')
  });

  // Re-ingest mutation
  const reingestMutation = useMutation({
    mutationFn: kbService.updateArticle,
    onSuccess: () => {
      showSuccess('File re-ingested successfully');
      queryClient.invalidateQueries(['kb-files']);
    },
    onError: () => showError('Failed to re-ingest file')
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

  // Vector store search mutation
  const vectorSearchMutation = useMutation({
    mutationFn: ({ query, fileIds, limit }) => vectorStoreService.testSearch(query, fileIds, limit),
    onSuccess: (results) => {
      setRetrievalResults(results.results || []);
      showSuccess('Vector search completed');
    },
    onError: () => showError('Failed to perform vector search')
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
      const allowedTypes = ['application/pdf', 'text/html', 'text/markdown', 'text/plain'];
      const maxSize = 1 * 1024 * 1024; // 1MB

      if (!allowedTypes.includes(file.type)) {
        showError('Only PDF, HTML, and MD files are allowed');
        return;
      }

      if (file.size > maxSize) {
        showError('File size must be less than 1MB');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      uploadFileMutation.mutate(formData);
    }
  };

  const handleRetrievalTest = async () => {
    if (!retrievalQuery.trim()) return;

    // Use vector search for better results
    vectorSearchMutation.mutate({
      query: retrievalQuery,
      limit: 5
    });
  };

  const handleSavePrompt = (data) => {
    savePromptMutation.mutate({
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
          <Tab label="Knowledge Base" />
          <Tab label="Prompts & AI Controls" />
          <Tab label="Vector Store" />
          <Tab label="Drift Detection" />
          <Tab label="Reingest" />
          <Tab label="Test Retrieval" />
          <Tab label="Provenance" />
          <Tab label="Uncertainty Gate" />
        </Tabs>
      </Paper>

      {/* Tab A: Knowledge Base */}
      {currentTab === 0 && (
        <Box>
          {/* File Upload Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upload Files
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Supported formats: PDF, HTML, MD (Max 1MB per file)
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

          {/* File Search Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              OpenAI File Search
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
                            <Typography variant="body2" color="text.secondary">
                              Similarity: {(result.similarityScore * 100).toFixed(1)}%
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {result.content?.substring(0, 200)}...
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
                    <TableCell>Uploaded At</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Drift Warning</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(kbFiles) ? kbFiles : []).map((file, index) => (
                    <TableRow key={file.id || index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Description fontSize="small" />
                          {file.title || file.filename}
                        </Box>
                      </TableCell>
                      <TableCell>{formatDateTime(file.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={file.status || 'Active'}
                          color={file.status === 'Active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {file.hasDrift && (
                          <Chip
                            icon={<Warning />}
                            label="Drift Detected"
                            color="warning"
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => reingestMutation.mutate(file.id)}
                          disabled={reingestMutation.isLoading}
                        >
                          <Refresh />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Retrieval Tester */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Retrieval Tester
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Enter your test query..."
                value={retrievalQuery}
                onChange={(e) => setRetrievalQuery(e.target.value)}
              />
              <Button
                variant="contained"
                onClick={handleRetrievalTest}
                startIcon={<PlayArrow />}
              >
                Test
              </Button>
            </Box>

            {retrievalResults.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Results ({retrievalResults.length})
                </Typography>
                <List>
                  {retrievalResults.map((result, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={result.title}
                        secondary={result.content?.substring(0, 200) + '...'}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Tab B: Prompts & AI Controls */}
      {currentTab === 1 && (
        <form onSubmit={handleSubmit(handleSavePrompt)}>
          <Box>
            {/* Global Prompt Editor */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Global Prompt Editor
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
                    placeholder="Enter the global AI prompt..."
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
                  Save
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Undo />}
                  onClick={() => {
                    if (prompts.length > 0) {
                      setValue('globalPrompt', prompts[0].content || '');
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
              <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Controller
                  name="selectedModel"
                  control={control}
                  render={({ field }) => (
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>Model</InputLabel>
                      <Select {...field} label="Model">
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
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                AI Parameters
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
          </Box>
        </form>
      )}

      {/* Tab C: Vector Store Management */}
      {currentTab === 2 && (
        <Box>

          {/* Vector Store Status */}
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
            ) : vectorStoreStatus ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    label={vectorStoreStatus.status || 'Unknown'} 
                    color={vectorStoreStatus.status === 'active' ? 'success' : 'default'}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Files</Typography>
                  <Typography variant="h6">{vectorStoreStatus.fileCount || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Vector Store ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {vectorStoreStatus.vectorStoreId || 'N/A'}
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

          {/* Migration Controls */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Migration Controls
            </Typography>
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
          </Paper>

          {/* Vector Search Test */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Vector Search Test
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Enter search query for vector store..."
                value={retrievalQuery}
                onChange={(e) => setRetrievalQuery(e.target.value)}
              />
              <Button
                variant="contained"
                onClick={handleRetrievalTest}
                startIcon={<PlayArrow />}
                disabled={vectorSearchMutation.isLoading}
              >
                Test Vector Search
              </Button>
            </Box>

            {retrievalResults.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Vector Search Results ({retrievalResults.length})
                </Typography>
                <List>
                  {retrievalResults.map((result, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={`Score: ${result.score?.toFixed(3) || 'N/A'}`}
                        secondary={result.content?.substring(0, 200) + '...'}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Tab D: Drift Detection */}
      {currentTab === 3 && (
        <Box>
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
                onClick={async () => {
                  try {
                    const result = await driftService.getDriftStatus();
                    setDriftStatus(result);
                  } catch (error) {
                    showError('Failed to get drift status');
                  }
                }}
              >
                Check Status
              </Button>
            </Box>

            {driftStatus && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>Detection Results</Typography>
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
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Tab E: Reingest */}
      {currentTab === 4 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Reingest System
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
                onClick={async () => {
                  try {
                    const result = await reingestService.getReingestStatus();
                    setReingestStatus(result);
                  } catch (error) {
                    showError('Failed to get reingest status');
                  }
                }}
              >
                Check Status
              </Button>
            </Box>

            {reingestStatus && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>Reingest Status</Typography>
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
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Tab F: Test Retrieval */}
      {currentTab === 5 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Test Retrieval
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
                Run Test
              </Button>
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    const result = await testRetrievalService.getTestQueries();
                    console.log('Test queries:', result);
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
        </Box>
      )}

      {/* Tab G: Provenance */}
      {currentTab === 6 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Provenance Tracking
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
        </Box>
      )}

      {/* Tab H: Uncertainty Gate */}
      {currentTab === 7 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Uncertainty Gate
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
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
                <Typography variant="subtitle1" gutterBottom>Uncertainty Gate Configuration</Typography>
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
      )}

    </Container>
  );
};

export default AIKnowledgePage;