/**
 * Check if an error is retryable
 * Extracted from retryHandler.js - only function actually used
 * @param {Error} error - Error to check
 * @param {Array<string>} retryableErrors - List of retryable error keywords
 * @returns {boolean} True if error is retryable
 */
export function isRetryableError(error, retryableErrors = []) {
  const defaultRetryableErrors = [
    'timeout',
    'network',
    'connection',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'rate limit',
    'too many requests',
    '429',
    '500',
    '502',
    '503',
    '504',
    'temporary',
    'unavailable',
    'service unavailable'
  ];

  const allRetryableErrors = [...defaultRetryableErrors, ...retryableErrors];
  const errorMessage = (error.message || String(error)).toLowerCase();
  const errorCode = error.code || error.status || error.statusCode;

  // Check error message (case-insensitive so e.g. ENOTFOUND matches "enotfound" in lowercased message)
  if (allRetryableErrors.some(keyword => errorMessage.includes(keyword.toLowerCase()))) {
    return true;
  }

  // Check HTTP status codes
  if (errorCode) {
    const statusCode = String(errorCode);
    if (['429', '500', '502', '503', '504'].includes(statusCode)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an error is a network-related error (DNS, connection, etc.)
 * Used to suppress noisy logs for expected network failures
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is network-related
 */
export function isNetworkError(error) {
  const networkErrorCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH'];
  const errorCode = error.code || error.errno;
  const errorMessage = (error.message || String(error)).toLowerCase();
  
  if (errorCode && networkErrorCodes.includes(errorCode)) {
    return true;
  }
  
  if (errorMessage.includes('getaddrinfo') || 
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('enotfound')) {
    return true;
  }
  
  return false;
}
