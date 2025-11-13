/**
 * Response normalization utilities
 * Standardizes API response formats across all services
 */

/**
 * Standard response format
 * @typedef {Object} NormalizedResponse
 * @property {boolean} success - Whether the request was successful
 * @property {*} data - Response data
 * @property {Object|null} error - Error object if request failed
 * @property {Object|null} metadata - Additional metadata
 */

/**
 * Normalize API response to standard format
 * @param {*} response - Axios response object
 * @param {Object} options - Normalization options
 * @returns {NormalizedResponse} Normalized response
 */
export const normalizeResponse = (response, options = {}) => {
  const {
    dataPath = null, // e.g., 'data', 'files', 'tools' - path to extract data from
    defaultData = null,
    includeMetadata = true
  } = options;

  if (!response || !response.data) {
    return {
      success: false,
      data: defaultData,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'Invalid response format'
      },
      metadata: includeMetadata ? {
        timestamp: new Date().toISOString()
      } : null
    };
  }

  const responseData = response.data;
  let data = responseData;

  // Extract data from nested path if specified
  if (dataPath) {
    const paths = dataPath.split('.');
    data = paths.reduce((obj, path) => obj?.[path], responseData);
    
    // If dataPath doesn't exist, try common patterns
    if (data === undefined) {
      data = responseData.data || responseData.files || responseData.tools || 
             responseData.mappings || responseData.voices || responseData.models || 
             responseData.capabilities || responseData;
    }
  } else {
    // Auto-detect common response patterns
    if (responseData.data !== undefined) {
      data = responseData.data;
    } else if (responseData.files !== undefined) {
      data = responseData.files;
    } else if (responseData.tools !== undefined) {
      data = responseData.tools;
    } else if (responseData.mappings !== undefined) {
      data = responseData.mappings;
    } else if (responseData.voices !== undefined) {
      data = responseData.voices;
    } else if (responseData.models !== undefined) {
      data = responseData.models;
    } else if (responseData.capabilities !== undefined) {
      data = responseData.capabilities;
    } else if (Array.isArray(responseData)) {
      data = responseData;
    } else {
      data = responseData;
    }
  }

  // Handle case where data is still undefined
  if (data === undefined) {
    data = defaultData;
  }

  return {
    success: true,
    data: data,
    error: null,
    metadata: includeMetadata ? {
      timestamp: new Date().toISOString(),
      requestId: response.config?.metadata?.requestId,
      statusCode: response.status,
      headers: response.headers
    } : null
  };
};

/**
 * Normalize error response
 * @param {Error} error - Error object
 * @returns {NormalizedResponse} Normalized error response
 */
export const normalizeErrorResponse = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    return {
      success: false,
      data: null,
      error: {
        code: data?.code || `HTTP_${status}`,
        message: data?.message || data?.error || error.message || 'An error occurred',
        statusCode: status,
        details: data?.details || data
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: error.config?.metadata?.requestId
      }
    };
  }

  return {
    success: false,
    data: null,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An error occurred',
      details: error
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: error.config?.metadata?.requestId
    }
  };
};

/**
 * Extract data from response (backward compatibility)
 * @param {*} response - Response object
 * @param {string} path - Path to data (e.g., 'data.files')
 * @returns {*} Extracted data
 */
export const extractData = (response, path = null) => {
  const normalized = normalizeResponse(response, { dataPath: path });
  return normalized.data;
};

