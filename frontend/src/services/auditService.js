import authenticatedApiClient from '../api/authenticatedApi.js';

const auditService = {
  // Get audit logs
  async getLogs(filters = {}) {
    const response = await authenticatedApiClient.get('/api/admin/audit', {
      params: filters
    });
    return response.data;
  },

  // Get user-specific audit logs
  async getUserLogs(userId, filters = {}) {
    const response = await authenticatedApiClient.get(`/api/admin/audit/user/${userId}`, {
      params: filters
    });
    return response.data;
  }
};

export default auditService;