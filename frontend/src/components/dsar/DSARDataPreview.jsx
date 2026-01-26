import React, { useState } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, FormControlLabel, Chip, Button, Tooltip } from '@mui/material';
import { Preview } from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';

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

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {availableDataTypes.map((dataType) => (
          <Tooltip key={dataType.id} title={dataType.description} arrow>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedDataTypes.includes(dataType.id)}
                  onChange={() => handleDataTypeToggle(dataType.id)}
                  size="small"
                />
              }
              label={<Typography variant="body2">{dataType.label}</Typography>}
              sx={{ mr: 1 }}
            />
          </Tooltip>
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

      {data && data.sampleData && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Sample Data
          </Typography>
          
          {/* Transcripts Section */}
          {data.sampleData.transcripts?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                Transcripts ({data.sampleData.transcripts.length} sample{data.sampleData.transcripts.length > 1 ? 's' : ''})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Duration</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.sampleData.transcripts.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>{formatDateTime(item.date)}</TableCell>
                        <TableCell align="right">{item.duration}s</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Recordings Section */}
          {data.sampleData.recordings?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                Recordings ({data.sampleData.recordings.length} sample{data.sampleData.recordings.length > 1 ? 's' : ''})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Duration</TableCell>
                      <TableCell align="right">Size</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.sampleData.recordings.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>{formatDateTime(item.date)}</TableCell>
                        <TableCell align="right">{item.duration}s</TableCell>
                        <TableCell align="right">{item.size ? `${(item.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Metadata Section */}
          {data.sampleData.metadata?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                Metadata ({data.sampleData.metadata.length} sample{data.sampleData.metadata.length > 1 ? 's' : ''})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Key</TableCell>
                      <TableCell>Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.sampleData.metadata.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.key || item.id || `Item ${i + 1}`}</TableCell>
                        <TableCell>{typeof item.value === 'object' ? JSON.stringify(item.value) : (item.value || '-')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Call Records Section */}
          {data.sampleData.callRecords?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                Call Records ({data.sampleData.callRecords.length} sample{data.sampleData.callRecords.length > 1 ? 's' : ''})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Duration</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.sampleData.callRecords.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.id || item.callSid}</TableCell>
                        <TableCell>{formatDateTime(item.date || item.startTime)}</TableCell>
                        <TableCell>
                          <Chip label={item.status || 'N/A'} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{item.duration}s</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Show message if no sample data available */}
          {(!data.sampleData.transcripts?.length && 
            !data.sampleData.recordings?.length && 
            !data.sampleData.metadata?.length && 
            !data.sampleData.callRecords?.length) && (
            <Typography variant="body2" color="text.secondary">
              No sample data available for preview.
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default DSARDataPreview;

