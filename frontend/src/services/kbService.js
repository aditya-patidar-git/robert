import authenticatedApiClient from '../api/authenticatedApi.js';

const kbService = {
  // Get all files from OpenAI
  async getAllFiles() {
    const response = await authenticatedApiClient.get('/api/kb/files');
    return response.data.files || [];
  },

  // Get file by ID
  async getFile(fileId) {
    const response = await authenticatedApiClient.get(`/api/kb/files/${fileId}`);
    return response.data.file;
  },

  // Upload file to OpenAI
  async uploadFile(file, tags = []) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tags', JSON.stringify(tags));

    const response = await authenticatedApiClient.post('/api/kb/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.file;
  },

  // Delete file from OpenAI
  async deleteFile(fileId) {
    const response = await authenticatedApiClient.delete(`/api/kb/files/${fileId}`);
    return response.data;
  },

  // Search files using OpenAI File Search
  async searchFiles(query, fileIds = null) {
    const response = await authenticatedApiClient.post('/api/kb/search', {
      query,
      fileIds
    });
    return response.data;
  },

  // Get vector store status
  async getVectorStoreStatus() {
    const response = await authenticatedApiClient.get('/api/kb/vector-store/status');
    return response.data.vectorStore;
  }
};

export default kbService;