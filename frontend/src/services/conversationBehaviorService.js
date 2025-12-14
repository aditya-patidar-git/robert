import { BaseService } from './baseService.js';

class ConversationBehaviorService extends BaseService {
  constructor() {
    super('/api', {
      dataPath: 'config',
      normalizeResponse: true
    });
  }

  /**
   * Get active conversation behavior configuration
   * @returns {Promise<Object>} Configuration object
   */
  async getConfig() {
    return this.get('/conversation-behavior/config');
  }

  /**
   * Update conversation behavior configuration
   * @param {Object} configData - Configuration data to update
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfig(configData) {
    return this.post('/conversation-behavior/config', configData);
  }
}

export default new ConversationBehaviorService();

