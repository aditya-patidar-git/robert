import { BaseService } from './baseService';

/**
 * AI Service
 * Handles AI configuration, models, and capabilities
 * @extends BaseService
 */
class AIService extends BaseService {
  constructor() {
    super('/api/admin/ai', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get current AI configuration
   * @returns {Promise<Object>} AI configuration object
   */
  async getConfig() {
    const response = await this.get('/config');
    return response.data?.config || response.data;
  }

  /**
   * Update AI configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfig(config) {
    const response = await this.put('/config', config);
    return response.data?.config || response.data;
  }

  /**
   * Get available models (discovered from OpenAI)
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array<Object>>} Array of model objects
   */
  async getModels(forceRefresh = false) {
    const params = forceRefresh ? { forceRefresh: 'true' } : {};
    const response = await this.get('/models', params);
    return response.data?.models || response.data || [];
  }

  /**
   * Get model parameters for a specific model
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} Model parameters
   */
  async getModelParameters(modelId) {
    const response = await this.get('/models/parameters', { modelId });
    return response.data?.parameters || response.data;
  }

  /**
   * Get all model capabilities and discovery status
   * @returns {Promise<Object>} Object with capabilities and discoveryStatus
   * @property {Array<Object>} capabilities - Array of model capabilities
   * @property {Object} discoveryStatus - Discovery status information
   */
  async getModelCapabilities() {
    const response = await this.get('/models/capabilities');
    return {
      capabilities: response.data?.capabilities || response.data?.data?.capabilities || [],
      discoveryStatus: response.data?.discoveryStatus || response.data?.data?.discoveryStatus || {}
    };
  }

  /**
   * Test AI response
   * @param {string} prompt - Test prompt
   * @param {Object} parameters - AI parameters (temperature, topP, etc.)
   * @returns {Promise<Object>} Test result
   */
  async testPrompt(prompt, parameters) {
    const response = await this.post('/test', {
      prompt,
      ...parameters
    });
    return response.data?.result || response.data;
  }
}

// Export singleton instance
const aiService = new AIService();
export default aiService;
