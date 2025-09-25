import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const configService = {
  // Audio & Telephony Configuration
  async getAudioConfig() {
    const response = await apiClient.get('/api/admin/config/audio');
    return response.data;
  },

  async updateAudioConfig(config) {
    const response = await apiClient.put('/api/admin/config/audio', config);
    return response.data;
  },

  // Telephony Configuration
  async getTelephonyConfig() {
    const response = await apiClient.get('/api/admin/config/telephony');
    return response.data;
  },

  async updateTelephonyConfig(config) {
    const response = await apiClient.put('/api/admin/config/telephony', config);
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