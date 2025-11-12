import authenticatedApiClient from '../api/authenticatedApi.js';

const flowParameterService = {
  // Get all flow parameter overrides
  async getFlowParameters() {
    const response = await authenticatedApiClient.get('/api/admin/ai/flow-parameters');
    return response.data.overrides || [];
  },

  // Get specific flow parameter override
  async getFlowParameter(flowType) {
    const response = await authenticatedApiClient.get(`/api/admin/ai/flow-parameters/${flowType}`);
    return response.data.override;
  },

  // Create or update flow parameter override
  async createOrUpdateFlowOverride(flowType, overrideData) {
    const response = await authenticatedApiClient.put(
      `/api/admin/ai/flow-parameters/${flowType}`,
      overrideData
    );
    return response.data.override;
  },

  // Delete flow parameter override
  async deleteFlowOverride(flowType) {
    const response = await authenticatedApiClient.delete(`/api/admin/ai/flow-parameters/${flowType}`);
    return response.data;
  },

  // Detect flow type from text (for testing)
  async detectFlowType(text, transcript = [], callContext = {}) {
    const response = await authenticatedApiClient.post('/api/admin/ai/flow-parameters/detect', {
      text,
      transcript,
      callContext
    });
    return response.data;
  }
};

export default flowParameterService;

