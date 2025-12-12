import React, { useState, useEffect, useRef } from 'react';
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
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Save,
  PlayArrow,
  Stop,
  Add,
  Info
} from '@mui/icons-material';
import { useToast } from '../common/ToastProvider';
import languageVoiceService from '../../services/languageVoiceService';
import voiceService from '../../services/voiceService';

// Common language codes reference
const COMMON_LANGUAGE_CODES = [
  { name: 'English (US)', code: 'en-US' },
  { name: 'English (UK)', code: 'en-GB' },
  { name: 'Chinese (Simplified)', code: 'zh-CN' },
  { name: 'Chinese (Traditional)', code: 'zh-TW' },
  { name: 'French', code: 'fr-FR' },
  { name: 'German', code: 'de-DE' },
  { name: 'Spanish', code: 'es-ES' },
  { name: 'Japanese', code: 'ja-JP' },
  { name: 'Korean', code: 'ko-KR' },
  { name: 'Portuguese (Brazil)', code: 'pt-BR' },
  { name: 'Portuguese (Portugal)', code: 'pt-PT' },
  { name: 'Russian', code: 'ru-RU' },
  { name: 'Arabic', code: 'ar-SA' },
  { name: 'Hindi', code: 'hi-IN' },
];

// Function to find language code from language name
const findLanguageCodeFromName = (languageName) => {
  if (!languageName || !languageName.trim()) return null;
  
  const normalizedName = languageName.trim().toLowerCase();
  
  // Priority mapping for ambiguous cases
  const priorityMap = {
    'english': 'en-US',
    'chinese': 'zh-CN',
    'portuguese': 'pt-BR'
  };
  
  // Check priority map first
  if (priorityMap[normalizedName]) {
    return priorityMap[normalizedName];
  }
  
  // Find exact or partial match in COMMON_LANGUAGE_CODES
  const match = COMMON_LANGUAGE_CODES.find(lang => {
    const langNameLower = lang.name.toLowerCase();
    return langNameLower === normalizedName || 
           langNameLower.includes(normalizedName) ||
           normalizedName.includes(langNameLower.split('(')[0].trim());
  });
  
  return match ? match.code : null;
};

const LanguageVoiceMapping = ({ 
  onSave = null, // Optional callback when save is clicked
  showPreview = true // Show voice preview button
}) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  
  const [languageMappings, setLanguageMappings] = useState([]);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const lastProcessedMappingsRef = useRef(null);
  const [addLanguageDialog, setAddLanguageDialog] = useState({ open: false });
  const [formData, setFormData] = useState({
    languageName: '',
    languageCode: '',
    localeCode: '',
    voiceId: '',
    isActive: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  // Fetch language/voice mappings
  const { data: fetchedMappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['language-voice-mappings'],
    queryFn: () => languageVoiceService.getLanguageMappings()
  });

  // Fetch available voices
  const { data: voicesData, isLoading: voicesLoading } = useQuery({
    queryKey: ['voices'],
    queryFn: () => voiceService.getVoices()
  });

  // Update local state when mappings are fetched
  useEffect(() => {
    if (fetchedMappings) {
      // Ensure fetchedMappings is an array
      const mappingsArray = Array.isArray(fetchedMappings) 
        ? fetchedMappings 
        : (fetchedMappings.mappings || fetchedMappings.data || []);
      
      // Compare with last processed data to avoid infinite loops
      const currentStr = JSON.stringify(mappingsArray);
      if (lastProcessedMappingsRef.current === currentStr) {
        // Already processed this data, skip update
        return;
      }
      
      // Update ref to track what we've processed
      lastProcessedMappingsRef.current = currentStr;
      
      // Only update if we have mappings or if we haven't initialized yet
      setLanguageMappings(prev => {
        if (mappingsArray.length > 0) {
          return mappingsArray;
        } else if (prev.length === 0) {
          // Only set empty array if we haven't set anything yet (to avoid clearing user edits)
          return [];
        }
        // Don't update if we have existing mappings and new ones are empty (preserve user edits)
        return prev;
      });
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

  // Validate language name and code consistency
  const validateLanguageNameCodeConsistency = () => {
    const languageName = formData.languageName.trim();
    const languageCode = formData.languageCode.trim();
    const localeCode = formData.localeCode.trim();
    
    if (!languageName || !languageCode || !localeCode) {
      return null; // Skip validation if fields are empty (handled by required validation)
    }
    
    // Find expected code for the language name
    const expectedCode = findLanguageCodeFromName(languageName);
    
    // If language name is not in our list (custom language), allow it through
    if (!expectedCode) {
      return null;
    }
    
    // If language name exists in our list, check if codes match
    if (languageCode.toLowerCase() !== expectedCode.toLowerCase() || 
        localeCode.toLowerCase() !== expectedCode.toLowerCase()) {
      return `Expected code "${expectedCode}" for "${languageName}". Please use the suggested code or enter a custom language name.`;
    }
    
    return null; // No error
  };

  // Validate form for new language
  const validateForm = () => {
    const errors = {};
    
    // Language Name validation
    if (!formData.languageName.trim()) {
      errors.languageName = 'Language name is required';
    }
    
    // Language Code validation
    if (!formData.languageCode.trim()) {
      errors.languageCode = 'Language code is required';
    } else {
      // Check for duplicate language code
      const existingCode = languageMappings.find(
        m => m.languageCode.toLowerCase() === formData.languageCode.trim().toLowerCase()
      );
      if (existingCode) {
        errors.languageCode = 'Language code already exists';
      }
    }
    
    // Locale Code validation
    if (!formData.localeCode.trim()) {
      errors.localeCode = 'Locale code is required';
    }
    
    // Voice validation
    if (!formData.voiceId) {
      errors.voiceId = 'Voice selection is required';
    }
    
    // Validate language name and code consistency
    const consistencyError = validateLanguageNameCodeConsistency();
    if (consistencyError) {
      errors.languageCode = consistencyError;
      errors.localeCode = consistencyError;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form field changes
  const handleFormChange = (field) => (e) => {
    const value = field === 'isActive' ? e.target.checked : e.target.value;
    const updatedFormData = { ...formData, [field]: value };
    
    // Auto-populate language code and locale code when language name changes
    if (field === 'languageName' && value.trim()) {
      const languageCode = findLanguageCodeFromName(value);
      if (languageCode) {
        updatedFormData.languageCode = languageCode;
        updatedFormData.localeCode = languageCode;
      }
    }
    
    setFormData(updatedFormData);
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: '' });
    }
  };

  // Handle create new language
  const handleCreateLanguage = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsCreating(true);
      const selectedVoice = voices.find(v => v.id === formData.voiceId);
      
      const newMapping = await languageVoiceService.createLanguageMapping({
        languageCode: formData.languageCode.trim(),
        languageName: formData.languageName.trim(),
        localeCode: formData.localeCode.trim(),
        voiceId: formData.voiceId,
        voiceName: selectedVoice?.name || '',
        isActive: formData.isActive
      });

      showSuccess('Language mapping created successfully');
      queryClient.invalidateQueries(['language-voice-mappings']);
      
      // Close dialog and reset form
      setAddLanguageDialog({ open: false });
      setFormData({
        languageName: '',
        languageCode: '',
        localeCode: '',
        voiceId: '',
        isActive: true
      });
      setFormErrors({});
    } catch (error) {
      showError(error.message || 'Failed to create language mapping');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle close dialog
  const handleCloseAddLanguageDialog = () => {
    setAddLanguageDialog({ open: false });
    setFormData({
      languageName: '',
      languageCode: '',
      localeCode: '',
      voiceId: '',
      isActive: true
    });
    setFormErrors({});
  };

  const voices = Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Language/Voice Mapping Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add />}
            onClick={() => setAddLanguageDialog({ open: true })}
            disabled={mappingsLoading || voicesLoading}
          >
            New Language
          </Button>
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

      {/* Add New Language Dialog */}
      <Dialog
        open={addLanguageDialog.open}
        onClose={handleCloseAddLanguageDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Add New Language
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Language Name"
              value={formData.languageName}
              onChange={handleFormChange('languageName')}
              error={!!formErrors.languageName}
              helperText={formErrors.languageName}
              required
              margin="normal"
              placeholder="e.g., Chinese"
            />
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField
                fullWidth
                label="Language Code"
                value={formData.languageCode}
                onChange={handleFormChange('languageCode')}
                error={!!formErrors.languageCode}
                helperText={
                  formErrors.languageCode || 
                  'ISO 639-1 format: language-COUNTRY. Common: en-US, en-GB, zh-CN, fr-FR, de-DE, es-ES, ja-JP, ko-KR'
                }
                required
                margin="normal"
                placeholder="e.g., en-US, zh-CN"
              />
              <Tooltip 
                title="Language codes follow ISO 639-1 format with optional country code. Format: language-COUNTRY. Examples: en-US (English USA), zh-CN (Chinese Simplified), fr-FR (French France), ja-JP (Japanese Japan)"
                arrow
                placement="top"
              >
                <IconButton size="small" sx={{ mt: 1.5 }}>
                  <Info fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <TextField
              fullWidth
              label="Locale Code"
              value={formData.localeCode}
              onChange={handleFormChange('localeCode')}
              error={!!formErrors.localeCode}
              helperText={
                formErrors.localeCode || 
                'Auto-filled from Language Code (usually the same). Can be edited if different.'
              }
              required
              margin="normal"
              placeholder="e.g., zh-CN"
            />
            <FormControl fullWidth margin="normal" error={!!formErrors.voiceId}>
              <Select
                value={formData.voiceId}
                onChange={handleFormChange('voiceId')}
                displayEmpty
                required
              >
                <MenuItem value="" disabled>
                  Select Voice
                </MenuItem>
                {voices.map((voice) => (
                  <MenuItem key={voice.id} value={voice.id}>
                    {voice.name} ({voice.language || 'N/A'})
                  </MenuItem>
                ))}
              </Select>
              {formErrors.voiceId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {formErrors.voiceId}
                </Typography>
              )}
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Switch
                checked={formData.isActive}
                onChange={handleFormChange('isActive')}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                Active
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleCloseAddLanguageDialog}
            variant="outlined"
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateLanguage}
            variant="contained"
            disabled={isCreating}
            startIcon={isCreating ? <CircularProgress size={20} /> : <Add />}
          >
            {isCreating ? 'Creating...' : 'Create Language'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default LanguageVoiceMapping;

