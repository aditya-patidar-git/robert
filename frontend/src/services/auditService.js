import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const auditService = {
  // Get audit logs
  async getLogs(filters = {}) {
    const response = await apiClient.get('/api/admin/audit', {
      params: filters
    });
    return response.data;
  },

  // Get user-specific audit logs
  async getUserLogs(userId, filters = {}) {
    const response = await apiClient.get(`/api/admin/audit/user/${userId}`, {
      params: filters
    });
    return response.data;
  }
};

export default auditService;