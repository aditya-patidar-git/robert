import authenticatedApiClient from '../api/authenticatedApi.js';

const uncertaintyGateService = {
  async validateResults(searchResults, options = {}) {
    const response = await authenticatedApiClient.post('/api/uncertainty-gate/validate', { searchResults, options });
    return response.data;
  },

  async generateUncertaintyResponse(validation) {
    const response = await authenticatedApiClient.post('/api/uncertainty-gate/response', { validation });
    return response.data;
  },

  async trackUncertaintyEvent(eventData) {
    const response = await authenticatedApiClient.post('/api/uncertainty-gate/track', eventData);
    return response.data;
  },

  async getConfiguration() {
    const response = await authenticatedApiClient.get('/api/uncertainty-gate/config');
    return response.data;
  },

  async updateConfiguration(config) {
    const response = await authenticatedApiClient.put('/api/uncertainty-gate/config', { config });
    return response.data;
  }
};

export default uncertaintyGateService;





