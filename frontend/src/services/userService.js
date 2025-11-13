import { BaseService } from './baseService';

/**
 * User Service
 * Handles user management (admin only)
 * @extends BaseService
 */
class UserService extends BaseService {
  constructor() {
    super('/api/admin/users', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get all users (admin only)
   * @returns {Promise<Array<Object>>} Array of user objects
   */
  async getAllUsers() {
    return this.get('');
  }

  /**
   * Create new user (admin only)
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  async createUser(userData) {
    return this.post('', userData);
  }

  /**
   * Update user (admin only)
   * @param {string} userId - User ID
   * @param {Object} userData - Updated user data
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(userId, userData) {
    return this.put(`/${userId}`, userData);
  }

  /**
   * Delete user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteUser(userId) {
    return this.delete(`/${userId}`);
  }

  /**
   * Approve user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated user
   */
  async approveUser(userId) {
    return this.patch(`/${userId}/approve`);
  }

  /**
   * Block user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated user
   */
  async blockUser(userId) {
    return this.patch(`/${userId}/block`);
  }

  /**
   * Exclude user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated user
   */
  async excludeUser(userId) {
    return this.patch(`/${userId}/exclude`);
  }
}

// Export singleton instance
const userService = new UserService();
export default userService;
