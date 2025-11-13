import { BaseService } from './baseService';

/**
 * Vector Store Service
 * Handles vector store operations, migration, and validation
 * @extends BaseService
 */
class VectorStoreService extends BaseService {
  constructor() {
    super('/api/kb', {
      dataPath: 'vectorStore',
      normalizeResponse: true
    });
  }

  /**
   * Get vector store status
   * @returns {Promise<Object>} Vector store status
   */
  async getStatus() {
    const response = await this.get('/vector-store/status');
    const data = response.data?.vectorStore || response.data;
    
    return {
      id: data?.id,
      status: data?.status,
      fileCount: data?.fileCount,
      name: data?.name,
      created_at: data?.created_at,
      lastUpdated: new Date().toISOString(),
      vectorStoreId: data?.id
    };
  }

  /**
   * Search vector store
   * @param {string} query - Search query
   * @param {Array<string>|null} fileIds - Optional file IDs to search within
   * @param {number} limit - Result limit (default: 5)
   * @returns {Promise<Array<Object>>} Search results
   */
  async search(query, fileIds = null, limit = 5) {
    const params = { query, limit };
    if (fileIds) params.fileIds = fileIds.join(',');
    
    // Use different endpoint for vector store search
    const response = await this.client.get('/api/vector-store/search', { params });
    return response.data?.results || response.data || [];
  }

  /**
   * Test file search
   * @param {string} query - Search query
   * @param {Array<string>|null} fileIds - Optional file IDs
   * @returns {Promise<Array<Object>>} Test results
   */
  async testSearch(query, fileIds = null) {
    const response = await this.client.post('/api/vector-store/test-search', {
      query,
      fileIds
    });
    return response.data?.results || response.data || [];
  }

  /**
   * Start migration
   * @returns {Promise<Object>} Migration result
   */
  async startMigration() {
    const response = await this.client.post('/api/vector-store/migrate');
    return response.data?.migration || response.data;
  }

  /**
   * Get migration status
   * @returns {Promise<Object>} Migration status
   */
  async getMigrationStatus() {
    const response = await this.client.get('/api/vector-store/migration/status');
    return response.data?.migration || response.data;
  }

  /**
   * Sync file
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Sync result
   */
  async syncFile(fileId) {
    const response = await this.client.post(`/api/vector-store/sync/${fileId}`);
    return response.data?.sync || response.data;
  }

  /**
   * Validate vector store
   * @returns {Promise<Object>} Validation result
   */
  async validate() {
    const response = await this.client.get('/api/vector-store/validate');
    return response.data?.validation || response.data;
  }

  /**
   * Cleanup orphaned files
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanup() {
    const response = await this.client.post('/api/vector-store/cleanup');
    return response.data?.cleanup || response.data;
  }
}

// Export singleton instance
const vectorStoreService = new VectorStoreService();
export default vectorStoreService;
