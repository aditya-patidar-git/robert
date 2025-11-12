import authenticatedApiClient from '../api/authenticatedApi.js';

const kbService = {
  // Get all files from OpenAI
  async getAllFiles() {
    console.log('🔍 KB Service - Fetching files from /api/kb/files');
    try {
      const response = await authenticatedApiClient.get('/api/kb/files');
      console.log('🔍 KB Service - Response:', response.data);
      return response.data.files || [];
    } catch (error) {
      console.error('🔍 KB Service - Error:', error);
      throw error;
    }
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
  },

  // Get file content for viewing
  async getFileContent(fileId) {
    const response = await authenticatedApiClient.get(`/api/kb/files/${fileId}/content`);
    return response.data.content; // Return just the content object, not the full response
  },

  // Update file tags
  async updateFileTags(fileId, tags) {
    const response = await authenticatedApiClient.put(`/api/kb/files/${fileId}/tags`, {
      tags: Array.isArray(tags) ? tags : []
    });
    return response.data.file;
  },

  // Re-ingest a single file
  async reingestFile(fileId) {
    const response = await authenticatedApiClient.post(`/api/kb/files/${fileId}/reingest`);
    return response.data;
  },

  // Detect drift for a single file
  async detectFileDrift(fileId) {
    const response = await authenticatedApiClient.post(`/api/kb/files/${fileId}/detect-drift`);
    return response.data.drift;
  }
};

export default kbService;