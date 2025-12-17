import React, { useState } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, FormControlLabel, Chip, Button } from '@mui/material';
import { Preview } from '@mui/icons-material';

/**
 * DSARDataPreview Component
 * Preview data before export with data type selection
 */
const DSARDataPreview = ({ data, dataTypes: initialDataTypes = [], onDataTypeToggle, onPreview }) => {
  const [selectedDataTypes, setSelectedDataTypes] = useState(initialDataTypes.length > 0 ? initialDataTypes : ['all']);
  const [previewData, setPreviewData] = useState(null);

  const availableDataTypes = [
    { id: 'all', label: 'All Data', description: 'Include all available data' },
    { id: 'transcripts', label: 'Transcripts', description: 'Call transcripts' },
    { id: 'recordings', label: 'Recordings', description: 'Call recordings' },
    { id: 'metadata', label: 'Metadata', description: 'Call metadata' },
    { id: 'callRecords', label: 'Call Records', description: 'Call records' }
  ];

  const handleDataTypeToggle = (dataType) => {
    let newSelection;
    if (dataType === 'all') {
      newSelection = ['all'];
    } else {
      newSelection = selectedDataTypes.filter(dt => dt !== 'all');
      if (selectedDataTypes.includes(dataType)) {
        newSelection = newSelection.filter(dt => dt !== dataType);
      } else {
        newSelection.push(dataType);
      }
      if (newSelection.length === 0) {
        newSelection = ['all'];
      }
    }
    setSelectedDataTypes(newSelection);
    if (onDataTypeToggle) {
      onDataTypeToggle(newSelection);
    }
  };

  const handlePreview = () => {
    if (onPreview) {
      onPreview(selectedDataTypes);
    } else {
      // Mock preview
      setPreviewData({
        summary: {
          transcripts: 5,
          recordings: 3,
          metadata: 8,
          callRecords: 8
        }
      });
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom fontWeight="bold">
        Data Types Selection
      </Typography>

      <Box sx={{ mb: 2 }}>
        {availableDataTypes.map((dataType) => (
          <FormControlLabel
            key={dataType.id}
            control={
              <Checkbox
                checked={selectedDataTypes.includes(dataType.id)}
                onChange={() => handleDataTypeToggle(dataType.id)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">{dataType.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {dataType.description}
                </Typography>
              </Box>
            }
            sx={{ display: 'block', mb: 1 }}
          />
        ))}
      </Box>

      <Button
        variant="outlined"
        size="small"
        startIcon={<Preview />}
        onClick={handlePreview}
        sx={{ mb: 2 }}
      >
        Preview Data
      </Button>

      {previewData && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Data Summary
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data Type</TableCell>
                  <TableCell align="right">Record Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(previewData.summary || {}).map(([type, count]) => (
                  <TableRow key={type}>
                    <TableCell>{type}</TableCell>
                    <TableCell align="right">{count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {data && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Sample Data
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {JSON.stringify(data.sampleData || {}, null, 2).substring(0, 200)}...
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default DSARDataPreview;

