import { BaseService } from './baseService';

/**
 * Allowlist Service
 * Handles allowlist management (admin only)
 * @extends BaseService
 */
class AllowlistService extends BaseService {
  constructor() {
    super('/api/admin/allowlist', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get all allowlist entries
   * @param {Object} params - Query parameters (type, page, limit, search)
   * @returns {Promise<Object>} Allowlist entries with pagination
   */
  async getAllowlist(params = {}) {
    // Filter out undefined/null/empty values to avoid "undefined" in query string
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined && value !== null && value !== '')
    );
    return this.get('', cleanParams);
  }

  /**
   * Add entry to allowlist
   * @param {Object} entryData - Entry data (type, value, notes)
   * @returns {Promise<Object>} Created entry
   */
  async addToAllowlist(entryData) {
    return this.post('', entryData);
  }

  /**
   * Remove entry from allowlist
   * @param {string} entryId - Entry ID
   * @returns {Promise<Object>} Deletion result
   */
  async removeFromAllowlist(entryId) {
    return this.delete(`/${entryId}`);
  }

  /**
   * Check if email is in allowlist
   * @param {string} email - Email to check
   * @returns {Promise<Object>} Check result
   */
  async checkAllowlist(email) {
    return this.get(`/check?email=${encodeURIComponent(email)}`);
  }
}

// Export singleton instance
const allowlistService = new AllowlistService();
export default allowlistService;

