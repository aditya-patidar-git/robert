import authenticatedApiClient from '../api/authenticatedApi.js';

const vectorStoreService = {

  // Get vector store status
  async getStatus() {
    // Use the working endpoint that Knowledge Base Management tab uses
    const response = await authenticatedApiClient.get('/api/kb/vector-store/status');
    console.log("Response:",response)
    const data = response.data;
    
    // The openaiFilesService.getVectorStoreStatus() returns the data directly
    // so data.vectorStore contains: { id, name, status, fileCount, created_at, files }
    return {
      id: data.vectorStore?.id,
      status: data.vectorStore?.status,
      fileCount: data.vectorStore?.fileCount,
      name: data.vectorStore?.name,
      created_at: data.vectorStore?.created_at,
      lastUpdated: new Date().toISOString(),
      vectorStoreId: data.vectorStore?.id
    };
  },

  // Search vector store
  async search(query, fileIds = null, limit = 5) {
    const response = await authenticatedApiClient.get('/api/vector-store/search', {
      params: { query, fileIds: fileIds?.join(','), limit }
    });
    return response.data.results || response.data;
  },

  // Test file search
  async testSearch(query, fileIds = null) {
    const response = await authenticatedApiClient.post('/api/vector-store/test-search', {
      query,
      fileIds
    });
    return response.data.results || response.data;
  },



  // Start migration
  async startMigration() {
    const response = await authenticatedApiClient.post('/api/vector-store/migrate');
    return response.data.migration || response.data;
  },

  // Get migration status
  async getMigrationStatus() {
    const response = await authenticatedApiClient.get('/api/vector-store/migration/status');
    return response.data.migration || response.data;
  },

  // Sync file
  async syncFile(fileId) {
    const response = await authenticatedApiClient.post(`/api/vector-store/sync/${fileId}`);
    return response.data.sync || response.data;
  },

  // Validate vector store
  async validate() {
    const response = await authenticatedApiClient.get('/api/vector-store/validate');
    return response.data.validation || response.data;
  },

  // Cleanup orphaned files
  async cleanup() {
    const response = await authenticatedApiClient.post('/api/vector-store/cleanup');
    return response.data.cleanup || response.data;
  }
};

export default vectorStoreService;
