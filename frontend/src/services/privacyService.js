import authenticatedApiClient from '../api/authenticatedApi.js';

const privacyService = {
  // Create DSAR request
  async createDSARRequest(requestData) {
    const response = await authenticatedApiClient.post('/api/privacy/dsar', requestData);
    return response.data;
  },

  // Get all DSAR requests
  async getAllDSARRequests() {
    const response = await authenticatedApiClient.get('/api/privacy/dsar');
    return response.data;
  },

  // Update DSAR request status
  async updateDSARRequest(requestId, status) {
    const response = await authenticatedApiClient.patch(`/api/privacy/dsar/${requestId}`, { status });
    return response.data;
  },

  // Export user data
  async exportUserData(userId) {
    const response = await authenticatedApiClient.get(`/api/privacy/export/${userId}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Delete user data
  async deleteUserData(userId) {
    const response = await authenticatedApiClient.delete(`/api/privacy/data/${userId}`);
    return response.data;
  },

  // Get privacy audit logs
  async getAuditLogs(filters = {}) {
    const response = await authenticatedApiClient.get('/api/privacy/audit', {
      params: filters
    });
    return response.data;
  }
};

export default privacyService;