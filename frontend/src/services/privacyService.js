import { BaseService } from './baseService';

/**
 * Privacy Service
 * Handles GDPR compliance, DSAR requests, data retention, and privacy management
 * @extends BaseService
 */
class PrivacyService extends BaseService {
  constructor() {
    super('/api/gdpr', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Create DSAR (Data Subject Access Request) request
   * @param {Object} requestData - DSAR request data
   * @returns {Promise<Object>} Created DSAR request
   */
  async createDSARRequest(requestData) {
    return this.post('/dsar', requestData);
  }

  /**
   * Get all DSAR requests
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Array<Object>>} Array of DSAR requests
   */
  async getAllDSARRequests(filters = {}) {
    return this.get('/dsar', filters);
  }

  /**
   * Update DSAR request status
   * @param {string} requestId - Request ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated request
   */
  async updateDSARRequest(requestId, status) {
    return this.patch(`/dsar/${requestId}`, { status });
  }

  /**
   * Process DSAR request
   * @param {string} dsarId - DSAR ID
   * @param {string} action - Action to perform
   * @param {string} adminUser - Admin user processing the request
   * @returns {Promise<Object>} Processing result
   */
  async processDSARRequest(dsarId, action, adminUser) {
    return this.post(`/dsar/${dsarId}/process`, {
      action,
      adminUser
    });
  }

  /**
   * Export user data
   * @param {string} userId - User ID
   * @param {Array<string>} dataTypes - Data types to export (default: ['transcripts', 'recordings', 'metadata'])
   * @returns {Promise<Blob>} Exported data (Blob)
   */
  async exportUserData(userId, dataTypes = ['transcripts', 'recordings', 'metadata']) {
    const response = await this.post(`/export/${userId}`, { dataTypes }, {
      responseType: 'blob',
      normalizeResponse: false // Don't normalize blob responses
    });
    return response.data;
  }

  /**
   * Delete user data
   * @param {string} userId - User ID
   * @param {Array<string>} dataTypes - Data types to delete (default: ['all'])
   * @returns {Promise<Object>} Deletion result
   */
  async deleteUserData(userId, dataTypes = ['all']) {
    return this.delete(`/delete/${userId}`, {
      data: { dataTypes }
    });
  }

  /**
   * Get privacy audit logs
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Array<Object>>} Array of audit log entries
   */
  async getAuditLogs(filters = {}) {
    return this.get('/audit-logs', filters);
  }

  /**
   * Check retention policies
   * @returns {Promise<Object>} Retention policies status
   */
  async checkRetentionPolicies() {
    return this.get('/retention-policies');
  }

  /**
   * Cleanup expired data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupExpiredData() {
    return this.post('/cleanup-expired');
  }

  /**
   * Generate compliance report
   * @param {string} period - Report period (default: 'monthly')
   * @returns {Promise<Object>} Compliance report
   */
  async generateComplianceReport(period = 'monthly') {
    return this.get('/compliance-report', { period });
  }

  /**
   * Generate Privacy Impact Assessment
   * @param {Object} processingActivity - Processing activity data
   * @returns {Promise<Object>} Privacy Impact Assessment
   */
  async generatePrivacyImpactAssessment(processingActivity) {
    return this.post('/privacy-impact-assessment', {
      processingActivity
    });
  }

  /**
   * Report data breach
   * @param {Object} breachData - Breach data
   * @returns {Promise<Object>} Breach report result
   */
  async reportDataBreach(breachData) {
    return this.post('/data-breach', {
      breachData
    });
  }

  /**
   * Mask PII (Personally Identifiable Information)
   * @param {string} text - Text to mask
   * @param {string} maskType - Mask type ('partial' or 'full', default: 'partial')
   * @returns {Promise<Object>} Masked text
   */
  async maskPII(text, maskType = 'partial') {
    return this.post('/mask-pii', {
      text,
      maskType
    });
  }

  /**
   * Record consent
   * @param {string} callSid - Call SID
   * @param {string} consentType - Consent type
   * @param {boolean} granted - Whether consent was granted
   * @returns {Promise<Object>} Consent record
   */
  async recordConsent(callSid, consentType, granted) {
    return this.post('/consent', {
      callSid,
      consentType,
      granted
    });
  }

  /**
   * Check consent
   * @param {string} callSid - Call SID
   * @param {string} consentType - Consent type
   * @returns {Promise<Object>} Consent status
   */
  async checkConsent(callSid, consentType) {
    return this.get(`/consent/${callSid}/${consentType}`);
  }
}

// Export singleton instance
const privacyService = new PrivacyService();
export default privacyService;
