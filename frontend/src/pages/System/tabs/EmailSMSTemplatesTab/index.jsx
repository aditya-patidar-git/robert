import React, { useState } from 'react';
import { Box, Paper, Tabs, Tab, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Typography, Chip } from '@mui/material';
import { Add, Save, Cancel } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../components/common/ToastProvider';
import emailTemplateService from '../../../../services/emailTemplateService';
import smsTemplateService from '../../../../services/smsTemplateService';
import useTemplateEditor from '../../../../hooks/useTemplateEditor';
import TemplateList from '../../../../components/templates/TemplateList';
import TemplateEditor from '../../../../components/templates/TemplateEditor';
import VariableReferencePanel from '../../../../components/templates/VariableReferencePanel';
import TemplatePreview from '../../../../components/templates/TemplatePreview';

/**
 * EmailSMSTemplatesTab Component
 * Main tab with email and SMS template management
 */
const EmailSMSTemplatesTab = () => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState(0); // 0 = Email, 1 = SMS
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  const templateType = activeSubTab === 0 ? 'email' : 'sms';
  const templateService = activeSubTab === 0 ? emailTemplateService : smsTemplateService;
  const templateEditor = useTemplateEditor(templateService, templateType);

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: [`${templateType}-templates`],
    queryFn: () => templateService.list()
  });

  const templates = templatesData?.templates || [];

  // Form for editing
  const { control, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      name: '',
      category: '',
      courseType: 'all',
      subject: '',
      body: '',
      variables: [],
      isActive: true
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (selectedTemplate?._id || selectedTemplate?.id) {
        return await templateService.update(selectedTemplate._id || selectedTemplate.id, data);
      } else {
        return await templateService.create(data);
      }
    },
    onSuccess: () => {
      showSuccess('Template saved successfully');
      queryClient.invalidateQueries([`${templateType}-templates`]);
      setEditDialogOpen(false);
      setSelectedTemplate(null);
      reset();
    },
    onError: (error) => {
      showError(error.message || 'Failed to save template');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await templateService.delete(id);
    },
    onSuccess: () => {
      showSuccess('Template deleted successfully');
      queryClient.invalidateQueries([`${templateType}-templates`]);
    },
    onError: (error) => {
      showError(error.message || 'Failed to delete template');
    }
  });

  // Test send mutation
  const testSendMutation = useMutation({
    mutationFn: async ({ id, recipient }) => {
      return await templateService.testSend(id, recipient);
    },
    onSuccess: () => {
      showSuccess('Test sent successfully');
      setTestDialogOpen(false);
      setTestRecipient('');
    },
    onError: (error) => {
      showError(error.message || 'Failed to send test');
    }
  });

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    reset({
      name: '',
      category: '',
      courseType: 'all',
      subject: '',
      body: '',
      variables: [],
      isActive: true
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    reset({
      name: template.name || '',
      category: template.category || '',
      courseType: template.courseType || 'all',
      subject: template.subject || '',
      body: template.body || '',
      variables: template.variables || [],
      isActive: template.isActive !== false
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (template) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      deleteMutation.mutate(template._id || template.id);
    }
  };

  const handleTest = (template) => {
    setSelectedTemplate(template);
    setTestDialogOpen(true);
  };

  const handleTestSend = () => {
    if (!testRecipient) {
      showError('Please enter a recipient');
      return;
    }
    testSendMutation.mutate({
      id: selectedTemplate._id || selectedTemplate.id,
      recipient: testRecipient
    });
  };

  const onSubmit = (data) => {
    saveMutation.mutate(data);
  };

  const currentTemplate = watch();
  const templateForPreview = selectedTemplate || currentTemplate;

  return (
    <Box>
      {/* Sub-tabs for Email/SMS */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeSubTab}
          onChange={(e, newValue) => {
            setActiveSubTab(newValue);
            setSelectedTemplate(null);
            reset();
          }}
        >
          <Tab label="Email Templates" />
          <Tab label="SMS Templates" />
        </Tabs>
      </Paper>

      {/* Template List */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {templateType === 'email' ? 'Email' : 'SMS'} Templates ({templates.length})
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateNew}
          >
            Create New Template
          </Button>
        </Box>

        {isLoading ? (
          <Box>Loading...</Box>
        ) : (
          <TemplateList
            templates={templates}
            onSelect={handleEdit}
            onDelete={handleDelete}
            onTest={handleTest}
          />
        )}
      </Paper>

      {/* Edit/Create Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedTemplate(null);
          reset();
        }}
        maxWidth="lg"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedTemplate ? 'Edit Template' : 'Create New Template'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: 'Name is required' }}
                  render={({ field, fieldState: { error } }) => (
                    <TextField
                      {...field}
                      label="Template Name"
                      fullWidth
                      error={!!error}
                      helperText={error?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: 'Category is required' }}
                  render={({ field, fieldState: { error } }) => (
                    <FormControl fullWidth error={!!error}>
                      <InputLabel>Category</InputLabel>
                      <Select {...field} label="Category">
                        <MenuItem value="booking_confirmation">Booking Confirmation</MenuItem>
                        <MenuItem value="booking_cancellation">Booking Cancellation</MenuItem>
                        <MenuItem value="payment_link">Payment Link</MenuItem>
                        <MenuItem value="terms_conditions">Terms & Conditions</MenuItem>
                        <MenuItem value="custom">Custom</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="courseType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Course Type</InputLabel>
                      <Select {...field} label="Course Type">
                        <MenuItem value="all">All Courses</MenuItem>
                        <MenuItem value="ITM">ITM</MenuItem>
                        <MenuItem value="CBT">CBT</MenuItem>
                        <MenuItem value="CBT_EXECUTIVE">CBT Executive</MenuItem>
                        <MenuItem value="PRIVATE_LESSON">Private Lesson</MenuItem>
                        <MenuItem value="GEAR_CONVERSION">Gear Conversion</MenuItem>
                        <MenuItem value="TFL_1_2_1">TfL 1-2-1</MenuItem>
                        <MenuItem value="TFL_BEYOND_CBT">TfL Beyond CBT</MenuItem>
                        <MenuItem value="FULL_LICENCE_ASSESSMENT">Full Licence Assessment</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TemplateEditor
                  control={control}
                  type={templateType}
                  variables={currentTemplate.variables || []}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <VariableReferencePanel
                  variables={currentTemplate.variables || []}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TemplatePreview
                  template={templateForPreview}
                  type={templateType}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedTemplate(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              disabled={saveMutation.isLoading}
            >
              {saveMutation.isLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog
        open={testDialogOpen}
        onClose={() => {
          setTestDialogOpen(false);
          setTestRecipient('');
        }}
      >
        <DialogTitle>Send Test {templateType === 'email' ? 'Email' : 'SMS'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={templateType === 'email' ? 'Recipient Email' : 'Recipient Phone'}
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder={templateType === 'email' ? 'email@example.com' : '+44123456789'}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setTestDialogOpen(false);
            setTestRecipient('');
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleTestSend}
            disabled={testSendMutation.isLoading || !testRecipient}
          >
            {testSendMutation.isLoading ? 'Sending...' : 'Send Test'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailSMSTemplatesTab;

