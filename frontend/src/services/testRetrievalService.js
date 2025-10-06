import authenticatedApiClient from '../api/authenticatedApi.js';

const testRetrievalService = {
  async testRetrieval(options = {}) {
    const response = await authenticatedApiClient.post('/api/test-retrieval/test', options);
    return response.data;
  },

  async testSpecificQuery(query, options = {}) {
    const response = await authenticatedApiClient.post('/api/test-retrieval/query', { query, ...options });
    return response.data;
  },

  async getTestQueries() {
    const response = await authenticatedApiClient.get('/api/test-retrieval/queries');
    return response.data;
  },

  async addTestQuery(query) {
    const response = await authenticatedApiClient.post('/api/test-retrieval/queries', { query });
    return response.data;
  },

  async removeTestQuery(query) {
    const response = await authenticatedApiClient.delete('/api/test-retrieval/queries', { data: { query } });
    return response.data;
  }
};

export default testRetrievalService;





