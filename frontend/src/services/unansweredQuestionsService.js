import { BaseService } from './baseService';

/**
 * Unanswered Questions Service
 * Handles fetching unanswered questions from the backend
 * @extends BaseService
 */
class UnansweredQuestionsService extends BaseService {
  constructor() {
    super('/api/unanswered-questions', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get unanswered questions with optional filters
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Filter by status (pending, answered, dismissed)
   * @param {string} filters.priority - Filter by priority (low, medium, high)
   * @param {number} filters.limit - Maximum number of results
   * @param {number} filters.skip - Number of results to skip
   * @param {string} filters.sortBy - Field to sort by
   * @param {number} filters.sortOrder - Sort order (1 for ascending, -1 for descending)
   * @param {string} filters.startDate - Start date for date range filter
   * @param {string} filters.endDate - End date for date range filter
   * @returns {Promise<Object>} Response with questions array and pagination info
   */
  async getUnansweredQuestions(filters = {}) {
    const queryParams = new URLSearchParams();
    
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.priority) queryParams.append('priority', filters.priority);
    if (filters.limit) queryParams.append('limit', filters.limit);
    if (filters.skip) queryParams.append('skip', filters.skip);
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);

    const queryString = queryParams.toString();
    const url = queryString ? `/?${queryString}` : '/';
    
    const response = await this.get(url);
    return response.data || response;
  }
}

// Export singleton instance
const unansweredQuestionsService = new UnansweredQuestionsService();
export default unansweredQuestionsService;
