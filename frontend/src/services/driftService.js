import authenticatedApiClient from '../api/authenticatedApi.js';

const driftService = {
  async getDriftStatus() {
    const response = await authenticatedApiClient.get('/api/drift/status');
    return response.data;
  },

  async startDriftDetection() {
    const response = await authenticatedApiClient.post('/api/drift/detect');
    return response.data;
  },

  async getFilesWithDrift() {
    const response = await authenticatedApiClient.get('/api/drift/files');
    return response.data;
  },

  async clearDriftFlags(fileIds) {
    const response = await authenticatedApiClient.post('/api/drift/clear', { fileIds });
    return response.data;
  }
};

export default driftService;





