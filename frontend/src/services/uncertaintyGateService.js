import { BaseService } from './baseService';

/**
 * Uncertainty Gate Service
 * Handles uncertainty validation and response generation
 * @extends BaseService
 */
class UncertaintyGateService extends BaseService {
  constructor() {
    super('/api/uncertainty-gate', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Validate search results
   * @param {Array<Object>} searchResults - Search results to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateResults(searchResults, options = {}) {
    return this.post('/validate', { searchResults, options });
  }

  /**
   * Generate uncertainty response
   * @param {Object} validation - Validation object
   * @returns {Promise<Object>} Uncertainty response
   */
  async generateUncertaintyResponse(validation) {
    return this.post('/response', { validation });
  }

  /**
   * Track uncertainty event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Tracking result
   */
  async trackUncertaintyEvent(eventData) {
    return this.post('/track', eventData);
  }

  /**
   * Get configuration
   * @returns {Promise<Object>} Configuration object
   */
  async getConfiguration() {
    return this.get('/config');
  }

  /**
   * Update configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(config) {
    return this.put('/config', { config });
  }
}

// Export singleton instance
const uncertaintyGateService = new UncertaintyGateService();
export default uncertaintyGateService;
