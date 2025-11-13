import { BaseService } from './baseService';

/**
 * Token Management Service
 * Handles token usage tracking and context optimization
 * @extends BaseService
 */
class TokenManagementService extends BaseService {
  constructor() {
    super('/api/admin/ai/token-management', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get token usage for a specific call
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Token usage data
   */
  async getTokenUsage(callSid) {
    const response = await this.get(`/usage/${callSid}`);
    return response.data?.tokenUsage || response.data;
  }

  /**
   * Get aggregate token usage statistics
   * @param {string|null} startDate - Start date
   * @param {string|null} endDate - End date
   * @param {string|null} modelId - Model ID filter
   * @returns {Promise<Object>} Token statistics
   */
  async getTokenStats(startDate, endDate, modelId) {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (modelId) params.modelId = modelId;
    
    const response = await this.get('/stats', params);
    return response.data?.stats || response.data;
  }

  /**
   * Manually trigger context optimization for a call
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeContext(callSid) {
    const response = await this.post(`/optimize/${callSid}`);
    return response.data?.optimization || response.data;
  }

  /**
   * Get context limit for a model
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} Context limit data
   */
  async getContextLimit(modelId) {
    return this.get(`/context-limit/${modelId}`);
  }
}

// Export singleton instance
const tokenManagementService = new TokenManagementService();
export default tokenManagementService;
