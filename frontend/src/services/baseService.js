import authenticatedApiClient from '../api/authenticatedApi';
import { normalizeResponse, normalizeErrorResponse } from '../utils/responseNormalizer';
import { createErrorFromAxiosError, APIError } from '../utils/errors';
import { handleErrorSilently } from '../utils/errorHandler';

/**
 * Base Service Class
 * Provides standardized methods for all services
 */
export class BaseService {
  /**
   * @param {string} baseEndpoint - Base API endpoint (e.g., '/api/kb')
   * @param {Object} options - Service options
   * @param {string} options.dataPath - Path to extract data from response (e.g., 'data', 'files')
   * @param {boolean} options.normalizeResponse - Whether to normalize responses (default: true)
   * @param {boolean} options.throwOnError - Whether to throw errors (default: true)
   */
  constructor(baseEndpoint, options = {}) {
    this.baseEndpoint = baseEndpoint;
    this.options = {
      dataPath: null,
      normalizeResponse: true,
      throwOnError: true,
      ...options
    };
    this.client = authenticatedApiClient;
  }

  /**
   * Build full URL from endpoint
   * @param {string} path - API path
   * @returns {string} Full URL
   */
  buildUrl(path) {
    if (path.startsWith('http')) {
      return path;
    }
    const base = this.baseEndpoint.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }

  /**
   * Handle response
   * @param {*} response - Axios response
   * @param {Object} options - Override options
   * @returns {*} Processed response
   */
  handleResponse(response, options = {}) {
    const opts = { ...this.options, ...options };
    
    if (opts.normalizeResponse) {
      return normalizeResponse(response, {
        dataPath: opts.dataPath || this.options.dataPath
      });
    }
    
    return response.data;
  }

  /**
   * Handle error
   * @param {Error} error - Error object
   * @param {Object} options - Override options
   * @throws {APIError} If throwOnError is true
   * @returns {*} Normalized error response if throwOnError is false
   */
  handleError(error, options = {}) {
    const opts = { ...this.options, ...options };
    const customError = createErrorFromAxiosError(error);
    
    // Log error silently
    handleErrorSilently(customError, {
      service: this.constructor.name,
      endpoint: this.baseEndpoint
    });

    if (opts.throwOnError) {
      throw customError;
    }

    return normalizeErrorResponse(error);
  }

  /**
   * GET request
   * @param {string} path - API path
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<*>} Response data
   */
  async get(path, params = {}, options = {}) {
    try {
      const url = this.buildUrl(path);
      const response = await this.client.get(url, {
        params,
        ...options
      });
      return this.handleResponse(response, options);
    } catch (error) {
      return this.handleError(error, options);
    }
  }

  /**
   * POST request
   * @param {string} path - API path
   * @param {*} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<*>} Response data
   */
  async post(path, data = {}, options = {}) {
    try {
      const url = this.buildUrl(path);
      const response = await this.client.post(url, data, options);
      return this.handleResponse(response, options);
    } catch (error) {
      return this.handleError(error, options);
    }
  }

  /**
   * PUT request
   * @param {string} path - API path
   * @param {*} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<*>} Response data
   */
  async put(path, data = {}, options = {}) {
    try {
      const url = this.buildUrl(path);
      const response = await this.client.put(url, data, options);
      return this.handleResponse(response, options);
    } catch (error) {
      return this.handleError(error, options);
    }
  }

  /**
   * PATCH request
   * @param {string} path - API path
   * @param {*} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<*>} Response data
   */
  async patch(path, data = {}, options = {}) {
    try {
      const url = this.buildUrl(path);
      const response = await this.client.patch(url, data, options);
      return this.handleResponse(response, options);
    } catch (error) {
      return this.handleError(error, options);
    }
  }

  /**
   * DELETE request
   * @param {string} path - API path
   * @param {Object} options - Request options
   * @returns {Promise<*>} Response data
   */
  async delete(path, options = {}) {
    try {
      const url = this.buildUrl(path);
      const response = await this.client.delete(url, options);
      return this.handleResponse(response, options);
    } catch (error) {
      return this.handleError(error, options);
    }
  }

  /**
   * Standard CRUD methods
   */

  /**
   * Get all resources
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<Array>} Array of resources
   */
  async getAll(params = {}, options = {}) {
    return this.get('', params, options);
  }

  /**
   * Get resource by ID
   * @param {string|number} id - Resource ID
   * @param {Object} options - Request options
   * @returns {Promise<*>} Resource data
   */
  async getById(id, options = {}) {
    return this.get(`/${id}`, {}, options);
  }

  /**
   * Create resource
   * @param {*} data - Resource data
   * @param {Object} options - Request options
   * @returns {Promise<*>} Created resource
   */
  async create(data, options = {}) {
    return this.post('', data, options);
  }

  /**
   * Update resource
   * @param {string|number} id - Resource ID
   * @param {*} data - Updated data
   * @param {Object} options - Request options
   * @returns {Promise<*>} Updated resource
   */
  async update(id, data, options = {}) {
    return this.put(`/${id}`, data, options);
  }

  /**
   * Delete resource
   * @param {string|number} id - Resource ID
   * @param {Object} options - Request options
   * @returns {Promise<*>} Deletion result
   */
  async deleteById(id, options = {}) {
    return this.delete(`/${id}`, options);
  }

  /**
   * Search resources
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Request options
   * @returns {Promise<Array>} Search results
   */
  async search(query, filters = {}, options = {}) {
    return this.post('/search', { query, ...filters }, options);
  }
}

