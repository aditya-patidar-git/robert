import React from 'react';
import { Paper, Typography, Box, TextField, Button, List, ListItem, Chip } from '@mui/material';
import { Refresh } from '@mui/icons-material';

const FileSearchInterface = ({
  fileSearchQuery,
  setFileSearchQuery,
  fileSearchResults,
  fileSearchMutation,
  isSearching,
  handleFileSearch
}) => {
  // Get similarity score safely
  const getSimilarityScore = (result) => {
    const score = result.averageSimilarityScore ?? result.similarityScore ?? result.similarity_score;
    if (score === null || score === undefined || isNaN(score)) {
      return null;
    }
    // Ensure score is between 0 and 1, then convert to percentage
    const normalizedScore = Math.max(0, Math.min(1, Number(score)));
    return (normalizedScore * 100).toFixed(1);
  };

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
          onKeyPress={(e) => {
            if (e.key === 'Enter' && fileSearchQuery.trim() && !fileSearchMutation.isLoading && !isSearching) {
              handleFileSearch();
            }
          }}
        />
        <Button
          variant="contained"
          onClick={handleFileSearch}
          disabled={!fileSearchQuery.trim() || fileSearchMutation.isLoading || isSearching}
          startIcon={<Refresh />}
        >
          {fileSearchMutation.isLoading || isSearching ? 'Searching...' : 'Search'}
        </Button>
      </Box>

      {/* Search Results */}
      {fileSearchResults.length > 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Search Results ({fileSearchResults.length} {fileSearchResults.length === 1 ? 'file' : 'files'})
          </Typography>
          <List>
            {fileSearchResults.map((result, index) => {
              const similarityScore = getSimilarityScore(result);
              
              return (
                <ListItem key={result.fileId || index} divider sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
                  <Box sx={{ width: '100%', mb: 1.5 }}>
                    <Typography variant="subtitle2" component="div" sx={{ fontWeight: 600, mb: 1 }}>
                      {result.fileName || 'Unknown File'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {similarityScore !== null && (
                        <Chip 
                          label={`Similarity: ${similarityScore}%`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {result.matchCount !== undefined && (
                        <Chip 
                          label={`${result.matchCount} ${result.matchCount === 1 ? 'match' : 'matches'}`}
                          size="small"
                          color="default"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ 
                    width: '100%', 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200'
                  }}>
                    <Typography 
                      variant="body2" 
                      component="div"
                      sx={{ 
                        color: 'text.primary',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.7
                      }}
                    >
                      {result.summary || 'No summary available.'}
                    </Typography>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}
    </Paper>
  );
};

export default FileSearchInterface;



