import authenticatedApiClient from '../api/authenticatedApi.js';

const userService = {
  // Get all users (admin only)
  async getAllUsers() {
    const response = await authenticatedApiClient.get('/api/admin/users');
    return response.data;
  },

  // Create new user (admin only)
  async createUser(userData) {
    const response = await authenticatedApiClient.post('/api/admin/users', userData);
    return response.data;
  },

  // Update user (admin only)
  async updateUser(userId, userData) {
    const response = await authenticatedApiClient.put(`/api/admin/users/${userId}`, userData);
    return response.data;
  },

  // Delete user (admin only)
  async deleteUser(userId) {
    const response = await authenticatedApiClient.delete(`/api/admin/users/${userId}`);
    return response.data;
  },

  // Approve user (admin only)
  async approveUser(userId) {
    const response = await authenticatedApiClient.patch(`/api/admin/users/${userId}/approve`);
    return response.data;
  },

  // Block user (admin only)
  async blockUser(userId) {
    const response = await authenticatedApiClient.patch(`/api/admin/users/${userId}/block`);
    return response.data;
  },

  // Exclude user (admin only)
  async excludeUser(userId) {
    const response = await authenticatedApiClient.patch(`/api/admin/users/${userId}/exclude`);
    return response.data;
  }
};

export default userService;