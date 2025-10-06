import authenticatedApiClient from '../api/authenticatedApi.js';

const reingestService = {
  async getReingestStatus() {
    const response = await authenticatedApiClient.get('/api/reingest/status');
    return response.data;
  },

  async startReingest(fileIds = null) {
    const response = await authenticatedApiClient.post('/api/reingest/start', { fileIds });
    return response.data;
  },

  async getFilesNeedingReingest() {
    const response = await authenticatedApiClient.get('/api/reingest/files');
    return response.data;
  },

  async scheduleReingest(fileIds, delay = 0) {
    const response = await authenticatedApiClient.post('/api/reingest/schedule', { fileIds, delay });
    return response.data;
  }
};

export default reingestService;





