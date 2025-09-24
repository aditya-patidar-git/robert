import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const userService = {
  // Get all users (admin only)
  async getAllUsers() {
    const response = await apiClient.get('/api/admin/users');
    return response.data;
  },

  // Create new user (admin only)
  async createUser(userData) {
    const response = await apiClient.post('/api/admin/users', userData);
    return response.data;
  },

  // Update user (admin only)
  async updateUser(userId, userData) {
    const response = await apiClient.put(`/api/admin/users/${userId}`, userData);
    return response.data;
  },

  // Delete user (admin only)
  async deleteUser(userId) {
    const response = await apiClient.delete(`/api/admin/users/${userId}`);
    return response.data;
  },

  // Approve user (admin only)
  async approveUser(userId) {
    const response = await apiClient.patch(`/api/admin/users/${userId}/approve`);
    return response.data;
  },

  // Block user (admin only)
  async blockUser(userId) {
    const response = await apiClient.patch(`/api/admin/users/${userId}/block`);
    return response.data;
  },

  // Exclude user (admin only)
  async excludeUser(userId) {
    const response = await apiClient.patch(`/api/admin/users/${userId}/exclude`);
    return response.data;
  }
};

export default userService;