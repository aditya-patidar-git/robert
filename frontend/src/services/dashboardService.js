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
}

// Export singleton instance
const dashboardService = new DashboardService();
export default dashboardService;
