import { BaseService } from './baseService';

/**
 * KB Mapping Service
 * Handles file-URL mappings for KB drift detection
 * @extends BaseService
 */
class KBMappingService extends BaseService {
  constructor() {
    super('/api/kb/mappings', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get all mappings
   * @returns {Promise<Array>} Array of mappings
   */
  async getAllMappings() {
    return this.get('/');
  }

  /**
   * Get mapping by file ID
   * @param {string} fileId - KB file ID
   * @returns {Promise<Object>} Mapping object
   */
  async getMappingByFileId(fileId) {
    return this.get(`/file/${fileId}`);
  }

  /**
   * Save mapping (create or update)
   * @param {Object} mappingData - Mapping data
   * @returns {Promise<Object>} Saved mapping
   */
  async saveMapping(mappingData) {
    const { fileId, ...data } = mappingData;
    if (fileId) {
      return this.put(`/${fileId}`, data);
    }
    return this.post('/', data);
  }

  /**
   * Delete mapping
   * @param {string} fileId - KB file ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteMapping(fileId) {
    return this.delete(`/${fileId}`);
  }

  /**
   * Bulk import mappings
   * @param {Array} mappings - Array of mapping objects
   * @returns {Promise<Object>} Import result
   */
  async bulkImportMappings(mappings) {
    return this.post('/bulk-import', { mappings });
  }

  /**
   * Export mappings
   * @returns {Promise<Array>} Array of mappings
   */
  async exportMappings() {
    return this.get('/export');
  }

  /**
   * Sync mappings with database
   * @returns {Promise<Object>} Sync result
   */
  async syncWithDatabase() {
    return this.post('/sync');
  }

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateUrl(url) {
    return this.post('/validate-url', { url });
  }

  /**
   * Test mapping
   * @param {string} fileId - KB file ID
   * @returns {Promise<Object>} Test result
   */
  async testMapping(fileId) {
    return this.post(`/test/${fileId}`);
  }
}

// Export singleton instance
const kbMappingService = new KBMappingService();
export default kbMappingService;

