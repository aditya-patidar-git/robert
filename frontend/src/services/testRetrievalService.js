import { BaseService } from './baseService';

/**
 * Test Retrieval Service
 * Handles retrieval testing and query management
 * @extends BaseService
 */
class TestRetrievalService extends BaseService {
  constructor() {
    super('/api/test-retrieval', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Test retrieval
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test result
   */
  async testRetrieval(options = {}) {
    return this.post('/test', options);
  }

  /**
   * Test specific query
   * @param {string} query - Query to test
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test result
   */
  async testSpecificQuery(query, options = {}) {
    return this.post('/query', { query, ...options });
  }

  /**
   * Get test queries
   * @returns {Promise<Array<string>>} Array of test queries
   */
  async getTestQueries() {
    return this.get('/queries');
  }

  /**
   * Add test query
   * @param {string} query - Query to add
   * @returns {Promise<Object>} Add result
   */
  async addTestQuery(query) {
    return this.post('/queries', { query });
  }

  /**
   * Remove test query
   * @param {string} query - Query to remove
   * @returns {Promise<Object>} Remove result
   */
  async removeTestQuery(query) {
    return this.delete('/queries', {
      data: { query }
    });
  }
}

// Export singleton instance
const testRetrievalService = new TestRetrievalService();
export default testRetrievalService;
