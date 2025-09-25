import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const voiceService = {
  // Get available voices
  async getVoices() {
    const response = await apiClient.get('/api/admin/voice/list');
    return response.data;
  },

  // Preview voice sample
  async previewVoice(voiceId, text) {
    const response = await apiClient.post('/api/admin/voice/preview', {
      voiceId,
      text
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get voice configuration
  async getConfig() {
    const response = await apiClient.get('/api/admin/voice/config');
    return response.data;
  },

  // Update voice configuration
  async updateConfig(config) {
    const response = await apiClient.put('/api/admin/voice/config', config);
    return response.data;
  }
};

export default voiceService;