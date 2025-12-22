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
  Switch,
  FormControlLabel,
  Alert
} from '@mui/material';
import { Save } from '@mui/icons-material';

/**
 * Data Retention Section Component
 * Manages data retention settings
 */
export function DataRetentionSection({ retention, onUpdate, loading }) {
  const [settings, setSettings] = useState({
    enabled: retention?.enabled ?? true,
    defaultRetentionDays: retention?.defaultRetentionDays ?? 365,
    callRecordRetentionDays: retention?.callRecordRetentionDays ?? 365,
    transcriptRetentionDays: retention?.transcriptRetentionDays ?? 365,
    audioRetentionDays: retention?.audioRetentionDays ?? 30,
    ...retention
  });

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await onUpdate(settings);
    } catch (error) {
      console.error('Failed to save retention settings:', error);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>Data Retention Controls</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
            />
          }
          label="Enable Automatic Data Retention"
        />

        {settings.enabled && (
          <>
            <FormControl fullWidth>
              <InputLabel>Default Retention Period</InputLabel>
              <Select
                value={settings.defaultRetentionDays}
                onChange={(e) => handleChange('defaultRetentionDays', e.target.value)}
                label="Default Retention Period"
              >
                <MenuItem value={30}>30 days</MenuItem>
                <MenuItem value={90}>90 days</MenuItem>
                <MenuItem value={180}>180 days</MenuItem>
                <MenuItem value={365}>1 year</MenuItem>
                <MenuItem value={730}>2 years</MenuItem>
                <MenuItem value={1095}>3 years</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Call Record Retention (days)"
              type="number"
              value={settings.callRecordRetentionDays}
              onChange={(e) => handleChange('callRecordRetentionDays', parseInt(e.target.value))}
              fullWidth
            />

            <TextField
              label="Transcript Retention (days)"
              type="number"
              value={settings.transcriptRetentionDays}
              onChange={(e) => handleChange('transcriptRetentionDays', parseInt(e.target.value))}
              fullWidth
            />

            <TextField
              label="Audio Retention (days)"
              type="number"
              value={settings.audioRetentionDays}
              onChange={(e) => handleChange('audioRetentionDays', parseInt(e.target.value))}
              fullWidth
            />
          </>
        )}

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

