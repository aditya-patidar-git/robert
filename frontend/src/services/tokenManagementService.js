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
    // Backend returns: { status: "success", stats: {...} }
    // Handle both normalized and raw response structures
    if (response?.data?.stats) {
      return response.data.stats;
    }
    if (response?.stats) {
      return response.stats;
    }
    return response?.data || response || {};
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
    const response = await this.get(`/context-limit/${modelId}`);
    // Backend returns: { status: "success", modelId, contextLimit, warningThreshold, criticalThreshold, emergencyThreshold }
    // Return the data directly (BaseService normalizes it)
    return response?.data || response || {};
  }
}

// Export singleton instance
const tokenManagementService = new TokenManagementService();
export default tokenManagementService;
