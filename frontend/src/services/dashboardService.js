import { BaseService } from './baseService';

/**
 * Dashboard Service
 * Handles dashboard analytics and metrics
 * @extends BaseService
 */
class DashboardService extends BaseService {
  constructor() {
    super('/api/dashboard', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get comprehensive dashboard analytics
   * @returns {Promise<Object>} Dashboard analytics data
   */
  async getDashboardAnalytics() {
    return this.get('/analytics');
  }

  /**
   * Toggle routing enabled status
   * @returns {Promise<Object>} Updated system status
   */
  async toggleRouting() {
    return this.post('/routing/toggle');
  }

  /**
   * Dismiss an alert
   * @param {string} alertId - The ID of the alert to dismiss
   * @returns {Promise<Object>} Dismissed alert response
   */
  async dismissAlert(alertId) {
    return this.patch(`/alerts/${alertId}/dismiss`);
  }
}

// Export singleton instance
const dashboardService = new DashboardService();
export default dashboardService;
