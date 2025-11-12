import authenticatedApiClient from '../api/authenticatedApi.js';

const aiService = {
  // Get current AI configuration
  async getConfig() {
    const response = await authenticatedApiClient.get('/api/admin/ai/config');
    return response.data.config;
  },

  // Update AI configuration
  async updateConfig(config) {
    const response = await authenticatedApiClient.put('/api/admin/ai/config', config);
    return response.data.config;
  },

  // Get available models (discovered from OpenAI)
  async getModels(forceRefresh = false) {
    const params = forceRefresh ? { forceRefresh: 'true' } : {};
    const response = await authenticatedApiClient.get('/api/admin/ai/models', { params });
    return response.data.models || [];
  },

  // Get model parameters for a specific model
  async getModelParameters(modelId) {
    const response = await authenticatedApiClient.get('/api/admin/ai/models/parameters', {
      params: { modelId }
    });
    return response.data.parameters;
  },

  // Get all model capabilities and discovery status
  async getModelCapabilities() {
    const response = await authenticatedApiClient.get('/api/admin/ai/models/capabilities');
    return {
      capabilities: response.data.capabilities || [],
      discoveryStatus: response.data.discoveryStatus || {}
    };
  },

  // Test AI response
  async testPrompt(prompt, parameters) {
    const response = await authenticatedApiClient.post('/api/admin/ai/test', {
      prompt,
      ...parameters
    });
    return response.data.result;
  }
};

export default aiService;