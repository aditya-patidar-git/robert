import { BaseService } from './baseService';

/**
 * MCP Tools Service
 * Handles MCP tools configuration and management
 * @extends BaseService
 */
class MCPToolsService extends BaseService {
  constructor() {
    super('/api/mcp-tools', {
      dataPath: 'tools',
      normalizeResponse: true
    });
  }

  /**
   * Get all MCP tools
   * @returns {Promise<Array<Object>>} Array of tool objects
   */
  async getAllTools() {
    const response = await this.get('');
    return response.data || [];
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
}

// Export singleton instance
const mcpToolsService = new MCPToolsService();
export default mcpToolsService;
