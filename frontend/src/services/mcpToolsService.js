import authenticatedApiClient from '../api/authenticatedApi';

const mcpToolsService = {
  // Get all MCP tools
  async getAllTools() {
    const response = await authenticatedApiClient.get('/api/mcp-tools');
    return response.data.tools || [];
  },

  // Get specific tool status
  async getToolStatus(toolName) {
    const response = await authenticatedApiClient.get(`/api/mcp-tools/${toolName}/status`);
    return response.data.tool;
  },

  // Enable a tool
  async enableTool(toolName) {
    const response = await authenticatedApiClient.post(`/api/mcp-tools/${toolName}/enable`);
    return response.data;
  },

  // Disable a tool
  async disableTool(toolName) {
    const response = await authenticatedApiClient.post(`/api/mcp-tools/${toolName}/disable`);
    return response.data;
  },

  // Update rate limit for a tool
  async updateRateLimit(toolName, newLimit) {
    const response = await authenticatedApiClient.put(`/api/mcp-tools/${toolName}/rate-limit`, {
      newLimit
    });
    return response.data;
  },

  // Update domain allowlist for a tool
  async updateDomainAllowlist(toolName, domains) {
    const response = await authenticatedApiClient.put(`/api/mcp-tools/${toolName}/domains`, {
      domains
    });
    return response.data;
  },

  // Get tool metrics
  async getToolMetrics(toolName) {
    const response = await authenticatedApiClient.get(`/api/mcp-tools/${toolName}/metrics`);
    return response.data.metrics;
  }
};

export default mcpToolsService;

