import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const reingestService = {
  async getReingestStatus() {
    const response = await apiClient.get('/api/reingest/status');
    return response.data;
  },

  async startReingest(fileIds = null) {
    const response = await apiClient.post('/api/reingest/start', { fileIds });
    return response.data;
  },

  async getFilesNeedingReingest() {
    const response = await apiClient.get('/api/reingest/files');
    return response.data;
  },

  async scheduleReingest(fileIds, delay = 0) {
    const response = await apiClient.post('/api/reingest/schedule', { fileIds, delay });
    return response.data;
  }
};

export default reingestService;
