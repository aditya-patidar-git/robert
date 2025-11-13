import { BaseService } from './baseService';

/**
 * Telephony Service
 * Handles active calls monitoring
 * @extends BaseService
 */
class TelephonyService extends BaseService {
  constructor() {
    super('/api/audio-telephony', {
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
}

// Export singleton instance
const telephonyService = new TelephonyService();
export default telephonyService;
