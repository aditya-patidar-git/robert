import authenticatedApiClient from '../api/authenticatedApi.js';

const fileSearchService = {
  // Search files using OpenAI File Search
  async searchFiles(query, options = {}) {
    const response = await authenticatedApiClient.post('/api/file-search/search', {
      query,
      ...options
    });
    return response.data.data;
  },

  // Search files by tags
  async searchFilesByTags(query, tags = []) {
    const response = await authenticatedApiClient.post('/api/file-search/search-by-tags', {
      query,
      tags
    });
    return response.data.data;
  },

  // Get file content by ID
  async getFileContent(fileId) {
    const response = await authenticatedApiClient.get(`/api/file-search/file/${fileId}`);
    return response.data.data;
  },

  // Get vector store status
  async getVectorStoreStatus() {
    const response = await authenticatedApiClient.get('/api/file-search/vector-store/status');
    return response.data.data;
  },

  // Test search functionality
  async testSearch() {
    const response = await authenticatedApiClient.post('/api/file-search/test');
    return response.data.data;
  }
};

export default fileSearchService;





