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
   * @param {Object} options - Backup options
   * @returns {Promise<Object>} Backup result
   */
  async createBackup(options = {}) {
    return this.post('/backup', options);
  }

  /**
   * List all backups
   * @returns {Promise<Object>} List of backups
   */
  async listBackups() {
    return this.get('/backups');
  }

  /**
   * Get backup details
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Backup details
   */
  async getBackupDetails(backupId) {
    return this.get(`/backups/${backupId}`);
  }

  /**
   * Delete backup
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteBackup(backupId) {
    return this.delete(`/backups/${backupId}`);
  }

  /**
   * Restore system backup
   * @param {string} backupId - Backup ID
   * @param {Object} options - Restore options
   * @returns {Promise<Object>} Restore result
   */
  async restoreBackup(backupId, options = {}) {
    return this.post(`/restore/${backupId}`, options);
  }

  /**
   * Get restore preview
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Preview result
   */
  async getRestorePreview(backupId) {
    return this.get(`/restore/${backupId}/preview`);
  }
}

// Export singleton instance
const systemService = new SystemService();
export default systemService;
