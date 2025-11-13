import { BaseService } from './baseService';

/**
 * Prompt Service
 * Handles prompt management
 * @extends BaseService
 */
class PromptService extends BaseService {
  constructor() {
    super('/api/admin/prompt', {
      dataPath: 'prompts',
      normalizeResponse: true
    });
  }

  /**
   * Get all prompts
   * @returns {Promise<Array<Object>>} Array of prompt objects
   */
  async getAllPrompts() {
    const response = await this.get('');
    return response.data?.prompts || response.data || [];
  }

  /**
   * Create new prompt
   * @param {Object} promptData - Prompt data
   * @returns {Promise<Object>} Created prompt
   */
  async createPrompt(promptData) {
    const response = await this.post('', promptData);
    return response.data?.prompt || response.data;
  }

  /**
   * Update prompt
   * @param {string} promptId - Prompt ID
   * @param {Object} promptData - Updated prompt data
   * @returns {Promise<Object>} Updated prompt
   */
  async updatePrompt(promptId, promptData) {
    const response = await this.put(`/${promptId}`, promptData);
    return response.data?.prompt || response.data;
  }

  /**
   * Delete prompt
   * @param {string} promptId - Prompt ID
   * @returns {Promise<Object>} Deletion result
   */
  async deletePrompt(promptId) {
    return this.delete(`/${promptId}`);
  }

  /**
   * Get prompt by ID
   * @param {string} promptId - Prompt ID
   * @returns {Promise<Object>} Prompt object
   */
  async getPrompt(promptId) {
    const response = await this.get(`/${promptId}`);
    return response.data?.prompt || response.data;
  }
}

// Export singleton instance
const promptService = new PromptService();
export default promptService;
