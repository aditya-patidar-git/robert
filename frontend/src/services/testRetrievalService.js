import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const testRetrievalService = {
  async testRetrieval(options = {}) {
    const response = await apiClient.post('/api/test-retrieval/test', options);
    return response.data;
  },

  async testSpecificQuery(query, options = {}) {
    const response = await apiClient.post('/api/test-retrieval/query', { query, ...options });
    return response.data;
  },

  async getTestQueries() {
    const response = await apiClient.get('/api/test-retrieval/queries');
    return response.data;
  },

  async addTestQuery(query) {
    const response = await apiClient.post('/api/test-retrieval/queries', { query });
    return response.data;
  },

  async removeTestQuery(query) {
    const response = await apiClient.delete('/api/test-retrieval/queries', { data: { query } });
    return response.data;
  }
};

export default testRetrievalService;
