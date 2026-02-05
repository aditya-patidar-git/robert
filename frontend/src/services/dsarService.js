import { BaseService } from './baseService';

/**
 * DSAR Service
 * Handles Data Subject Access Request operations
 * @extends BaseService
 */
class DSARService extends BaseService {
  constructor() {
    super('/api/gdpr/dsar', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get all DSAR requests (admin only)
   * @param {Object} params - Query parameters (status, requestType, requestorEmail)
   * @returns {Promise<Object>} DSAR requests
   */
  async getDSARRequests(params = {}) {
    return this.get('', params);
  }

  /**
   * Create DSAR request (public)
   * @param {Object} requestData - Request data (requestorEmail, requestType, userIdentifier, requestorPhone)
   * @returns {Promise<Object>} Created request
   */
  async createDSARRequest(requestData) {
    return this.post('', requestData);
  }

  /**
   * Verify DSAR request (public)
   * @param {string} requestId - Request ID
   * @param {string} verificationCode - Verification code
   * @returns {Promise<Object>} Verification result
   */
  async verifyDSARRequest(requestId, verificationCode) {
    return this.post(`/${requestId}/verify`, { verificationCode });
  }

  /**
   * Get DSAR request status (public)
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Request status
   */
  async getDSARRequestStatus(requestId) {
    return this.get(`/${requestId}/status`);
  }

  /**
   * Get DSAR request details (admin only)
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Request details
   */
  async getDSARRequestDetails(requestId) {
    return this.get(`/${requestId}`);
  }

  /**
   * Preview DSAR data (admin only)
   * @param {string} requestId - Request ID
   * @param {Array} dataTypes - Data types to preview
   * @returns {Promise<Object>} Data preview
   */
  async previewDSARData(requestId, dataTypes = ['all']) {
    return this.post(`/${requestId}/preview`, { dataTypes });
  }

  /**
   * Generate DSAR export (admin only)
   * @param {string} requestId - Request ID
   * @param {boolean} maskPII - Whether to mask PII
   * @returns {Promise<Object>} Export result
   */
  async generateDSARExport(requestId, maskPII = false) {
    return this.post(`/${requestId}/export`, { maskPII });
  }

  /**
   * Process DSAR request (admin only)
   * @param {string} requestId - Request ID
   * @param {string} action - Action (approve, reject, complete)
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} Processing result
   */
  async processDSARRequest(requestId, action, notes = '') {
    return this.put(`/${requestId}/process`, { action, notes });
  }

  /**
   * Download DSAR export (public)
   * @param {string} requestId - Request ID
   * @param {string} fileName - Export file name
   * @returns {Promise<Blob>} Export file
   */
  async downloadDSARExport(requestId, fileName) {
    const response = await this.client.get(`/api/gdpr/dsar/${requestId}/export/${fileName}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // ============================================
  // Alias methods for backward compatibility
  // ============================================

  /**
   * Alias for createDSARRequest
   * @param {Object} requestData - Request data
   * @returns {Promise<Object>} Created request
   */
  async createRequest(requestData) {
    // Map frontend field names to backend expected names
    const mappedData = {
      requestorEmail: requestData.requestorEmail || requestData.subjectEmail,
      requestorName: requestData.requestorName || '',
      requestorPhone: requestData.requestorPhone || requestData.subjectPhone,
      requestType: this.mapRequestType(requestData.requestType),
      requestedDataTypes: requestData.requestedDataTypes || ['all'],
      userIdentifier: requestData.userIdentifier || requestData.requestorEmail || requestData.subjectEmail,
      description: requestData.description
    };
    return this.createDSARRequest(mappedData);
  }

  /**
   * Alias for processDSARRequest - updates request status
   * @param {string} requestId - Request ID
   * @param {Object} data - Update data containing status/action
   * @returns {Promise<Object>} Updated request
   */
  async updateRequest(requestId, data) {
    // Map status updates to process actions
    const action = data.status || data.action || 'approve';
    const notes = data.notes || data.description || '';
    return this.processDSARRequest(requestId, action, notes);
  }

  /**
   * Alias for generateDSARExport
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Export data
   */
  async exportData(requestId) {
    return this.generateDSARExport(requestId, false);
  }

  /**
   * Map frontend request types to backend expected values
   * @param {string} type - Frontend request type
   * @returns {string} Backend request type
   */
  mapRequestType(type) {
    const typeMap = {
      'access': 'export',
      'portability': 'export',
      'deletion': 'delete',
      'rectification': 'rectification'
    };
    return typeMap[type] || type;
  }
}

// Export singleton instance
const dsarService = new DSARService();
export default dsarService;

