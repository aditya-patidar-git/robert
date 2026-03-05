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
import ConfirmSaveDialog from '../../../../components/common/ConfirmSaveDialog';
import { AGENT_AFFECTING_WARNINGS } from '../../../../constants/agentAffectingWarnings';

/**
 * Lawful Basis & Privacy Notice Section Component
 */
export function LawfulBasisSection({ config, onUpdate, loading }) {
  const [lawfulBasis, setLawfulBasis] = useState(config?.lawfulBasis || 'consent');
  const [privacyNotice, setPrivacyNotice] = useState(config?.privacyNotice || '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSave = () => {
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    try {
      await onUpdate({
        lawfulBasis,
        privacyNotice
      });
      setConfirmOpen(false);
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

      <ConfirmSaveDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title={AGENT_AFFECTING_WARNINGS.PRIVACY_CONSENT.title}
        message={AGENT_AFFECTING_WARNINGS.PRIVACY_CONSENT.message}
        effects={AGENT_AFFECTING_WARNINGS.PRIVACY_CONSENT.effects}
        confirmLabel="Save"
      />
    </Paper>
  );
}

