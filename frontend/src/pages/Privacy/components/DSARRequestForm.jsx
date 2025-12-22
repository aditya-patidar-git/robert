import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  Alert,
  Box,
  Typography,
  CircularProgress,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import dsarService from '../../../services/dsarService';

const DSARRequestForm = ({ open, onClose, initialType = 'export' }) => {
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    requestorEmail: user?.email || '',
    requestType: initialType,
    userIdentifier: user?.email || '',
    requestorPhone: ''
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const createMutation = useMutation({
    mutationFn: (data) => dsarService.createDSARRequest(data),
    onSuccess: (response) => {
      const request = response.dsarRequest || response;
      setRequestId(request.requestId);
      setActiveStep(1);
      showSuccess('DSAR request created. Please check your email for verification code.');
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to create DSAR request');
    }
  });

  const verifyMutation = useMutation({
    mutationFn: ({ requestId, code }) => dsarService.verifyDSARRequest(requestId, code),
    onSuccess: () => {
      showSuccess('Request verified successfully');
      queryClient.invalidateQueries(['dsar-requests']);
      onClose();
      setActiveStep(0);
      setFormData({ requestorEmail: '', requestType: initialType, userIdentifier: '', requestorPhone: '' });
      setVerificationCode('');
      setRequestId(null);
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Invalid verification code');
    }
  });

  const validateForm = () => {
    const errors = {};
    
    if (!formData.requestorEmail) {
      errors.requestorEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.requestorEmail)) {
      errors.requestorEmail = 'Invalid email format';
    }
    
    if (!formData.userIdentifier) {
      errors.userIdentifier = 'User identifier (email or phone) is required';
    }
    
    if (!formData.requestType) {
      errors.requestType = 'Request type is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      createMutation.mutate(formData);
    }
  };

  const handleVerify = () => {
    if (!verificationCode) {
      showError('Please enter verification code');
      return;
    }
    
    if (requestId) {
      verifyMutation.mutate({ requestId, code: verificationCode });
    }
  };

  const handleClose = () => {
    onClose();
    setActiveStep(0);
    setFormData({ requestorEmail: user?.email || '', requestType: initialType, userIdentifier: user?.email || '', requestorPhone: '' });
    setVerificationCode('');
    setRequestId(null);
    setFormErrors({});
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Create DSAR Request
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 2 }}>
          <Step>
            <StepLabel>Request Details</StepLabel>
          </Step>
          <Step>
            <StepLabel>Verification</StepLabel>
          </Step>
        </Stepper>

        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              Under GDPR, you have the right to access, export, or delete your personal data.
            </Alert>

            <TextField
              fullWidth
              label="Your Email"
              type="email"
              value={formData.requestorEmail}
              onChange={(e) => {
                setFormData({ ...formData, requestorEmail: e.target.value });
                if (formErrors.requestorEmail) setFormErrors({ ...formErrors, requestorEmail: '' });
              }}
              error={!!formErrors.requestorEmail}
              helperText={formErrors.requestorEmail}
              required
            />

            <TextField
              fullWidth
              label="Phone Number (Optional)"
              value={formData.requestorPhone}
              onChange={(e) => setFormData({ ...formData, requestorPhone: e.target.value })}
              placeholder="+44..."
            />

            <TextField
              fullWidth
              label="User Identifier"
              value={formData.userIdentifier}
              onChange={(e) => {
                setFormData({ ...formData, userIdentifier: e.target.value });
                if (formErrors.userIdentifier) setFormErrors({ ...formErrors, userIdentifier: '' });
              }}
              error={!!formErrors.userIdentifier}
              helperText={formErrors.userIdentifier || 'Email or phone number associated with your data'}
              required
            />

            <FormControl fullWidth required error={!!formErrors.requestType}>
              <InputLabel>Request Type</InputLabel>
              <Select
                value={formData.requestType}
                label="Request Type"
                onChange={(e) => {
                  setFormData({ ...formData, requestType: e.target.value });
                  if (formErrors.requestType) setFormErrors({ ...formErrors, requestType: '' });
                }}
              >
                <MenuItem value="export">Export My Data</MenuItem>
                <MenuItem value="delete">Delete My Data</MenuItem>
                <MenuItem value="rectification">Rectify My Data</MenuItem>
              </Select>
            </FormControl>

            {formData.requestType === 'delete' && (
              <Alert severity="warning">
                <Typography variant="body2">
                  <strong>Warning:</strong> Data deletion is permanent and cannot be undone. 
                  All your call transcripts, recordings, and personal information will be permanently deleted.
                </Typography>
              </Alert>
            )}
          </Box>
        )}

        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
              A verification code has been sent to <strong>{formData.requestorEmail}</strong>. 
              Please enter the code to verify your request.
            </Alert>

            <TextField
              fullWidth
              label="Verification Code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              placeholder="Enter 8-character code"
              inputProps={{ maxLength: 8 }}
              required
            />

            <Typography variant="body2" color="text.secondary">
              Request ID: <strong>{requestId}</strong>
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isLoading || verifyMutation.isLoading}>
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>
        {activeStep === 0 ? (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createMutation.isLoading}
            startIcon={createMutation.isLoading ? <CircularProgress size={20} /> : null}
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Request'}
          </Button>
        ) : (
          <Button
            onClick={handleVerify}
            variant="contained"
            disabled={verifyMutation.isLoading || !verificationCode}
            startIcon={verifyMutation.isLoading ? <CircularProgress size={20} /> : null}
          >
            {verifyMutation.isLoading ? 'Verifying...' : 'Verify'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DSARRequestForm;

