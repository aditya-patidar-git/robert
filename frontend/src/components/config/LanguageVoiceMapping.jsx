import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Switch,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Save,
  PlayArrow,
  Stop
} from '@mui/icons-material';
import { useToast } from '../common/ToastProvider';
import languageVoiceService from '../../services/languageVoiceService';
import voiceService from '../../services/voiceService';

const LanguageVoiceMapping = ({ 
  onSave = null, // Optional callback when save is clicked
  showPreview = true // Show voice preview button
}) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  
  const [languageMappings, setLanguageMappings] = useState([]);
  const [previewingVoice, setPreviewingVoice] = useState(null);

  // Fetch language/voice mappings
  const { data: fetchedMappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['language-voice-mappings'],
    queryFn: languageVoiceService.getLanguageMappings
  });

  // Fetch available voices
  const { data: voicesData, isLoading: voicesLoading } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices()
  });

  // Update local state when mappings are fetched
  useEffect(() => {
    if (fetchedMappings && fetchedMappings.length > 0) {
      setLanguageMappings(fetchedMappings);
    }
  }, [fetchedMappings]);

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
    if (!showPreview) return;
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
      
      if (onSave) {
        onSave(mappingsToSave);
      }
    } catch (error) {
      showError('Failed to save language/voice mappings');
    }
  };

  const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);

  return (
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

      {mappingsLoading || voicesLoading ? (
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
                {showPreview && (
                  <TableCell align="center"><strong>Preview</strong></TableCell>
                )}
                <TableCell align="center"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {languageMappings.map((mapping) => {
                // Filter voices by language/locale if possible
                const compatibleVoices = voices.filter(voice => {
                  if (!voice.language) return true;
                  return voice.language.toLowerCase().includes(mapping.localeCode?.toLowerCase().split('-')[0] || '');
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
                    {showPreview && (
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
                    )}
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
  );
};

export default LanguageVoiceMapping;

