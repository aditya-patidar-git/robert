import authenticatedApiClient from '../api/authenticatedApi.js';

const privacyService = {
  // Create DSAR request
  async createDSARRequest(requestData) {
    const response = await authenticatedApiClient.post('/api/gdpr/dsar', requestData);
    return response.data;
  },

  // Get all DSAR requests
  async getAllDSARRequests(filters = {}) {
    const response = await authenticatedApiClient.get('/api/gdpr/dsar', {
      params: filters
    });
    return response.data;
  },

  // Update DSAR request status
  async updateDSARRequest(requestId, status) {
    const response = await authenticatedApiClient.patch(`/api/gdpr/dsar/${requestId}`, { status });
    return response.data;
  },

  // Process DSAR request
  async processDSARRequest(dsarId, action, adminUser) {
    const response = await authenticatedApiClient.post(`/api/gdpr/dsar/${dsarId}/process`, {
      action,
      adminUser
    });
    return response.data;
  },

  // Export user data
  async exportUserData(userId, dataTypes = ['transcripts', 'recordings', 'metadata']) {
    const response = await authenticatedApiClient.post(`/api/gdpr/export/${userId}`, {
      dataTypes
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Delete user data
  async deleteUserData(userId, dataTypes = ['all']) {
    const response = await authenticatedApiClient.delete(`/api/gdpr/delete/${userId}`, {
      data: { dataTypes }
    });
    return response.data;
  },

  // Get privacy audit logs
  async getAuditLogs(filters = {}) {
    const response = await authenticatedApiClient.get('/api/gdpr/audit-logs', {
      params: filters
    });
    return response.data;
  },

  // Check retention policies
  async checkRetentionPolicies() {
    const response = await authenticatedApiClient.get('/api/gdpr/retention-policies');
    return response.data;
  },

  // Cleanup expired data
  async cleanupExpiredData() {
    const response = await authenticatedApiClient.post('/api/gdpr/cleanup-expired');
    return response.data;
  },

  // Generate compliance report
  async generateComplianceReport(period = 'monthly') {
    const response = await authenticatedApiClient.get('/api/gdpr/compliance-report', {
      params: { period }
    });
    return response.data;
  },

  // Generate Privacy Impact Assessment
  async generatePrivacyImpactAssessment(processingActivity) {
    const response = await authenticatedApiClient.post('/api/gdpr/privacy-impact-assessment', {
      processingActivity
    });
    return response.data;
  },

  // Report data breach
  async reportDataBreach(breachData) {
    const response = await authenticatedApiClient.post('/api/gdpr/data-breach', {
      breachData
    });
    return response.data;
  },

  // Mask PII
  async maskPII(text, maskType = 'partial') {
    const response = await authenticatedApiClient.post('/api/gdpr/mask-pii', {
      text,
      maskType
    });
    return response.data;
  },

  // Record consent
  async recordConsent(callSid, consentType, granted) {
    const response = await authenticatedApiClient.post('/api/gdpr/consent', {
      callSid,
      consentType,
      granted
    });
    return response.data;
  },

  // Check consent
  async checkConsent(callSid, consentType) {
    const response = await authenticatedApiClient.get(`/api/gdpr/consent/${callSid}/${consentType}`);
    return response.data;
  }
};

export default privacyService;