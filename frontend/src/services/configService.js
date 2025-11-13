import { BaseService } from './baseService';

/**
 * Configuration Service
 * Handles audio, telephony, privacy, and system configuration
 * @extends BaseService
 */
class ConfigService extends BaseService {
  constructor() {
    super('/api/admin', {
      dataPath: 'config',
      normalizeResponse: true
    });
  }

  // Audio & Telephony Configuration

  /**
   * Get audio configuration
   * @returns {Promise<Object>} Audio configuration object
   */
  async getAudioConfig() {
    return this.get('/audio-telephony/config/audio');
  }

  /**
   * Update audio configuration
   * @param {Object} config - Audio configuration object
   * @returns {Promise<Object>} Updated configuration
   */
  async updateAudioConfig(config) {
    return this.put('/audio-telephony/config/audio', config);
  }

  /**
   * Test audio configuration
   * @param {string} voiceId - Voice ID to test
   * @param {string} text - Text to test
   * @returns {Promise<Object>} Test result
   */
  async testAudioConfig(voiceId, text) {
    return this.post('/audio-telephony/config/audio/test', { voiceId, text });
  }

  /**
   * Get audio metrics
   * @param {string} timeRange - Time range (default: '24h')
   * @returns {Promise<Object>} Audio metrics
   */
  async getAudioMetrics(timeRange = '24h') {
    return this.get('/audio-telephony/config/audio/metrics', { timeRange });
  }

  /**
   * Get historical audio metrics
   * @param {string} timeRange - Time range (default: '24h')
   * @param {number} dataPoints - Number of data points (default: 20)
   * @returns {Promise<Object>} Historical metrics
   */
  async getHistoricalAudioMetrics(timeRange = '24h', dataPoints = 20) {
    return this.get('/audio-telephony/config/audio/metrics/historical', { timeRange, dataPoints });
  }

  /**
   * Get recent calls with quality metrics
   * @param {number} limit - Number of calls to return (default: 50)
   * @param {string|null} qualityFilter - Optional quality filter
   * @returns {Promise<Object>} Recent calls data
   */
  async getRecentCallsWithQuality(limit = 50, qualityFilter = null) {
    const params = { limit };
    if (qualityFilter) params.qualityFilter = qualityFilter;
    return this.get('/audio-telephony/config/audio/metrics/recent-calls', params);
  }

  /**
   * Get model parameter ranges
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} Model parameter ranges
   */
  async getModelParameterRanges(modelId) {
    return this.get('/audio-telephony/config/audio/model-ranges', { modelId });
  }

  /**
   * Get number profile
   * @param {string} phoneNumber - Phone number
   * @returns {Promise<Object>} Number profile
   */
  async getNumberProfile(phoneNumber) {
    return this.get(`/audio-telephony/config/audio/number-profile/${encodeURIComponent(phoneNumber)}`);
  }

  /**
   * Save number profile
   * @param {string} phoneNumber - Phone number
   * @param {Object} profileData - Profile data
   * @returns {Promise<Object>} Saved profile
   */
  async saveNumberProfile(phoneNumber, profileData) {
    return this.put(`/audio-telephony/config/audio/number-profile/${encodeURIComponent(phoneNumber)}`, profileData);
  }

  /**
   * Delete number profile
   * @param {string} phoneNumber - Phone number
   * @returns {Promise<Object>} Deletion result
   */
  async deleteNumberProfile(phoneNumber) {
    return this.delete(`/audio-telephony/config/audio/number-profile/${encodeURIComponent(phoneNumber)}`);
  }

  // Telephony Configuration

  /**
   * Get telephony configuration
   * @returns {Promise<Object>} Telephony configuration
   */
  async getTelephonyConfig() {
    return this.get('/audio-telephony/config/telephony');
  }

  /**
   * Update telephony configuration
   * @param {Object} config - Telephony configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updateTelephonyConfig(config) {
    return this.put('/audio-telephony/config/telephony', config);
  }

  /**
   * Add phone number
   * @param {Object} numberData - Phone number data
   * @returns {Promise<Object>} Added number
   */
  async addPhoneNumber(numberData) {
    return this.post('/audio-telephony/config/telephony/numbers', numberData);
  }

  /**
   * Update phone number
   * @param {string} number - Phone number
   * @param {Object} numberData - Updated number data
   * @returns {Promise<Object>} Updated number
   */
  async updatePhoneNumber(number, numberData) {
    return this.put(`/audio-telephony/config/telephony/numbers/${number}`, numberData);
  }

  /**
   * Remove phone number
   * @param {string} number - Phone number
   * @returns {Promise<Object>} Deletion result
   */
  async removePhoneNumber(number) {
    return this.delete(`/audio-telephony/config/telephony/numbers/${number}`);
  }

  /**
   * Test phone number
   * @param {string} number - Phone number
   * @returns {Promise<Object>} Test result
   */
  async testPhoneNumber(number) {
    return this.post(`/audio-telephony/config/telephony/numbers/${number}/test`);
  }

  // Privacy Configuration

  /**
   * Get privacy configuration
   * @returns {Promise<Object>} Privacy configuration
   */
  async getPrivacyConfig() {
    return this.get('/config/privacy');
  }

  /**
   * Update privacy configuration
   * @param {Object} config - Privacy configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updatePrivacyConfig(config) {
    return this.put('/config/privacy', config);
  }

  // System Configuration

  /**
   * Get system configuration
   * @returns {Promise<Object>} System configuration
   */
  async getSystemConfig() {
    return this.get('/config/system');
  }

  /**
   * Update system configuration
   * @param {Object} config - System configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updateSystemConfig(config) {
    return this.put('/config/system', config);
  }
}

// Export singleton instance
const configService = new ConfigService();
export default configService;
