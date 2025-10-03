import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const driftService = {
  async getDriftStatus() {
    const response = await apiClient.get('/api/drift/status');
    return response.data;
  },

  async startDriftDetection() {
    const response = await apiClient.post('/api/drift/detect');
    return response.data;
  },

  async getFilesWithDrift() {
    const response = await apiClient.get('/api/drift/files');
    return response.data;
  },

  async clearDriftFlags(fileIds) {
    const response = await apiClient.post('/api/drift/clear', { fileIds });
    return response.data;
  }
};

export default driftService;
