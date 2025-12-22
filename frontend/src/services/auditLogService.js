import { BaseService } from './baseService';

/**
 * Audit Log Service
 * Handles audit log retrieval (admin only)
 * @extends BaseService
 */
class AuditLogService extends BaseService {
  constructor() {
    super('/api/admin/audit', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get audit logs with filters
   * @param {Object} params - Query parameters (actorId, action, targetType, targetId, startDate, endDate, page, limit)
   * @returns {Promise<Object>} Audit logs with pagination
   */
  async getAuditLogs(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.get(queryString ? `?${queryString}` : '');
  }

  /**
   * Get single audit log entry
   * @param {string} auditLogId - Audit log ID
   * @returns {Promise<Object>} Audit log entry
   */
  async getAuditLog(auditLogId) {
    return this.get(`/${auditLogId}`);
  }
}

// Export singleton instance
const auditLogService = new AuditLogService();
export default auditLogService;

