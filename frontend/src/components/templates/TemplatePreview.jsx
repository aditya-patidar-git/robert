import React from 'react';
import { Box, Paper, Typography, TextField, Button } from '@mui/material';
import { Preview } from '@mui/icons-material';
import templateService from '../../services/templateService';

/**
 * TemplatePreview Component
 * Preview template with sample variables
 */
const TemplatePreview = ({ template, type = 'email' }) => {
  const [previewData, setPreviewData] = React.useState(null);
  const [sampleVariables, setSampleVariables] = React.useState({});

  React.useEffect(() => {
    if (template) {
      // Initialize sample variables from template definition
      const vars = {};
      template.variables?.forEach((varDef) => {
        vars[varDef.name] = varDef.example || `[${varDef.name}]`;
      });
      setSampleVariables(vars);
    }
  }, [template]);

  const handlePreview = () => {
    if (!template) return;

    try {
      const rendered = templateService.renderTemplate(template, sampleVariables, type);
      setPreviewData({
        subject: type === 'email' ? templateService.renderTemplate(
          { ...template, body: template.subject },
          sampleVariables,
          type
        ) : null,
        body: rendered
      });
    } catch (error) {
      console.error('Preview error:', error);
    }
  };

  if (!template) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Select a template to preview
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          Preview
        </Typography>
        <Button
          size="small"
          startIcon={<Preview />}
          onClick={handlePreview}
          variant="outlined"
        >
          Generate Preview
        </Button>
      </Box>

      {template.variables && template.variables.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {template.variables.map((variable, index) => (
            <TextField
              key={index}
              label={variable.name}
              value={sampleVariables[variable.name] || ''}
              onChange={(e) => {
                setSampleVariables({
                  ...sampleVariables,
                  [variable.name]: e.target.value
                });
              }}
              size="small"
              fullWidth
              sx={{ mb: 1 }}
              helperText={variable.description}
            />
          ))}
        </Box>
      )}

      {previewData && (
        <Box>
          {previewData.subject && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Subject:</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                {previewData.subject}
              </Typography>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary">Body:</Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 0.5, 
              p: 1, 
              bgcolor: 'grey.100', 
              borderRadius: 1,
              whiteSpace: 'pre-wrap',
              minHeight: 100
            }}
          >
            {previewData.body}
          </Typography>
          {type === 'sms' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Character count: {previewData.body.length}/1600
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default TemplatePreview;

