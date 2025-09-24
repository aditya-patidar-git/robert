import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const privacyService = {
  // Create DSAR request
  async createDSARRequest(requestData) {
    const response = await apiClient.post('/api/privacy/dsar', requestData);
    return response.data;
  },

  // Get all DSAR requests
  async getAllDSARRequests() {
    const response = await apiClient.get('/api/privacy/dsar');
    return response.data;
  },

  // Update DSAR request status
  async updateDSARRequest(requestId, status) {
    const response = await apiClient.patch(`/api/privacy/dsar/${requestId}`, { status });
    return response.data;
  },

  // Export user data
  async exportUserData(userId) {
    const response = await apiClient.get(`/api/privacy/export/${userId}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Delete user data
  async deleteUserData(userId) {
    const response = await apiClient.delete(`/api/privacy/data/${userId}`);
    return response.data;
  },

  // Get privacy audit logs
  async getAuditLogs(filters = {}) {
    const response = await apiClient.get('/api/privacy/audit', {
      params: filters
    });
    return response.data;
  }
};

export default privacyService;