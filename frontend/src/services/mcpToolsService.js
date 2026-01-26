import { BaseService } from './baseService';

/**
 * MCP Tools Service
 * Handles MCP tools configuration and management
 * @extends BaseService
 */
class MCPToolsService extends BaseService {
  constructor() {
    super('/api/admin/tools', {
      dataPath: 'tools',
      normalizeResponse: true
    });
  }

  /**
   * Get all MCP tools
   * @returns {Promise<Array<Object>>} Array of tool objects
   */
  async getAllTools() {
    try {
      console.log('🔍 [FRONTEND] Calling getAllTools API...');
      const response = await this.get('');
      console.log('📦 [FRONTEND] Raw response:', response);
      
      // After normalization with dataPath: 'tools', response.data is already the tools array
      // Backend returns: { success: true, tools: [...] }
      // After BaseService normalization: { success: true, data: [...tools array...] }
      
      // Check if response.data is already the array (normalized)
      if (Array.isArray(response?.data)) {
        console.log(`✅ [FRONTEND] Found ${response.data.length} tools in response.data`);
        return response.data;
      }
      
      // Fallback for different response structures
      if (response?.data?.tools) {
        console.log(`✅ [FRONTEND] Found ${response.data.tools.length} tools in response.data.tools`);
        return response.data.tools;
      }
      if (response?.tools) {
        console.log(`✅ [FRONTEND] Found ${response.tools.length} tools in response.tools`);
        return response.tools;
      }
      if (Array.isArray(response)) {
        console.log(`✅ [FRONTEND] Response is array with ${response.length} items`);
        return response;
      }
      
      console.warn('⚠️ [FRONTEND] No tools found in response, returning empty array');
      console.warn('⚠️ [FRONTEND] Response structure:', JSON.stringify(response, null, 2));
      return [];
    } catch (error) {
      console.error('❌ [FRONTEND] Error in getAllTools:', error);
      return [];
    }
  }

  /**
   * Get specific tool status
   * @param {string} toolName - Tool name
   * @returns {Promise<Object>} Tool status object
   */
  async getToolStatus(toolName) {
    const response = await this.get(`/${toolName}/status`);
    return response.data?.tool || response.data;
  }

  /**
   * Enable a tool
   * @param {string} toolName - Tool name
   * @returns {Promise<Object>} Operation result
   */
  async enableTool(toolName) {
    return this.post(`/${toolName}/enable`);
  }

  /**
   * Disable a tool
   * @param {string} toolName - Tool name
   * @returns {Promise<Object>} Operation result
   */
  async disableTool(toolName) {
    return this.post(`/${toolName}/disable`);
  }

  /**
   * Update rate limit for a tool
   * @param {string} toolName - Tool name
   * @param {number} newLimit - New rate limit
   * @returns {Promise<Object>} Updated tool configuration
   */
  async updateRateLimit(toolName, newLimit) {
    return this.put(`/${toolName}/rate-limit`, {
      newLimit
    });
  }

  /**
   * Update domain allowlist for a tool
   * @param {string} toolName - Tool name
   * @param {Array<string>} domains - Array of allowed domains
   * @returns {Promise<Object>} Updated tool configuration
   */
  async updateDomainAllowlist(toolName, domains) {
    return this.put(`/${toolName}/domains`, {
      domains
    });
  }

  /**
   * Get tool metrics
   * @param {string} toolName - Tool name
   * @returns {Promise<Object>} Tool metrics
   */
  async getToolMetrics(toolName) {
    const response = await this.get(`/${toolName}/metrics`);
    return response.data?.metrics || response.data;
  }

  /**
   * Update max time (timeout) for a tool
   * @param {string} toolName - Tool name
   * @param {number|null} maxTime - Max time in milliseconds (null for no limit)
   * @returns {Promise<Object>} Updated tool configuration
   */
  async updateMaxTime(toolName, maxTime) {
    return this.put(`/${toolName}`, {
      maxTime
    });
  }
}

// Export singleton instance
const mcpToolsService = new MCPToolsService();
export default mcpToolsService;
