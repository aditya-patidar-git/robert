import React, { useState, useEffect } from 'react';
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
 * DSAR Request Dialog Component
 * Form for creating/editing DSAR requests
 */
export function DSARRequestDialog({
  open,
  onClose,
  request,
  onSubmit,
  loading
}) {
  const [formData, setFormData] = useState({
    subjectEmail: '',
    subjectPhone: '',
    requestType: 'access',
    description: ''
  });

  useEffect(() => {
    if (request) {
      setFormData({
        subjectEmail: request.subjectEmail || '',
        subjectPhone: request.subjectPhone || '',
        requestType: request.requestType || 'access',
        description: request.description || ''
      });
    } else {
      setFormData({
        subjectEmail: '',
        subjectPhone: '',
        requestType: 'access',
        description: ''
      });
    }
  }, [request, open]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      await onSubmit(request?.id ? { id: request.id, data: formData } : formData);
      onClose();
    } catch (error) {
      console.error('Failed to submit DSAR request:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {request ? 'Edit DSAR Request' : 'New DSAR Request'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Request Type</InputLabel>
            <Select
              value={formData.requestType}
              onChange={(e) => handleChange('requestType', e.target.value)}
              label="Request Type"
            >
              <MenuItem value="access">Data Access</MenuItem>
              <MenuItem value="portability">Data Portability</MenuItem>
              <MenuItem value="deletion">Data Deletion</MenuItem>
              <MenuItem value="rectification">Data Rectification</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Subject Email"
            type="email"
            value={formData.subjectEmail}
            onChange={(e) => handleChange('subjectEmail', e.target.value)}
            fullWidth
          />

          <TextField
            label="Subject Phone"
            type="tel"
            value={formData.subjectPhone}
            onChange={(e) => handleChange('subjectPhone', e.target.value)}
            fullWidth
          />

          <TextField
            label="Description"
            multiline
            rows={4}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            fullWidth
            placeholder="Additional details about the request..."
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
          disabled={loading}
        >
          {request ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

