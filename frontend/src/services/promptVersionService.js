import { BaseService } from './baseService';

/**
 * Prompt Version Service
 * Handles prompt versioning, comparison, and rollback
 * @extends BaseService
 */
class PromptVersionService extends BaseService {
  constructor() {
    super('/api/admin/ai/prompt/versions', {
      dataPath: 'versions',
      normalizeResponse: true
    });
  }

  /**
   * Get all prompt versions
   * @param {string} promptId - Prompt ID (default: 'global')
   * @returns {Promise<Array<Object>>} Array of version objects
   */
  async getPromptVersions(promptId = 'global') {
    const response = await this.get('', { promptId });
    return response.data?.versions || response.data || [];
  }

  /**
   * Get specific version by ID
   * @param {string} versionId - Version ID
   * @returns {Promise<Object>} Version object
   */
  async getPromptVersion(versionId) {
    const response = await this.get(`/${versionId}`);
    return response.data?.version || response.data;
  }

  /**
   * Get current active version
   * @param {string} promptId - Prompt ID (default: 'global')
   * @returns {Promise<Object>} Current version object
   */
  async getCurrentVersion(promptId = 'global') {
    const response = await this.get('/current', { promptId });
    return response.data?.version || response.data;
  }

  /**
   * Compare two versions
   * @param {string} versionId1 - First version ID
   * @param {string} versionId2 - Second version ID
   * @returns {Promise<Object>} Comparison result
   */
  async compareVersions(versionId1, versionId2) {
    const response = await this.get(`/compare/${versionId1}/${versionId2}`);
    return response.data?.comparison || response.data;
  }

  /**
   * Activate a specific version
   * @param {string} versionId - Version ID to activate
   * @returns {Promise<Object>} Activation result
   */
  async activateVersion(versionId) {
    return this.put(`/${versionId}/activate`);
  }

  /**
   * Rollback to specific version
   * @param {string} versionId - Version ID to rollback to
   * @param {string} changeReason - Reason for rollback (default: '')
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackToVersion(versionId, changeReason = '') {
    return this.post(`/${versionId}/rollback`, { changeReason });
  }

  /**
   * Clear all inactive versions
   * @param {string} promptId - Prompt ID (default: 'global')
   * @returns {Promise<Object>} Clear result
   */
  async clearInactiveVersions(promptId = 'global') {
    return this.delete('/clear-inactive', { params: { promptId } });
  }
}

// Export singleton instance
const promptVersionService = new PromptVersionService();
export default promptVersionService;
