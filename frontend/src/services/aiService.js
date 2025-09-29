import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  // withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const aiService = {
  // Get current AI configuration
  async getConfig() {
    const response = await apiClient.get('/api/admin/ai/config');
    return response.data;
  },

  // Update AI configuration
  async updateConfig(config) {
    const response = await apiClient.put('/api/admin/ai/config', config);
    return response.data;
  },

  // Get available models
  async getModels() {
    const response = await apiClient.get('/api/admin/ai/models');
    return response.data;
  },

  // Test AI response
  async testPrompt(prompt, parameters) {
    const response = await apiClient.post('/api/admin/ai/test', {
      prompt,
      ...parameters
    });
    return response.data;
  }
};

export default aiService;