import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const transcriptService = {
  // Get all transcripts
  async getAllTranscripts() {
    const response = await apiClient.get('/api/transcripts');
    return response.data;
  },

  // Get transcript by ID
  async getTranscript(transcriptId) {
    const response = await apiClient.get(`/api/transcripts/${transcriptId}`);
    return response.data;
  },

  // Search transcripts
  async searchTranscripts(query, filters = {}) {
    const response = await apiClient.get('/api/transcripts/search', {
      params: { q: query, ...filters }
    });
    return response.data;
  },

  // Export transcripts
  async exportTranscripts(format = 'csv', filters = {}) {
    const response = await apiClient.get('/api/transcripts/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
    return response.data;
  },

  // Delete transcript
  async deleteTranscript(transcriptId) {
    const response = await apiClient.delete(`/api/transcripts/${transcriptId}`);
    return response.data;
  }
};

export default transcriptService;