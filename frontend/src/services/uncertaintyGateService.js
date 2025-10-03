import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const uncertaintyGateService = {
  async validateResults(searchResults, options = {}) {
    const response = await apiClient.post('/api/uncertainty-gate/validate', { searchResults, options });
    return response.data;
  },

  async generateUncertaintyResponse(validation) {
    const response = await apiClient.post('/api/uncertainty-gate/response', { validation });
    return response.data;
  },

  async trackUncertaintyEvent(eventData) {
    const response = await apiClient.post('/api/uncertainty-gate/track', eventData);
    return response.data;
  },

  async getConfiguration() {
    const response = await apiClient.get('/api/uncertainty-gate/config');
    return response.data;
  },

  async updateConfiguration(config) {
    const response = await apiClient.put('/api/uncertainty-gate/config', { config });
    return response.data;
  }
};

export default uncertaintyGateService;
