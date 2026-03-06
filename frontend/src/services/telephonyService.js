import { BaseService } from './baseService';

/**
 * Telephony Service
 * Handles active calls monitoring
 * @extends BaseService
 */
class TelephonyService extends BaseService {
  constructor() {
    super('/api/admin/audio-telephony', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get active calls
   * @returns {Promise<Array<Object>>} Array of active calls
   */
  async getActiveCalls() {
    return this.get('/active-calls');
  }

  /**
   * Get SIP configuration
   * @returns {Promise<Object>} SIP configuration
   */
  async getSipConfig() {
    return this.get('/config/telephony/sip/status');
  }

  /**
   * Update SIP configuration
   * @param {Object} config - SIP configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updateSipConfig(config) {
    return this.put('/config/telephony/sip/settings', config);
  }

  /**
   * Test SIP connection
   * @returns {Promise<Object>} Test result
   */
  async testSipConnection() {
    return this.post('/config/telephony/sip/test-connection');
  }
}

// Export singleton instance
const telephonyService = new TelephonyService();
export default telephonyService;
