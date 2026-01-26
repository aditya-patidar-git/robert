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
  Alert,
  Checkbox,
  FormControlLabel,
  FormGroup,
  FormLabel
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
    requestorEmail: '',
    requestorName: '',
    requestorPhone: '',
    requestType: 'export',
    requestedDataTypes: ['all'],
    userIdentifier: '',
    description: ''
  });

  const availableDataTypes = [
    { id: 'all', label: 'All Data' },
    { id: 'transcripts', label: 'Transcripts' },
    { id: 'recordings', label: 'Recordings' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'callRecords', label: 'Call Records' }
  ];

  useEffect(() => {
    if (request) {
      setFormData({
        requestorEmail: request.requestorEmail || request.subjectEmail || '',
        requestorName: request.requestorName || '',
        requestorPhone: request.requestorPhone || request.subjectPhone || '',
        requestType: request.requestType || 'export',
        requestedDataTypes: request.requestedDataTypes || ['all'],
        userIdentifier: request.userIdentifier || request.requestorEmail || '',
        description: request.description || ''
      });
    } else {
      setFormData({
        requestorEmail: '',
        requestorName: '',
        requestorPhone: '',
        requestType: 'export',
        requestedDataTypes: ['all'],
        userIdentifier: '',
        description: ''
      });
    }
  }, [request, open]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDataTypeToggle = (dataType) => {
    let newSelection;
    if (dataType === 'all') {
      newSelection = ['all'];
    } else {
      newSelection = formData.requestedDataTypes.filter(dt => dt !== 'all');
      if (formData.requestedDataTypes.includes(dataType)) {
        newSelection = newSelection.filter(dt => dt !== dataType);
      } else {
        newSelection.push(dataType);
      }
      if (newSelection.length === 0) {
        newSelection = ['all'];
      }
    }
    setFormData(prev => ({ ...prev, requestedDataTypes: newSelection }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.requestorEmail || !formData.userIdentifier) {
      console.error('Missing required fields: requestorEmail and userIdentifier are required');
      return;
    }

    try {
      // Prepare submission data with proper field mapping
      const submissionData = {
        requestorEmail: formData.requestorEmail,
        requestorName: formData.requestorName,
        requestorPhone: formData.requestorPhone,
        requestType: formData.requestType,
        requestedDataTypes: formData.requestedDataTypes,
        userIdentifier: formData.userIdentifier || formData.requestorEmail,
        description: formData.description
      };

      await onSubmit(request?.id ? { id: request.id, data: submissionData } : submissionData);
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
              <MenuItem value="export">Data Export (Access/Portability)</MenuItem>
              <MenuItem value="delete">Data Deletion</MenuItem>
              <MenuItem value="rectification">Data Rectification</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Requestor Name"
            value={formData.requestorName}
            onChange={(e) => handleChange('requestorName', e.target.value)}
            fullWidth
            helperText="Full name of the person making the request"
          />

          <TextField
            label="Requestor Email"
            type="email"
            value={formData.requestorEmail}
            onChange={(e) => {
              handleChange('requestorEmail', e.target.value);
              // Auto-fill userIdentifier if empty
              if (!formData.userIdentifier) {
                handleChange('userIdentifier', e.target.value);
              }
            }}
            fullWidth
            required
            helperText="Email address of the person making the request"
          />

          <TextField
            label="Requestor Phone"
            type="tel"
            value={formData.requestorPhone}
            onChange={(e) => handleChange('requestorPhone', e.target.value)}
            fullWidth
            helperText="Optional contact phone number"
          />

          <TextField
            label="User Identifier"
            value={formData.userIdentifier}
            onChange={(e) => handleChange('userIdentifier', e.target.value)}
            fullWidth
            required
            helperText="Phone number or email used in calls (to search records)"
          />

          <FormControl component="fieldset">
            <FormLabel component="legend">Requested Data Types</FormLabel>
            <FormGroup row>
              {availableDataTypes.map((dataType) => (
                <FormControlLabel
                  key={dataType.id}
                  control={
                    <Checkbox
                      checked={formData.requestedDataTypes.includes(dataType.id)}
                      onChange={() => handleDataTypeToggle(dataType.id)}
                      size="small"
                    />
                  }
                  label={dataType.label}
                />
              ))}
            </FormGroup>
          </FormControl>

          <TextField
            label="Description"
            multiline
            rows={3}
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
          disabled={loading || !formData.requestorEmail || !formData.userIdentifier}
        >
          {request ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

