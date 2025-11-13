import authenticatedApiClient from '../api/authenticatedApi.js';

const tokenManagementService = {
  // Get token usage for a specific call
  async getTokenUsage(callSid) {
    const response = await authenticatedApiClient.get(`/api/admin/ai/token-management/usage/${callSid}`);
    return response.data.tokenUsage;
  },

  // Get aggregate token usage statistics
  async getTokenStats(startDate, endDate, modelId) {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (modelId) params.modelId = modelId;
    
    const response = await authenticatedApiClient.get('/api/admin/ai/token-management/stats', { params });
    return response.data.stats;
  },

  // Manually trigger context optimization for a call
  async optimizeContext(callSid) {
    const response = await authenticatedApiClient.post(`/api/admin/ai/token-management/optimize/${callSid}`);
    return response.data.optimization;
  },

  // Get context limit for a model
  async getContextLimit(modelId) {
    const response = await authenticatedApiClient.get(`/api/admin/ai/token-management/context-limit/${modelId}`);
    return response.data;
  }
};

export default tokenManagementService;

