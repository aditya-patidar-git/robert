import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Divider
} from '@mui/material';
import { Send, Email } from '@mui/icons-material';
import systemService from '../../../services/systemService';
import { useToast } from '../../../components/common/ToastProvider';

const EmailTestTab = () => {
  const { showSuccess, showError } = useToast();
  
  // Form state
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [template, setTemplate] = useState('custom');
  
  // Template data state
  const [templateData, setTemplateData] = useState({
    customerName: '',
    bookingReference: '',
    courseType: '',
    date: '',
    time: '',
    centre: '',
    address: ''
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  
  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!recipient.trim()) {
      newErrors.recipient = 'Recipient email is required';
    } else if (!validateEmail(recipient)) {
      newErrors.recipient = 'Invalid email format';
    }
    
    if (template === 'custom') {
      if (!subject.trim()) {
        newErrors.subject = 'Subject is required';
      }
      if (!body.trim()) {
        newErrors.body = 'Body is required';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle template data change
  const handleTemplateDataChange = (field, value) => {
    setTemplateData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle send email
  const handleSendEmail = async () => {
    // Clear previous result
    setResult(null);
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Prepare parameters
      const parameters = {
        to: recipient.trim()
      };
      
      if (template === 'custom') {
        parameters.subject = subject.trim();
        parameters.body = body.trim();
      } else {
        parameters.template = template;
        parameters.templateData = {
          customerName: templateData.customerName || 'Customer',
          bookingReference: templateData.bookingReference || 'N/A',
          courseType: templateData.courseType || 'N/A',
          date: templateData.date || 'N/A',
          time: templateData.time || 'N/A',
          centre: templateData.centre || 'N/A',
          address: templateData.address
        };
      }
      
      // Execute email tool
      const response = await systemService.executeMCPTool('email', parameters);
      
      if (response.success || response.data?.success) {
        const messageId = response.data?.messageId || response.messageId;
        setResult({
          success: true,
          message: `Email sent successfully!${messageId ? ` Message ID: ${messageId}` : ''}`,
          messageId
        });
        showSuccess('Test email sent successfully');
      } else {
        const errorMsg = response.error || response.data?.error || 'Failed to send email';
        setResult({
          success: false,
          message: errorMsg
        });
        showError(`Failed to send email: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = error.message || 'Unknown error occurred';
      setResult({
        success: false,
        message: errorMsg
      });
      showError(`Error sending email: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle reset form
  const handleReset = () => {
    setRecipient('');
    setSubject('');
    setBody('');
    setTemplate('custom');
    setTemplateData({
      customerName: '',
      bookingReference: '',
      courseType: '',
      date: '',
      time: '',
      centre: '',
      address: ''
    });
    setResult(null);
    setErrors({});
  };
  
  const showTemplateFields = template !== 'custom';
  
  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Email color="primary" />
          <Typography variant="h5" component="h2" fontWeight="bold">
            Email Service Testing
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Test the email service by sending a test email. You can send custom emails or use predefined templates.
        </Typography>
        
        <Grid container spacing={3}>
          {/* Recipient Email */}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Recipient Email"
              type="email"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                if (errors.recipient) {
                  setErrors(prev => ({ ...prev, recipient: null }));
                }
              }}
              error={!!errors.recipient}
              helperText={errors.recipient || 'Enter the email address to send the test email to'}
              required
            />
          </Grid>
          
          {/* Template Selector */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Email Template</InputLabel>
              <Select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                label="Email Template"
              >
                <MenuItem value="custom">Custom Email</MenuItem>
                <MenuItem value="booking_confirmation">Booking Confirmation</MenuItem>
                <MenuItem value="booking_reminder">Booking Reminder</MenuItem>
                <MenuItem value="cancellation">Cancellation</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Custom Email Fields */}
          {template === 'custom' && (
            <>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    if (errors.subject) {
                      setErrors(prev => ({ ...prev, subject: null }));
                    }
                  }}
                  error={!!errors.subject}
                  helperText={errors.subject || 'Enter the email subject'}
                  required
                />
              </Grid>
              
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Message Body"
                  multiline
                  rows={6}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    if (errors.body) {
                      setErrors(prev => ({ ...prev, body: null }));
                    }
                  }}
                  error={!!errors.body}
                  helperText={errors.body || 'Enter the email message body'}
                  required
                />
              </Grid>
            </>
          )}
          
          {/* Template Data Fields */}
          {showTemplateFields && (
            <>
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Template Data
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Fill in the template data. All fields are optional and will use defaults if not provided.
                </Typography>
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Customer Name"
                  value={templateData.customerName}
                  onChange={(e) => handleTemplateDataChange('customerName', e.target.value)}
                  helperText="Customer's full name"
                />
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Booking Reference"
                  value={templateData.bookingReference}
                  onChange={(e) => handleTemplateDataChange('bookingReference', e.target.value)}
                  helperText="Booking reference number"
                />
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Course Type"
                  value={templateData.courseType}
                  onChange={(e) => handleTemplateDataChange('courseType', e.target.value)}
                  helperText="e.g., CBT, TfL One-to-One, Full Licence Assessment"
                />
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Date"
                  value={templateData.date}
                  onChange={(e) => handleTemplateDataChange('date', e.target.value)}
                  helperText="Format: DD/MM/YYYY (e.g., 15/01/2025)"
                  placeholder="DD/MM/YYYY"
                />
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Time"
                  value={templateData.time}
                  onChange={(e) => handleTemplateDataChange('time', e.target.value)}
                  helperText="Format: 24-hour (e.g., 10:00, 14:30)"
                  placeholder="HH:MM"
                />
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Centre"
                  value={templateData.centre}
                  onChange={(e) => handleTemplateDataChange('centre', e.target.value)}
                  helperText="Training centre name (e.g., Wimbledon, Croydon)"
                />
              </Grid>
              
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Address (Optional)"
                  value={templateData.address}
                  onChange={(e) => handleTemplateDataChange('address', e.target.value)}
                  helperText="Full address of the training centre"
                  multiline
                  rows={2}
                />
              </Grid>
            </>
          )}
          
          {/* Result Display */}
          {result && (
            <Grid size={{ xs: 12 }}>
              <Alert 
                severity={result.success ? 'success' : 'error'}
                sx={{ mt: 2 }}
              >
                {result.message}
              </Alert>
            </Grid>
          )}
          
          {/* Action Buttons */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleReset}
                disabled={isLoading}
              >
                Reset Form
              </Button>
              <Button
                variant="contained"
                startIcon={isLoading ? <CircularProgress size={20} /> : <Send />}
                onClick={handleSendEmail}
                disabled={isLoading}
                sx={{ minWidth: 150 }}
              >
                {isLoading ? 'Sending...' : 'Send Test Email'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default EmailTestTab;

