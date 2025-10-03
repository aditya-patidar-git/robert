import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  // withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const voiceService = {
  // Get available voices (discovered from OpenAI)
  async getVoices(forceRefresh = false) {
    const params = forceRefresh ? { forceRefresh: 'true' } : {};
    const response = await apiClient.get('/api/admin/voice/voices', { params });
    return response.data.voices || [];
  },

  // Preview voice sample
  async previewVoice(voiceId, text) {
    const response = await apiClient.post('/api/admin/voice/preview', {
      voiceId,
      text
    });
    return response.data.preview;
  },

  // Get voice by ID
  async getVoice(voiceId) {
    const response = await apiClient.get(`/api/admin/voice/voices/${voiceId}`);
    return response.data.voice;
  },

  // Create new voice
  async createVoice(voiceData) {
    const response = await apiClient.post('/api/admin/voice/voices', voiceData);
    return response.data.voice;
  },

  // Update voice
  async updateVoice(voiceId, voiceData) {
    const response = await apiClient.put(`/api/admin/voice/voices/${voiceId}`, voiceData);
    return response.data.voice;
  },

  // Delete voice
  async deleteVoice(voiceId) {
    const response = await apiClient.delete(`/api/admin/voice/voices/${voiceId}`);
    return response.data;
  },

  // Set default voice
  async setDefaultVoice(voiceId) {
    const response = await apiClient.patch(`/api/admin/voice/voices/${voiceId}/default`);
    return response.data.voice;
  }
};

export default voiceService;