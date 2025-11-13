import { BaseService } from './baseService';

/**
 * System Service
 * Handles system configuration, MCP tools, models, and backups
 * @extends BaseService
 */
class SystemService extends BaseService {
  constructor() {
    super('/api/system', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get system configuration
   * @returns {Promise<Object>} System configuration
   */
  async getSystemConfig() {
    return this.get('/config');
  }

  /**
   * Update system configuration
   * @param {Object} configData - Configuration data
   * @returns {Promise<Object>} Updated configuration
   */
  async updateSystemConfig(configData) {
    return this.put('/config', configData);
  }

  /**
   * Get MCP tools
   * @returns {Promise<Object>} MCP tools data
   */
  async getMCPTools() {
    return this.get('/mcp-tools');
  }

  /**
   * Execute MCP tool
   * @param {string} toolName - Tool name
   * @param {Object} parameters - Tool parameters
   * @returns {Promise<Object>} Execution result
   */
  async executeMCPTool(toolName, parameters) {
    return this.post('/mcp-tools/execute', {
      tool: toolName,
      parameters
    });
  }

  /**
   * Get available models
   * @returns {Promise<Object>} Available models
   */
  async getAvailableModels() {
    return this.get('/models');
  }

  /**
   * Update model configuration
   * @param {string} modelId - Model ID
   * @param {Object} config - Model configuration
   * @returns {Promise<Object>} Updated model configuration
   */
  async updateModelConfig(modelId, config) {
    return this.put(`/models/${modelId}`, config);
  }

  /**
   * Create system backup
   * @returns {Promise<Object>} Backup result
   */
  async createBackup() {
    return this.post('/backup');
  }

  /**
   * Restore system backup
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Restore result
   */
  async restoreBackup(backupId) {
    return this.post(`/restore/${backupId}`);
  }
}

// Export singleton instance
const systemService = new SystemService();
export default systemService;
