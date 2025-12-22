import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert
} from '@mui/material';
import { Save, Cancel } from '@mui/icons-material';

/**
 * Data Breach Dialog Component
 * Form for reporting data breaches
 */
export function DataBreachDialog({
  open,
  onClose,
  onSubmit,
  loading
}) {
  const [formData, setFormData] = useState({
    description: '',
    severity: 'low',
    affectedRecords: '',
    discoveredAt: new Date().toISOString().split('T')[0]
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      await onSubmit(formData);
      setFormData({
        description: '',
        severity: 'low',
        affectedRecords: '',
        discoveredAt: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Failed to report data breach:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Report Data Breach</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <Alert severity="warning">
            Data breaches must be reported to the ICO within 72 hours of discovery.
          </Alert>

          <TextField
            label="Discovery Date"
            type="date"
            value={formData.discoveredAt}
            onChange={(e) => handleChange('discoveredAt', e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <FormControl fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select
              value={formData.severity}
              onChange={(e) => handleChange('severity', e.target.value)}
              label="Severity"
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Affected Records (estimated)"
            type="number"
            value={formData.affectedRecords}
            onChange={(e) => handleChange('affectedRecords', e.target.value)}
            fullWidth
          />

          <TextField
            label="Description"
            multiline
            rows={6}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            fullWidth
            placeholder="Describe the data breach, including what happened, what data was affected, and what actions have been taken..."
            required
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          startIcon={<Cancel />}
          onClick={onClose}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          startIcon={<Save />}
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.description}
        >
          Report Breach
        </Button>
      </DialogActions>
    </Dialog>
  );
}

