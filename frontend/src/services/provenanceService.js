import { BaseService } from './baseService';

/**
 * Provenance Service
 * Handles data provenance tracking and analytics
 * @extends BaseService
 */
class ProvenanceService extends BaseService {
  constructor() {
    super('/api/provenance', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Track file usage
   * @param {Object} data - Usage data
   * @returns {Promise<Object>} Tracking result
   */
  async trackFileUsage(data) {
    return this.post('/track', data);
  }

  /**
   * Get call provenance
   * @param {string} callId - Call ID
   * @returns {Promise<Object>} Call provenance data
   */
  async getCallProvenance(callId) {
    return this.get(`/call/${callId}`);
  }

  /**
   * Get file provenance
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File provenance data
   */
  async getFileProvenance(fileId) {
    return this.get(`/file/${fileId}`);
  }

  /**
   * Get provenance analytics
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Object>} Analytics data
   */
  async getProvenanceAnalytics(filters = {}) {
    return this.get('/analytics', filters);
  }

  /**
   * Get file usage stats
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Usage statistics
   */
  async getFileUsageStats(fileId) {
    return this.get(`/stats/${fileId}`);
  }

  /**
   * Export provenance data
   * @param {string} userId - User ID
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<Object>} Exported data
   */
  async exportProvenanceData(userId, startDate, endDate) {
    return this.get('/export', { userId, startDate, endDate });
  }

  /**
   * Cleanup old records
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldRecords() {
    return this.post('/cleanup');
  }
}

// Export singleton instance
const provenanceService = new ProvenanceService();
export default provenanceService;
