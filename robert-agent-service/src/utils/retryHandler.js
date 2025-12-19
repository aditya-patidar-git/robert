/**
 * Retry Handler with Exponential Backoff and Jitter
 * Centralized retry logic for external API calls
 */

/**
 * Retry strategies
 */
export const RetryStrategy = {
  IMMEDIATE: 'immediate',      // No delay between retries
  LINEAR: 'linear',            // Linear backoff: baseDelay * attempt
  EXPONENTIAL: 'exponential'   // Exponential backoff: baseDelay * 2^attempt
};

/**
 * Calculate retry delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {Object} options - Retry options
 * @returns {number} Delay in milliseconds
 */
export function calculateRetryDelay(attempt, options = {}) {
  const {
    strategy = RetryStrategy.EXPONENTIAL,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = true
  } = options;

  let delay;

  switch (strategy) {
    case RetryStrategy.IMMEDIATE:
      delay = 0;
      break;
    case RetryStrategy.LINEAR:
      delay = baseDelay * (attempt + 1);
      break;
    case RetryStrategy.EXPONENTIAL:
    default:
      delay = baseDelay * Math.pow(2, attempt);
      break;
  }

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter to prevent thundering herd problem
  if (jitter) {
    // Full jitter: random between 0 and calculated delay
    delay = Math.random() * delay;
  }

  return Math.floor(delay);
}

/**
 * Check if an error is retryable
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

  // Check error message
  if (allRetryableErrors.some(keyword => errorMessage.includes(keyword))) {
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
 * Execute a function with retry logic
 * @param {Function} fn - Function to execute (must return a Promise)
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Function result
 */
export async function retry(fn, options = {}) {
  const {
    maxRetries = 3,
    strategy = RetryStrategy.EXPONENTIAL,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = true,
    retryableErrors = [],
    onRetry = null,
    shouldRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      const shouldRetryError = shouldRetry 
        ? shouldRetry(error, attempt)
        : isRetryableError(error, retryableErrors);

      // If this is the last attempt or error is not retryable, throw
      if (attempt >= maxRetries || !shouldRetryError) {
        throw error;
      }

      // Calculate delay before next retry
      const delay = calculateRetryDelay(attempt, {
        strategy,
        baseDelay,
        maxDelay,
        jitter
      });

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      // Wait before retrying
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Retry handler class for managing retry configurations per service
 */
export class RetryHandler {
  constructor() {
    this.configs = new Map();
    this.stats = new Map(); // Track retry statistics per service
  }

  /**
   * Register retry configuration for a service
   * @param {string} serviceName - Name of the service
   * @param {Object} config - Retry configuration
   */
  registerService(serviceName, config) {
    this.configs.set(serviceName, {
      maxRetries: 3,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true,
      retryableErrors: [],
      ...config
    });
  }

  /**
   * Execute function with service-specific retry configuration
   * @param {string} serviceName - Name of the service
   * @param {Function} fn - Function to execute
   * @param {Object} overrides - Override default config for this call
   * @returns {Promise<any>} Function result
   */
  async execute(serviceName, fn, overrides = {}) {
    const config = this.configs.get(serviceName) || {
      maxRetries: 3,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true
    };

    const finalConfig = { ...config, ...overrides };

    // Track retry attempts
    if (!this.stats.has(serviceName)) {
      this.stats.set(serviceName, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        retryAttempts: 0
      });
    }

    const stats = this.stats.get(serviceName);
    stats.totalCalls++;

    try {
      const result = await retry(fn, {
        ...finalConfig,
        onRetry: (error, attempt, delay) => {
          stats.retryAttempts++;
          if (finalConfig.onRetry) {
            finalConfig.onRetry(error, attempt, delay);
          }
        }
      });
      
      stats.successfulCalls++;
      return result;
    } catch (error) {
      stats.failedCalls++;
      throw error;
    }
  }

  /**
   * Get retry statistics for a service
   * @param {string} serviceName - Name of the service
   * @returns {Object} Statistics
   */
  getStats(serviceName) {
    return this.stats.get(serviceName) || {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      retryAttempts: 0
    };
  }

  /**
   * Get all retry statistics
   * @returns {Object} All statistics
   */
  getAllStats() {
    const allStats = {};
    this.stats.forEach((stats, serviceName) => {
      allStats[serviceName] = stats;
    });
    return allStats;
  }

  /**
   * Reset statistics for a service
   * @param {string} serviceName - Name of the service
   */
  resetStats(serviceName) {
    if (this.stats.has(serviceName)) {
      this.stats.set(serviceName, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        retryAttempts: 0
      });
    }
  }
}

// Export singleton instance
const retryHandler = new RetryHandler();

// Register default configurations for common services
retryHandler.registerService('openai', {
  maxRetries: 3,
  strategy: RetryStrategy.EXPONENTIAL,
  baseDelay: 2000,
  maxDelay: 30000,
  retryableErrors: ['429', '500', '502', '503', '504', 'rate limit']
});

retryHandler.registerService('brave', {
  maxRetries: 2,
  strategy: RetryStrategy.EXPONENTIAL,
  baseDelay: 1000,
  maxDelay: 10000
});

retryHandler.registerService('crm', {
  maxRetries: 2,
  strategy: RetryStrategy.LINEAR,
  baseDelay: 2000,
  maxDelay: 10000
});

export default retryHandler;

