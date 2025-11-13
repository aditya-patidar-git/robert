/**
 * Custom error classes for standardized error handling
 */

/**
 * Base API Error class
 */
export class APIError extends Error {
  constructor(message, code, statusCode, details = null) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Network Error - connection issues, timeouts
 */
export class NetworkError extends Error {
  constructor(message, originalError = null) {
    super(message || 'Network error occurred. Please check your connection.');
    this.name = 'NetworkError';
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      originalError: this.originalError?.message,
      timestamp: this.timestamp
    };
  }
}

/**
 * Validation Error - client-side validation failures
 */
export class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      field: this.field,
      value: this.value,
      timestamp: this.timestamp
    };
  }
}

/**
 * Authentication Error - 401, 403 errors
 */
export class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed', statusCode = 401, details = null) {
    super(message, 'AUTH_ERROR', statusCode, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error - permission denied
 */
export class AuthorizationError extends APIError {
  constructor(message = 'Access denied', details = null) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * NotFound Error - 404 errors
 */
export class NotFoundError extends APIError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Server Error - 500+ errors
 */
export class ServerError extends APIError {
  constructor(message = 'Server error occurred', statusCode = 500, details = null) {
    super(message, 'SERVER_ERROR', statusCode, details);
    this.name = 'ServerError';
  }
}

/**
 * Timeout Error - request timeout
 */
export class TimeoutError extends Error {
  constructor(message = 'Request timeout', timeout = null) {
    super(message);
    this.name = 'TimeoutError';
    this.timeout = timeout;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timeout: this.timeout,
      timestamp: this.timestamp
    };
  }
}

/**
 * Create appropriate error from axios error
 * @param {Error} error - Axios error object
 * @returns {APIError|NetworkError|TimeoutError} Appropriate error instance
 */
export const createErrorFromAxiosError = (error) => {
  if (!error.response) {
    // Network error or timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new TimeoutError('Request timeout', error.config?.timeout);
    }
    return new NetworkError('Network error occurred', error);
  }

  const { status, data } = error.response;
  const message = data?.message || data?.error || error.message || 'An error occurred';
  const code = data?.code || `HTTP_${status}`;
  const details = data?.details || data;

  switch (status) {
    case 401:
      return new AuthenticationError(message, status, details);
    case 403:
      return new AuthorizationError(message, details);
    case 404:
      return new NotFoundError(message, details);
    case 400:
    case 422:
      return new APIError(message, code, status, details);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, status, details);
    default:
      return new APIError(message, code, status, details);
  }
};

