import { BaseService } from './baseService';

/**
 * Reingest Service
 * Handles knowledge base file reingestion
 * @extends BaseService
 */
class ReingestService extends BaseService {
  constructor() {
    super('/api/reingest', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get reingest status
   * @returns {Promise<Object>} Reingest status
   */
  async getReingestStatus() {
    return this.get('/status');
  }

  /**
   * Start reingest
   * @param {Array<string>|null} fileIds - Optional file IDs to reingest
   * @returns {Promise<Object>} Reingest result
   */
  async startReingest(fileIds = null) {
    return this.post('/start', { fileIds });
  }

  /**
   * Get files needing reingest
   * @returns {Promise<Array<Object>>} Array of files needing reingest
   */
  async getFilesNeedingReingest() {
    return this.get('/files');
  }

  /**
   * Schedule reingest
   * @param {Array<string>} fileIds - File IDs to reingest
   * @param {number} delay - Delay in seconds (default: 0)
   * @returns {Promise<Object>} Schedule result
   */
  async scheduleReingest(fileIds, delay = 0) {
    return this.post('/schedule', { fileIds, delay });
  }
}

// Export singleton instance
const reingestService = new ReingestService();
export default reingestService;
