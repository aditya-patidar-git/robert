import { BaseService } from './baseService';

/**
 * Drift Service
 * Handles knowledge base drift detection
 * @extends BaseService
 */
class DriftService extends BaseService {
  constructor() {
    super('/api/drift', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get drift status
   * @returns {Promise<Object>} Drift status
   */
  async getDriftStatus() {
    return this.get('/status');
  }

  /**
   * Start drift detection
   * @returns {Promise<Object>} Detection result
   */
  async startDriftDetection() {
    return this.post('/detect');
  }

  /**
   * Get files with drift
   * @returns {Promise<Array<Object>>} Array of files with drift
   */
  async getFilesWithDrift() {
    return this.get('/files');
  }

  /**
   * Clear drift flags
   * @param {Array<string>} fileIds - File IDs to clear flags for
   * @returns {Promise<Object>} Clear result
   */
  async clearDriftFlags(fileIds) {
    return this.post('/clear', { fileIds });
  }
}

// Export singleton instance
const driftService = new DriftService();
export default driftService;
