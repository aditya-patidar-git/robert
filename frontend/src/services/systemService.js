import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const systemService = {
  // Get system configuration
  async getSystemConfig() {
    const response = await apiClient.get('/api/system/config');
    return response.data;
  },

  // Update system configuration
  async updateSystemConfig(configData) {
    const response = await apiClient.put('/api/system/config', configData);
    return response.data;
  },

  // Get MCP tools
  async getMCPTools() {
    const response = await apiClient.get('/api/system/mcp-tools');
    return response.data;
  },

  // Execute MCP tool
  async executeMCPTool(toolName, parameters) {
    const response = await apiClient.post('/api/system/mcp-tools/execute', {
      tool: toolName,
      parameters
    });
    return response.data;
  },

  // Get available models
  async getAvailableModels() {
    const response = await apiClient.get('/api/system/models');
    return response.data;
  },

  // Update model configuration
  async updateModelConfig(modelId, config) {
    const response = await apiClient.put(`/api/system/models/${modelId}`, config);
    return response.data;
  },

  // System backup
  async createBackup() {
    const response = await apiClient.post('/api/system/backup');
    return response.data;
  },

  // System restore
  async restoreBackup(backupId) {
    const response = await apiClient.post(`/api/system/restore/${backupId}`);
    return response.data;
  }
};

export default systemService;