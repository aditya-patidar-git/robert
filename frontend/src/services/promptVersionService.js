import authenticatedApiClient from '../api/authenticatedApi';

const promptVersionService = {
  // Get all prompt versions
  async getPromptVersions(promptId = 'global') {
    const response = await authenticatedApiClient.get('/api/admin/ai/prompt/versions', {
      params: { promptId }
    });
    return response.data.versions || [];
  },

  // Get specific version by ID
  async getPromptVersion(versionId) {
    const response = await authenticatedApiClient.get(`/api/admin/ai/prompt/versions/${versionId}`);
    return response.data.version;
  },

  // Get current active version
  async getCurrentVersion(promptId = 'global') {
    const response = await authenticatedApiClient.get('/api/admin/ai/prompt/versions/current', {
      params: { promptId }
    });
    return response.data.version;
  },

  // Compare two versions
  async compareVersions(versionId1, versionId2) {
    const response = await authenticatedApiClient.get(
      `/api/admin/ai/prompt/versions/compare/${versionId1}/${versionId2}`
    );
    return response.data.comparison;
  },

  // Rollback to specific version
  async rollbackToVersion(versionId, changeReason = '') {
    const response = await authenticatedApiClient.post(
      `/api/admin/ai/prompt/versions/${versionId}/rollback`,
      { changeReason }
    );
    return response.data;
  }
};

export default promptVersionService;

