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

  /**
   * Export audit logs as CSV or JSON file (download)
   * @param {Object} params - Same filters as getAuditLogs plus format: 'csv' | 'json'
   * @returns {Promise<void>}
   */
  async exportAuditLogs(params = {}) {
    const { format = 'csv', ...rest } = params;
    const url = this.buildUrl('/export');
    const response = await this.client.get(url, {
      params: { ...rest, format },
      responseType: 'blob'
    });
    const blob = response.data;
    const ext = format === 'csv' ? 'csv' : 'json';
    const filename = `audit-logs.${ext}`;
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(link.href);
  }
}

// Export singleton instance
const auditLogService = new AuditLogService();
export default auditLogService;

