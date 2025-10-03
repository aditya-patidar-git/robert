import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  // withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const configService = {
  // Audio & Telephony Configuration
  async getAudioConfig() {
    const response = await apiClient.get('/api/admin/audio-telephony/config/audio');
    return response.data;
  },

  async updateAudioConfig(config) {
    const response = await apiClient.put('/api/admin/audio-telephony/config/audio', config);
    return response.data;
  },

  async testAudioConfig(voiceId, text) {
    const response = await apiClient.post('/api/admin/audio-telephony/config/audio/test', { voiceId, text });
    return response.data;
  },

  async getAudioMetrics() {
    const response = await apiClient.get('/api/admin/audio-telephony/config/audio/metrics');
    return response.data;
  },

  // Telephony Configuration
  async getTelephonyConfig() {
    const response = await apiClient.get('/api/admin/audio-telephony/config/telephony');
    return response.data;
  },

  async updateTelephonyConfig(config) {
    const response = await apiClient.put('/api/admin/audio-telephony/config/telephony', config);
    return response.data;
  },

  async addPhoneNumber(numberData) {
    const response = await apiClient.post('/api/admin/audio-telephony/config/telephony/numbers', numberData);
    return response.data;
  },

  async updatePhoneNumber(number, numberData) {
    const response = await apiClient.put(`/api/admin/audio-telephony/config/telephony/numbers/${number}`, numberData);
    return response.data;
  },

  async removePhoneNumber(number) {
    const response = await apiClient.delete(`/api/admin/audio-telephony/config/telephony/numbers/${number}`);
    return response.data;
  },

  async testPhoneNumber(number) {
    const response = await apiClient.post(`/api/admin/audio-telephony/config/telephony/numbers/${number}/test`);
    return response.data;
  },

  // Privacy Configuration
  async getPrivacyConfig() {
    const response = await apiClient.get('/api/admin/config/privacy');
    return response.data;
  },

  async updatePrivacyConfig(config) {
    const response = await apiClient.put('/api/admin/config/privacy', config);
    return response.data;
  },

  // System Configuration
  async getSystemConfig() {
    const response = await apiClient.get('/api/admin/config/system');
    return response.data;
  },

  async updateSystemConfig(config) {
    const response = await apiClient.put('/api/admin/config/system', config);
    return response.data;
  }
};

export default configService;