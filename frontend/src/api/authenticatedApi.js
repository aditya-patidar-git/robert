import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002';

// Configuration constants
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000; // Base delay in milliseconds

// Create production-ready unified API client
const authenticatedApiClient = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track retry attempts for each request
const retryCounts = new Map();

// CSRF token cache (for double-submit cookie protection on admin/auth)
let csrfTokenCache = null;
async function getCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache;
  const res = await axios.get(`${API_BASE}/api/csrf-token`, { withCredentials: true });
  csrfTokenCache = res.data?.csrfToken || null;
  return csrfTokenCache;
}
function clearCsrfToken() {
  csrfTokenCache = null;
}

// Performance metrics tracking
const performanceMetrics = {
  requests: [],
  errors: [],
  getAverageResponseTime: () => {
    if (performanceMetrics.requests.length === 0) return 0;
    const total = performanceMetrics.requests.reduce((sum, req) => sum + req.duration, 0);
    return Math.round(total / performanceMetrics.requests.length);
  },
  getErrorRate: () => {
    const total = performanceMetrics.requests.length + performanceMetrics.errors.length;
    if (total === 0) return 0;
    return ((performanceMetrics.errors.length / total) * 100).toFixed(2);
  },
  clear: () => {
    performanceMetrics.requests = [];
    performanceMetrics.errors = [];
  }
};

// Generate unique request ID for tracing
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Structured logging utility
 * @param {string} level - Log level (info, error, warn, debug)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
const structuredLog = (level, message, metadata = {}) => {
  const logEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  if (import.meta.env.DEV) {
    const emoji = {
      info: 'ℹ️',
      error: '❌',
      warn: '⚠️',
      debug: '🔍',
      success: '✅'
    }[level] || '📝';
    
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `${emoji} [${metadata.requestId || 'N/A'}] ${message}`,
      Object.keys(metadata).length > 1 ? metadata : ''
    );
  }

  // In production, send to logging service
  if (import.meta.env.PROD && level === 'error') {
    // TODO: Send to error tracking service
    // errorTrackingService.log(logEntry);
  }
};

// Calculate exponential backoff delay
const getRetryDelay = (attempt) => {
  return RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
};

// Check if error is retryable
const isRetryableError = (error) => {
  if (!error.response) {
    // Network error - always retryable
    return true;
  }
  
  const status = error.response.status;
  // Retry on server errors (5xx) and specific client errors
  return status >= 500 || status === 408 || status === 429;
};

// Request interceptor with enhanced features
authenticatedApiClient.interceptors.request.use(
  async (config) => {
    // Generate unique request ID for tracing
    const requestId = generateRequestId();
    config.metadata = {
      requestId,
      startTime: Date.now(),
      ...config.metadata
    };

    // Add request ID to headers for backend tracing
    config.headers['X-Request-ID'] = requestId;

    // Get token from localStorage
    const token = localStorage.getItem('authToken');
    
    // Structured logging
    structuredLog('info', `Request: ${config.method?.toUpperCase()} ${config.url}`, {
      requestId,
      method: config.method?.toUpperCase(),
      url: config.url,
      hasToken: !!token
    });
    
    // Add auth token if available (works for both public and protected routes)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing requests to auth or admin
    const isStateChange = ['post', 'put', 'patch', 'delete'].includes((config.method || '').toLowerCase());
    const isAuthOrAdmin = config.url && (config.url.includes('/api/auth') || config.url.includes('/api/admin'));
    if (isStateChange && isAuthOrAdmin) {
      try {
        const csrfToken = await getCsrfToken();
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      } catch (e) {
        // Proceed without token; server will return 403 if required
      }
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with retry logic and error handling
authenticatedApiClient.interceptors.response.use(
  (response) => {
    // Calculate response time
    let duration = 0;
    if (response.config.metadata) {
      duration = Date.now() - response.config.metadata.startTime;
      
      // Track performance metrics
      performanceMetrics.requests.push({
        requestId: response.config.metadata.requestId,
        method: response.config.method,
        url: response.config.url,
        status: response.status,
        duration,
        timestamp: new Date().toISOString()
      });

      // Keep only last 100 requests for metrics
      if (performanceMetrics.requests.length > 100) {
        performanceMetrics.requests.shift();
      }

      // Structured logging
      structuredLog('success', `Response: ${response.status} (${duration}ms)`, {
        requestId: response.config.metadata.requestId,
        status: response.status,
        duration,
        method: response.config.method,
        url: response.config.url
      });
    }
    
    // Clear retry count on successful response
    if (response.config.metadata?.requestId) {
      retryCounts.delete(response.config.metadata.requestId);
    }
    
    return response;
  },
  async (error) => {
    const config = error.config;
    const requestId = config?.metadata?.requestId;
    
    if (!requestId) {
      console.error('❌ No request ID found in error config');
      return Promise.reject(error);
    }

    // Get current retry count
    const currentRetryCount = retryCounts.get(requestId) || 0;
    
    // Track error metrics
    const errorType = error.response ? `HTTP ${error.response.status}` : 'Network Error';
    const duration = config.metadata?.startTime ? Date.now() - config.metadata.startTime : 0;
    
    performanceMetrics.errors.push({
      requestId,
      method: config?.method,
      url: config?.url,
      errorType,
      status: error.response?.status,
      duration,
      attempt: currentRetryCount + 1,
      timestamp: new Date().toISOString()
    });

    // Keep only last 50 errors for metrics
    if (performanceMetrics.errors.length > 50) {
      performanceMetrics.errors.shift();
    }

    // Structured error logging
    structuredLog('error', `Error: ${errorType} (attempt ${currentRetryCount + 1})`, {
      requestId,
      errorType,
      status: error.response?.status,
      attempt: currentRetryCount + 1,
      retriesDisabled: config.metadata?.disableRetries || false,
      url: config?.url,
      method: config?.method
    });

    // Handle different error types
    if (error.response) {
      const status = error.response.status;
      
      // Handle 401 Unauthorized - attempt token refresh
      if (status === 401 && currentRetryCount === 0) {
        try {
          // Attempt to refresh token
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            console.log(`🔄 [${requestId}] Attempting token refresh...`);
            
            const refreshResponse = await axios.post(`${API_BASE}/api/auth/refresh`, {
              refreshToken
            });
            
            if (refreshResponse.data.token) {
              localStorage.setItem('authToken', refreshResponse.data.token);
              console.log(`✅ [${requestId}] Token refreshed successfully`);
              
              // Retry original request with new token
              config.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
              retryCounts.set(requestId, currentRetryCount + 1);
              return authenticatedApiClient(config);
            }
          }
        } catch (refreshError) {
          console.error(`❌ [${requestId}] Token refresh failed:`, refreshError);
          // Clear invalid tokens
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          
          // Redirect to login page
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
      
      // Handle 403 Forbidden - no retry; clear CSRF cache so next request refetches token
      if (status === 403) {
        console.error(`🚫 [${requestId}] Access forbidden - insufficient permissions`);
        retryCounts.delete(requestId);
        clearCsrfToken();
        return Promise.reject(error);
      }
      
      // Handle other HTTP errors
      if (isRetryableError(error) && currentRetryCount < MAX_RETRY_ATTEMPTS && !config.metadata?.disableRetries) {
        const delay = getRetryDelay(currentRetryCount + 1);
        console.log(`🔄 [${requestId}] Retrying in ${delay}ms... (attempt ${currentRetryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        retryCounts.set(requestId, currentRetryCount + 1);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(authenticatedApiClient(config));
          }, delay);
        });
      }
    } else {
      // Handle network errors
      if (currentRetryCount < MAX_RETRY_ATTEMPTS && !config.metadata?.disableRetries) {
        const delay = getRetryDelay(currentRetryCount + 1);
        console.log(`🔄 [${requestId}] Network error - retrying in ${delay}ms... (attempt ${currentRetryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        retryCounts.set(requestId, currentRetryCount + 1);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(authenticatedApiClient(config));
          }, delay);
        });
      }
    }
    
    // Max retries exceeded or non-retryable error
    console.error(`💥 [${requestId}] Max retries exceeded or non-retryable error`);
    retryCounts.delete(requestId);
    
    // Enhanced error object with more context
    const enhancedError = {
      ...error,
      requestId,
      retryCount: currentRetryCount,
      timestamp: new Date().toISOString(),
      url: config?.url,
      method: config?.method
    };
    
    return Promise.reject(enhancedError);
  }
);

// Add request cancellation support
authenticatedApiClient.createCancelToken = () => {
  return axios.CancelToken.source();
};

// Add utility method to check if error is due to cancellation
authenticatedApiClient.isCancel = axios.isCancel;

// Export performance metrics
authenticatedApiClient.getMetrics = () => ({
  averageResponseTime: performanceMetrics.getAverageResponseTime(),
  errorRate: performanceMetrics.getErrorRate(),
  totalRequests: performanceMetrics.requests.length,
  totalErrors: performanceMetrics.errors.length,
  recentRequests: performanceMetrics.requests.slice(-10),
  recentErrors: performanceMetrics.errors.slice(-10)
});

// Clear metrics utility
authenticatedApiClient.clearMetrics = () => {
  performanceMetrics.clear();
};

export default authenticatedApiClient;
