import { BaseService } from './baseService';

/**
 * Knowledge Base Service
 * Handles file management, search, and vector store operations
 * @extends BaseService
 */
class KBService extends BaseService {
  constructor() {
    super('/api/kb', {
      dataPath: 'files',
      normalizeResponse: true
    });
  }

  /**
   * Get all files from OpenAI
   * @returns {Promise<Array<Object>>} Array of file objects
   */
  async getAllFiles() {
    const response = await this.get('/files');
    return response.data || [];
  }

  /**
   * Get file by ID
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File object
   */
  async getFile(fileId) {
    const response = await this.get(`/files/${fileId}`);
    return response.data?.file || response.data;
  }

  /**
   * Upload file to OpenAI
   * @param {File} file - File to upload
   * @param {Array<string>} tags - File tags
   * @returns {Promise<Object>} Uploaded file object
   */
  async uploadFile(file, tags = []) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tags', JSON.stringify(tags));

    const response = await this.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      normalizeResponse: false // Don't normalize FormData responses
    });
    return response.data?.file || response.data;
  }

  /**
   * Delete file from OpenAI
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(fileId) {
    return this.delete(`/files/${fileId}`);
  }

  /**
   * Search files using OpenAI File Search
   * @param {string} query - Search query
   * @param {Array<string>|null} fileIds - Optional file IDs to search within
   * @returns {Promise<Object>} Search results
   */
  async searchFiles(query, fileIds = null) {
    return this.post('/search', {
      query,
      fileIds
    });
  }

  /**
   * Get vector store status
   * @returns {Promise<Object>} Vector store status
   */
  async getVectorStoreStatus() {
    const response = await this.get('/vector-store/status');
    return response.data?.vectorStore || response.data;
  }

  /**
   * Get file content for viewing
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File content
   */
  async getFileContent(fileId) {
    const response = await this.get(`/files/${fileId}/content`);
    return response.data?.content || response.data;
  }

  /**
   * Update file tags
   * @param {string} fileId - File ID
   * @param {Array<string>} tags - New tags
   * @returns {Promise<Object>} Updated file object
   */
  async updateFileTags(fileId, tags) {
    const response = await this.put(`/files/${fileId}/tags`, {
      tags: Array.isArray(tags) ? tags : []
    });
    return response.data?.file || response.data;
  }

  /**
   * Re-ingest a single file
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Re-ingestion result
   */
  async reingestFile(fileId) {
    return this.post(`/files/${fileId}/reingest`);
  }

  /**
   * Detect drift for a single file
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Drift detection result
   */
  async detectFileDrift(fileId) {
    const response = await this.post(`/files/${fileId}/detect-drift`);
    return response.data?.drift || response.data;
  }
}

// Export singleton instance
const kbService = new KBService();
export default kbService;
