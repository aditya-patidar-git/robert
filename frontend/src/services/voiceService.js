import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const voiceService = {
  // Get all available voices
  async getVoices(language = null, forceRefresh = false) {
    const params = {};
    if (language) params.language = language;
    if (forceRefresh) params.forceRefresh = true;
    
    const response = await apiClient.get('/api/admin/audio-telephony/voices', { params });
    return response.data;
  },

  // Get specific voice by ID
  async getVoice(voiceId) {
    const response = await apiClient.get(`/api/admin/audio-telephony/voices/${voiceId}`);
    return response.data;
  },

  // Preview voice with custom text
  async previewVoice(voiceId, text) {
    const response = await apiClient.post('/api/admin/audio-telephony/voices/preview', {
      voiceId,
      text
    });
    return response.data;
  },

  // Set default voice
  async setDefaultVoice(voiceId) {
    const response = await apiClient.patch(`/api/admin/audio-telephony/voices/${voiceId}/default`);
    return response.data;
  },

  // Get voice discovery status
  async getDiscoveryStatus() {
    const response = await apiClient.get('/api/admin/audio-telephony/voices/discovery-status');
    return response.data;
  },

  // Force voice discovery refresh
  async refreshVoices() {
    const response = await apiClient.post('/api/admin/audio-telephony/voices/refresh');
    return response.data;
  }
};

export default voiceService;