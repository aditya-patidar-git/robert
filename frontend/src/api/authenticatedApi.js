import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

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

// Generate unique request ID for tracing
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  (config) => {
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
    
    // Log request details (only in development)
    if (import.meta.env.DEV) {
      console.log(`🔐 [${requestId}] Request: ${config.method?.toUpperCase()} ${config.url}`);
      console.log(`🔐 [${requestId}] Token: ${token ? 'Present' : 'Missing'}`);
    }
    
    // Add auth token if available (works for both public and protected routes)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    // Log response time for monitoring
    if (response.config.metadata) {
      const duration = Date.now() - response.config.metadata.startTime;
      if (import.meta.env.DEV) {
        console.log(`✅ [${response.config.metadata.requestId}] Response: ${response.status} (${duration}ms)`);
      }
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
    
    // Log error details
    if (import.meta.env.DEV) {
      const errorType = error.response ? `HTTP ${error.response.status}` : 'Network Error';
      console.error(`❌ [${requestId}] Error: ${errorType} (attempt ${currentRetryCount + 1})`);
    }

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
      
      // Handle 403 Forbidden - no retry, just log
      if (status === 403) {
        console.error(`🚫 [${requestId}] Access forbidden - insufficient permissions`);
        retryCounts.delete(requestId);
        return Promise.reject(error);
      }
      
      // Handle other HTTP errors
      if (isRetryableError(error) && currentRetryCount < MAX_RETRY_ATTEMPTS) {
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
      if (currentRetryCount < MAX_RETRY_ATTEMPTS) {
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

export default authenticatedApiClient;
