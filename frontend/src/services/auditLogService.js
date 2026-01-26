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
    // Pass params to axios via the second argument, not as part of the URL
    // This avoids URL construction issues with query strings
    return this.get('', params);
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

