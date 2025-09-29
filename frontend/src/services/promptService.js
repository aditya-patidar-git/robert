import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  // withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const promptService = {
  // Get all prompts
  async getAllPrompts() {
    const response = await apiClient.get('/api/admin/prompt');
    return response.data;
  },

  // Create new prompt
  async createPrompt(promptData) {
    const response = await apiClient.post('/api/admin/prompt', promptData);
    return response.data;
  },

  // Update prompt
  async updatePrompt(promptId, promptData) {
    const response = await apiClient.put(`/api/admin/prompt/${promptId}`, promptData);
    return response.data;
  },

  // Delete prompt
  async deletePrompt(promptId) {
    const response = await apiClient.delete(`/api/admin/prompt/${promptId}`);
    return response.data;
  },

  // Get prompt by ID
  async getPrompt(promptId) {
    const response = await apiClient.get(`/api/admin/prompt/${promptId}`);
    return response.data;
  }
};

export default promptService;