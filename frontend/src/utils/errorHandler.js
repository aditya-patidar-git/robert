import { createErrorFromAxiosError } from './errors';

/**
 * Error handling utilities
 */

/**
 * Get user-friendly error message
 * @param {Error} error - Error object
 * @returns {string} User-friendly message
 */
export const getUserFriendlyMessage = (error) => {
  if (!error) return 'An unexpected error occurred';

  // Handle custom error classes
  if (error.name === 'APIError' || error.name === 'AuthenticationError' || 
      error.name === 'AuthorizationError' || error.name === 'NotFoundError' ||
      error.name === 'ServerError') {
    return error.message || 'An error occurred';
  }

  if (error.name === 'NetworkError') {
    return 'Connection error. Please check your internet connection and try again.';
  }

  if (error.name === 'TimeoutError') {
    return 'Request timed out. Please try again.';
  }

  if (error.name === 'ValidationError') {
    return error.message || 'Validation error';
  }

  // Handle axios errors
  if (error.response) {
    const { status, data } = error.response;
    
    if (data?.message) {
      return data.message;
    }

    switch (status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Please log in to continue.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 422:
        return 'Validation error. Please check your input.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      case 504:
        return 'Request timeout. Please try again.';
      default:
        return `Error ${status}: ${data?.error || 'An error occurred'}`;
    }
  }

  // Handle network errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Log error for debugging
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export const logError = (error, context = {}) => {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  };

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('Error occurred:', errorInfo);
  }

  // In production, you might want to send to error tracking service
  // e.g., Sentry, LogRocket, etc.
  if (import.meta.env.PROD) {
    // TODO: Send to error tracking service
    // errorTrackingService.captureException(error, context);
  }
};

/**
 * Handle error and show toast notification
 * @param {Error} error - Error object
 * @param {Object} options - Options
 * @param {string} options.defaultMessage - Default message if error message not available
 * @param {boolean} options.showToast - Whether to show toast (default: true)
 * @param {Function} options.onError - Custom error handler
 */
export const handleError = (error, options = {}) => {
  const {
    defaultMessage = 'An error occurred',
    showToast = true,
    onError = null
  } = options;

  // Convert axios error to custom error if needed
  const customError = error.response ? createErrorFromAxiosError(error) : error;

  // Log error
  logError(customError, options.context);

  // Get user-friendly message
  const message = getUserFriendlyMessage(customError) || defaultMessage;

  // Show toast if enabled
  // Note: Toast should be shown from the component using handleError
  // This function just returns the error info for the component to handle
  if (showToast && import.meta.env.DEV) {
    console.error('Error (toast should be shown by component):', message);
  }

  // Call custom error handler if provided
  if (onError) {
    onError(customError, message);
  }

  return {
    error: customError,
    message,
    userFriendlyMessage: message
  };
};

/**
 * Handle error with toast (convenience function)
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default message
 */
export const handleErrorWithToast = (error, defaultMessage = 'An error occurred') => {
  return handleError(error, {
    defaultMessage,
    showToast: true
  });
};

/**
 * Handle error silently (no toast)
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export const handleErrorSilently = (error, context = {}) => {
  return handleError(error, {
    showToast: false,
    context
  });
};

