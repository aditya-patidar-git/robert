import { BaseService } from './baseService';

/**
 * Service Factory
 * Creates service instances with standardized configuration
 */

/**
 * Service registry - stores service instances
 */
const serviceRegistry = new Map();

/**
 * Service configurations
 * Maps service names to their configurations
 */
const serviceConfigs = {
  'kb': {
    endpoint: '/api/kb',
    dataPath: 'files',
    normalizeResponse: true
  },
  'ai': {
    endpoint: '/api/admin/ai',
    dataPath: null,
    normalizeResponse: true
  },
  'mcp-tools': {
    endpoint: '/api/mcp-tools',
    dataPath: 'tools',
    normalizeResponse: true
  },
  'language-voice': {
    endpoint: '/api/admin/language-voice-mappings',
    dataPath: 'mappings',
    normalizeResponse: true
  },
  'voice': {
    endpoint: '/api/admin/audio-telephony/voices',
    dataPath: 'voices',
    normalizeResponse: true
  },
  'config': {
    endpoint: '/api/admin',
    dataPath: 'config',
    normalizeResponse: true
  },
  'system': {
    endpoint: '/api/system',
    dataPath: null,
    normalizeResponse: true
  },
  'auth': {
    endpoint: '/api/auth',
    dataPath: null,
    normalizeResponse: true
  },
  'transcript': {
    endpoint: '/api/transcripts',
    dataPath: null,
    normalizeResponse: true
  },
  'privacy': {
    endpoint: '/api/privacy',
    dataPath: null,
    normalizeResponse: true
  },
  'observability': {
    endpoint: '/api/observability',
    dataPath: null,
    normalizeResponse: true
  },
  'user': {
    endpoint: '/api/users',
    dataPath: null,
    normalizeResponse: true
  },
  'dashboard': {
    endpoint: '/api/dashboard',
    dataPath: null,
    normalizeResponse: true
  }
};

/**
 * Create a service instance
 * @param {string} name - Service name (e.g., 'kb', 'ai')
 * @param {Object} customConfig - Custom configuration to override defaults
 * @returns {BaseService} Service instance
 */
export const createService = (name, customConfig = {}) => {
  // Check if service already exists in registry
  if (serviceRegistry.has(name)) {
    return serviceRegistry.get(name);
  }

  // Get configuration
  const config = serviceConfigs[name] || {};
  const finalConfig = {
    ...config,
    ...customConfig
  };

  // Create service instance
  const service = new BaseService(finalConfig.endpoint || `/api/${name}`, {
    dataPath: finalConfig.dataPath,
    normalizeResponse: finalConfig.normalizeResponse !== false
  });

  // Store in registry
  serviceRegistry.set(name, service);

  return service;
};

/**
 * Get existing service from registry
 * @param {string} name - Service name
 * @returns {BaseService|null} Service instance or null
 */
export const getService = (name) => {
  return serviceRegistry.get(name) || null;
};

/**
 * Create a custom service with full control
 * @param {string} endpoint - Base API endpoint
 * @param {Object} options - Service options
 * @returns {BaseService} Service instance
 */
export const createCustomService = (endpoint, options = {}) => {
  return new BaseService(endpoint, options);
};

/**
 * Clear service registry (useful for testing)
 */
export const clearServiceRegistry = () => {
  serviceRegistry.clear();
};

/**
 * Register a service configuration
 * @param {string} name - Service name
 * @param {Object} config - Service configuration
 */
export const registerServiceConfig = (name, config) => {
  serviceConfigs[name] = config;
};

// Export commonly used services as convenience functions
export const kbService = () => createService('kb');
export const aiService = () => createService('ai');
export const mcpToolsService = () => createService('mcp-tools');
export const voiceService = () => createService('voice');
export const configService = () => createService('config');
export const systemService = () => createService('system');

