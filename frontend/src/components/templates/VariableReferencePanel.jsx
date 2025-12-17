import React from 'react';
import { Box, Paper, Typography, Chip, Button } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { useToast } from '../common/ToastProvider';

/**
 * VariableReferencePanel Component
 * Shows available template variables with insert functionality
 */
const VariableReferencePanel = ({ variables = [], onInsertVariable }) => {
  const { showSuccess } = useToast();

  const handleInsert = (varName) => {
    const placeholder = `{{${varName}}}`;
    if (onInsertVariable) {
      onInsertVariable(placeholder);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(placeholder);
      showSuccess(`Copied ${placeholder} to clipboard`);
    }
  };

  if (!variables || variables.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No variables defined for this template
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom fontWeight="bold">
        Available Variables
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {variables.map((variable, index) => (
          <Chip
            key={index}
            label={`{{${variable.name}}}`}
            onClick={() => handleInsert(variable.name)}
            onDelete={() => handleInsert(variable.name)}
            deleteIcon={<ContentCopy fontSize="small" />}
            variant="outlined"
            size="small"
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>
      {variables.some(v => v.description) && (
        <Box sx={{ mt: 2 }}>
          {variables.map((variable, index) => (
            variable.description && (
              <Typography key={index} variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                <strong>{`{{${variable.name}}}`}</strong>: {variable.description}
                {variable.example && ` (e.g., ${variable.example})`}
              </Typography>
            )
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default VariableReferencePanel;

