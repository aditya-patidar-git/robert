import authenticatedApiClient from '../api/authenticatedApi.js';

const promptService = {
  // Get all prompts
  async getAllPrompts() {
    const response = await authenticatedApiClient.get('/api/admin/prompt');
    return response.data.prompts || [];
  },

  // Create new prompt
  async createPrompt(promptData) {
    const response = await authenticatedApiClient.post('/api/admin/prompt', promptData);
    return response.data.prompt;
  },

  // Update prompt
  async updatePrompt(promptId, promptData) {
    const response = await authenticatedApiClient.put(`/api/admin/prompt/${promptId}`, promptData);
    return response.data.prompt;
  },

  // Delete prompt
  async deletePrompt(promptId) {
    const response = await authenticatedApiClient.delete(`/api/admin/prompt/${promptId}`);
    return response.data;
  },

  // Get prompt by ID
  async getPrompt(promptId) {
    const response = await authenticatedApiClient.get(`/api/admin/prompt/${promptId}`);
    return response.data.prompt;
  }
};

export default promptService;