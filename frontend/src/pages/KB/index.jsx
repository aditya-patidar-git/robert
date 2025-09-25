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

const AIKnowledgePage = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [retrievalQuery, setRetrievalQuery] = useState('');
  const [retrievalResults, setRetrievalResults] = useState([]);

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
  const { data: kbFiles = [], isLoading: kbLoading } = useQuery({
    queryKey: ['kb-files'],
    queryFn: kbService.getAllArticles
  });

  // Fetch prompts
  const { data: prompts = [], isLoading: promptsLoading } = useQuery({
    queryKey: ['prompts'],
    queryFn: promptService.getAllPrompts,
    onSuccess: (data) => {
      if (data.length > 0) {
        setValue('globalPrompt', data[0].content || '');
      }
    }
  });

  // Fetch AI models
  const { data: models = [] } = useQuery({
    queryKey: ['ai-models'],
    queryFn: aiService.getModels
  });

  // Fetch voices
  const { data: voices = [] } = useQuery({
    queryKey: ['voices'],
    queryFn: voiceService.getVoices
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

    try {
      const results = await kbService.searchArticles(retrievalQuery);
      setRetrievalResults(results);
      showSuccess('Retrieval test completed');
    } catch (error) {
      showError('Failed to run retrieval test');
    }
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

          {/* Files Table */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Knowledge Base Files ({kbFiles.length})
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
                  {kbFiles.map((file, index) => (
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
                        {models.map((model) => (
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
                        {voices.map((voice) => (
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
                {voices.slice(0, 3).map((voice) => (
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
    </Container>
  );
};

export default AIKnowledgePage;