import { BaseService } from './baseService';

/**
 * Audit Service
 * Handles audit log retrieval
 * @extends BaseService
 */
class AuditService extends BaseService {
  constructor() {
    super('/api/admin/audit', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get audit logs
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Array<Object>>} Array of audit log entries
   */
  async getLogs(filters = {}) {
    return this.get('', filters);
  }

  /**
   * Get user-specific audit logs
   * @param {string} userId - User ID
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Array<Object>>} Array of audit log entries
   */
  async getUserLogs(userId, filters = {}) {
    return this.get(`/user/${userId}`, filters);
  }
}

// Export singleton instance
const auditService = new AuditService();
export default auditService;
