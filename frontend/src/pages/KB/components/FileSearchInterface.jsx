import React from 'react';
import { Paper, Typography, Box, TextField, Button, List, ListItem, ListItemText } from '@mui/material';
import { Refresh } from '@mui/icons-material';

const FileSearchInterface = ({
  fileSearchQuery,
  setFileSearchQuery,
  fileSearchResults,
  fileSearchMutation,
  isSearching,
  handleFileSearch
}) => {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Knowledge Base Search
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Search across all knowledge base files using OpenAI File Search and Vector Search
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          fullWidth
          label="Search Query"
          value={fileSearchQuery}
          onChange={(e) => setFileSearchQuery(e.target.value)}
          placeholder="Search for information in knowledge base files..."
          onKeyPress={(e) => e.key === 'Enter' && handleFileSearch()}
        />
        <Button
          variant="contained"
          onClick={handleFileSearch}
          disabled={fileSearchMutation.isLoading || isSearching}
          startIcon={<Refresh />}
        >
          {fileSearchMutation.isLoading ? 'Searching...' : 'Search'}
        </Button>
      </Box>

      {/* Search Results */}
      {fileSearchResults.length > 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Search Results ({fileSearchResults.length})
          </Typography>
          <List>
            {fileSearchResults.map((result, index) => (
              <ListItem key={index} divider>
                <ListItemText
                  primary={result.fileName}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary" component="span">
                        Similarity: {(result.similarityScore * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" component="span" sx={{ mt: 1, display: 'block' }}>
                        {typeof result.content === 'string' ? result.content.substring(0, 200) + '...' : JSON.stringify(result.content).substring(0, 200) + '...'}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );
};

export default FileSearchInterface;



