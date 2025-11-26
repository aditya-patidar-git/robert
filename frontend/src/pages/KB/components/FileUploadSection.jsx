import React from 'react';
import { Paper, Typography, Box, Button, Alert, Chip } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

const FileUploadSection = ({
  tagOptions,
  selectedTags,
  setSelectedTags,
  uploadFileMutation,
  handleFileUpload
}) => {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload Knowledge Base Files
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Supported formats: PDF, TXT, MD, HTML, DOC, DOCX (Max 25MB per file). Files are uploaded to OpenAI and added to the vector store.
      </Alert>
      
      {/* Tag Selection */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Select Tags (optional)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {tagOptions.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              onClick={() => {
                setSelectedTags(prev => 
                  prev.includes(tag) 
                    ? prev.filter(t => t !== tag)
                    : [...prev, tag]
                );
              }}
              color={selectedTags.includes(tag) ? 'primary' : 'default'}
              variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
        {selectedTags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Selected:
            </Typography>
            {selectedTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={() => {
                  setSelectedTags(prev => prev.filter(t => t !== tag));
                }}
                color="primary"
              />
            ))}
          </Box>
        )}
      </Box>

      <Button
        variant="contained"
        component="label"
        startIcon={<CloudUpload />}
        disabled={uploadFileMutation.isLoading}
      >
        Upload File
        <input
          type="file"
          hidden
          accept=".pdf,.html,.md,.txt,.doc,.docx"
          onChange={handleFileUpload}
        />
      </Button>
    </Paper>
  );
};

export default FileUploadSection;



