import { BaseService } from './baseService';

/**
 * File Search Service
 * Handles file search operations using OpenAI File Search
 * @extends BaseService
 */
class FileSearchService extends BaseService {
  constructor() {
    super('/api/file-search', {
      dataPath: 'data',
      normalizeResponse: true
    });
  }

  /**
   * Search files using OpenAI File Search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchFiles(query, options = {}) {
    const response = await this.post('/search', {
      query,
      ...options
    });
    return response.data?.data || response.data;
  }

  /**
   * Search files by tags
   * @param {string} query - Search query
   * @param {Array<string>} tags - Tags to filter by
   * @returns {Promise<Object>} Search results
   */
  async searchFilesByTags(query, tags = []) {
    const response = await this.post('/search-by-tags', {
      query,
      tags
    });
    return response.data?.data || response.data;
  }

  /**
   * Get file content by ID
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File content
   */
  async getFileContent(fileId) {
    const response = await this.get(`/file/${fileId}`);
    return response.data?.data || response.data;
  }

  /**
   * Get vector store status
   * @returns {Promise<Object>} Vector store status
   */
  async getVectorStoreStatus() {
    const response = await this.get('/vector-store/status');
    return response.data?.data || response.data;
  }

  /**
   * Test search functionality
   * @returns {Promise<Object>} Test result
   */
  async testSearch() {
    const response = await this.post('/test');
    return response.data?.data || response.data;
  }
}

// Export singleton instance
const fileSearchService = new FileSearchService();
export default fileSearchService;
