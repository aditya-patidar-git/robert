import { BaseService } from './baseService';

/**
 * Flow Parameter Service
 * Handles flow parameter overrides for different conversation flows
 * @extends BaseService
 */
class FlowParameterService extends BaseService {
  constructor() {
    super('/api/admin/ai/flow-parameters', {
      dataPath: 'overrides',
      normalizeResponse: true
    });
  }

  /**
   * Get all flow parameter overrides
   * @returns {Promise<Array<Object>>} Array of override objects
   */
  async getFlowParameters() {
    const response = await this.get('');
    return response.data?.overrides || response.data || [];
  }

  /**
   * Get specific flow parameter override
   * @param {string} flowType - Flow type
   * @returns {Promise<Object>} Override object
   */
  async getFlowParameter(flowType) {
    const response = await this.get(`/${flowType}`);
    return response.data?.override || response.data;
  }

  /**
   * Create or update flow parameter override
   * @param {string} flowType - Flow type
   * @param {Object} overrideData - Override data
   * @returns {Promise<Object>} Created/updated override
   */
  async createOrUpdateFlowOverride(flowType, overrideData) {
    const response = await this.put(`/${flowType}`, overrideData);
    return response.data?.override || response.data;
  }

  /**
   * Delete flow parameter override
   * @param {string} flowType - Flow type
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFlowOverride(flowType) {
    return this.delete(`/${flowType}`);
  }

  /**
   * Detect flow type from text (for testing)
   * @param {string} text - Text to analyze
   * @param {Array<Object>} transcript - Conversation transcript
   * @param {Object} callContext - Call context
   * @returns {Promise<Object>} Detection result
   */
  async detectFlowType(text, transcript = [], callContext = {}) {
    return this.post('/detect', {
      text,
      transcript,
      callContext
    });
  }
}

// Export singleton instance
const flowParameterService = new FlowParameterService();
export default flowParameterService;
