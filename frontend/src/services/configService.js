import authenticatedApiClient from '../api/authenticatedApi.js';

const configService = {
  // Audio & Telephony Configuration
  async getAudioConfig() {
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/config/audio');
    return response.data;
  },

  async updateAudioConfig(config) {
    const response = await authenticatedApiClient.put('/api/admin/audio-telephony/config/audio', config);
    return response.data;
  },

  async testAudioConfig(voiceId, text) {
    const response = await authenticatedApiClient.post('/api/admin/audio-telephony/config/audio/test', { voiceId, text });
    return response.data;
  },

  async getAudioMetrics() {
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/config/audio/metrics');
    return response.data;
  },

  // Telephony Configuration
  async getTelephonyConfig() {
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/config/telephony');
    return response.data;
  },

  async updateTelephonyConfig(config) {
    const response = await authenticatedApiClient.put('/api/admin/audio-telephony/config/telephony', config);
    return response.data;
  },

  async addPhoneNumber(numberData) {
    const response = await authenticatedApiClient.post('/api/admin/audio-telephony/config/telephony/numbers', numberData);
    return response.data;
  },

  async updatePhoneNumber(number, numberData) {
    const response = await authenticatedApiClient.put(`/api/admin/audio-telephony/config/telephony/numbers/${number}`, numberData);
    return response.data;
  },

  async removePhoneNumber(number) {
    const response = await authenticatedApiClient.delete(`/api/admin/audio-telephony/config/telephony/numbers/${number}`);
    return response.data;
  },

  async testPhoneNumber(number) {
    const response = await authenticatedApiClient.post(`/api/admin/audio-telephony/config/telephony/numbers/${number}/test`);
    return response.data;
  },

  // Privacy Configuration
  async getPrivacyConfig() {
    const response = await authenticatedApiClient.get('/api/admin/config/privacy');
    return response.data;
  },

  async updatePrivacyConfig(config) {
    const response = await authenticatedApiClient.put('/api/admin/config/privacy', config);
    return response.data;
  },

  // System Configuration
  async getSystemConfig() {
    const response = await authenticatedApiClient.get('/api/admin/config/system');
    return response.data;
  },

  async updateSystemConfig(config) {
    const response = await authenticatedApiClient.put('/api/admin/config/system', config);
    return response.data;
  }
};

export default configService;