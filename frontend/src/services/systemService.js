import authenticatedApiClient from '../api/authenticatedApi.js';

const systemService = {
  // Get system configuration
  async getSystemConfig() {
    const response = await authenticatedApiClient.get('/api/system/config');
    return response.data;
  },

  // Update system configuration
  async updateSystemConfig(configData) {
    const response = await authenticatedApiClient.put('/api/system/config', configData);
    return response.data;
  },

  // Get MCP tools
  async getMCPTools() {
    const response = await authenticatedApiClient.get('/api/system/mcp-tools');
    return response.data;
  },

  // Execute MCP tool
  async executeMCPTool(toolName, parameters) {
    const response = await authenticatedApiClient.post('/api/system/mcp-tools/execute', {
      tool: toolName,
      parameters
    });
    return response.data;
  },

  // Get available models
  async getAvailableModels() {
    const response = await authenticatedApiClient.get('/api/system/models');
    return response.data;
  },

  // Update model configuration
  async updateModelConfig(modelId, config) {
    const response = await authenticatedApiClient.put(`/api/system/models/${modelId}`, config);
    return response.data;
  },

  // System backup
  async createBackup() {
    const response = await authenticatedApiClient.post('/api/system/backup');
    return response.data;
  },

  // System restore
  async restoreBackup(backupId) {
    const response = await authenticatedApiClient.post(`/api/system/restore/${backupId}`);
    return response.data;
  }
};

export default systemService;