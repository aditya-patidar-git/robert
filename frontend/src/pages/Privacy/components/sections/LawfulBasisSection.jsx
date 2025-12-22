import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert
} from '@mui/material';
import { Save } from '@mui/icons-material';

/**
 * Lawful Basis & Privacy Notice Section Component
 */
export function LawfulBasisSection({ config, onUpdate, loading }) {
  const [lawfulBasis, setLawfulBasis] = useState(config?.lawfulBasis || 'consent');
  const [privacyNotice, setPrivacyNotice] = useState(config?.privacyNotice || '');

  const handleSave = async () => {
    try {
      await onUpdate({
        lawfulBasis,
        privacyNotice
      });
    } catch (error) {
      console.error('Failed to save lawful basis settings:', error);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>Lawful Basis & Privacy Notice</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Lawful Basis for Processing</InputLabel>
          <Select
            value={lawfulBasis}
            onChange={(e) => setLawfulBasis(e.target.value)}
            label="Lawful Basis for Processing"
          >
            <MenuItem value="consent">Consent</MenuItem>
            <MenuItem value="contract">Contract</MenuItem>
            <MenuItem value="legal_obligation">Legal Obligation</MenuItem>
            <MenuItem value="vital_interests">Vital Interests</MenuItem>
            <MenuItem value="public_task">Public Task</MenuItem>
            <MenuItem value="legitimate_interests">Legitimate Interests</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Privacy Notice"
          multiline
          rows={6}
          value={privacyNotice}
          onChange={(e) => setPrivacyNotice(e.target.value)}
          fullWidth
          placeholder="Enter privacy notice text..."
        />

        <Button
          startIcon={<Save />}
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          sx={{ alignSelf: 'flex-start' }}
        >
          Save Settings
        </Button>
      </Box>
    </Paper>
  );
}

