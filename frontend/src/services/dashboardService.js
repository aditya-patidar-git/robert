import authenticatedApiClient from '../api/authenticatedApi.js';

const dashboardService = {
  // Get comprehensive dashboard analytics
  async getDashboardAnalytics() {
    try {
      console.log('🔄 Fetching dashboard analytics...');
      const response = await authenticatedApiClient.get('/api/dashboard/analytics');
      // console.log('✅ Dashboard analytics received:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching dashboard analytics:', error);
      throw error;
    }
  },
};

export default dashboardService;
