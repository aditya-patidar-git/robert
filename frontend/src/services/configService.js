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

  async getAudioMetrics(timeRange = '24h') {
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/config/audio/metrics', {
      params: { timeRange }
    });
    return response.data;
  },

  async getHistoricalAudioMetrics(timeRange = '24h', dataPoints = 20) {
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/config/audio/metrics/historical', {
      params: { timeRange, dataPoints }
    });
    return response.data;
  },

  async getRecentCallsWithQuality(limit = 50, qualityFilter = null) {
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/config/audio/metrics/recent-calls', {
      params: { limit, qualityFilter }
    });
    return response.data;
  },

  async getModelParameterRanges(modelId) {
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/config/audio/model-ranges', {
      params: { modelId }
    });
    return response.data;
  },

  async getNumberProfile(phoneNumber) {
    const response = await authenticatedApiClient.get(`/api/admin/audio-telephony/config/audio/number-profile/${encodeURIComponent(phoneNumber)}`);
    return response.data;
  },

  async saveNumberProfile(phoneNumber, profileData) {
    const response = await authenticatedApiClient.put(`/api/admin/audio-telephony/config/audio/number-profile/${encodeURIComponent(phoneNumber)}`, profileData);
    return response.data;
  },

  async deleteNumberProfile(phoneNumber) {
    const response = await authenticatedApiClient.delete(`/api/admin/audio-telephony/config/audio/number-profile/${encodeURIComponent(phoneNumber)}`);
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