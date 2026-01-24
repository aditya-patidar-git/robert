/**
 * SIP Service
 * Handles OpenAI Realtime SIP connector configuration and management
 * Primary path: Twilio Elastic SIP Trunk → OpenAI Realtime SIP endpoint
 * Falls back to Media Streams if SIP is not available
 */

// dotenv is already loaded in index.js, no need to reload here
import sipValidation from "./sip/sipValidation.js";
import sipSessionManager from "./sip/sipSessionManager.js";
import sipStatusTracker from "./sip/sipStatusTracker.js";

class SipService {
  constructor() {
    this.openaiSipEndpoint = process.env.OPENAI_SIP_ENDPOINT || null;
    this.sipEnabled = process.env.SIP_ENABLED === 'true' || false;
    this.retryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    };
  }

  /**
   * Check if SIP is enabled and configured
   * @returns {boolean} - True if SIP is available
   */
  isSipEnabled() {
    return this.sipEnabled && this.openaiSipEndpoint !== null;
  }

  /**
   * Validate SIP endpoint configuration
   * @returns {Object} - Validation result
   */
  validateEndpoint() {
    if (!this.openaiSipEndpoint) {
      return {
        valid: false,
        error: 'SIP endpoint not configured'
      };
    }

    return sipValidation.validateEndpointUrl(this.openaiSipEndpoint);
  }

  /**
   * Get OpenAI SIP endpoint URL
   * @returns {string|null} - SIP endpoint URL or null
   */
  getSipEndpoint() {
    return this.openaiSipEndpoint;
  }

  /**
   * Get tool execution webhook URL
   * @returns {string|null} - Webhook URL or null if not configured
   */
  getToolExecutionWebhookUrl() {
    const baseUrl = process.env.TUNNEL_DOMAIN 
      ? `https://${process.env.TUNNEL_DOMAIN}` 
      : process.env.BASE_URL || null;
    
    if (!baseUrl) {
      return null;
    }

    // Remove trailing slash if present
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    return `${cleanBaseUrl}/api/sip/tool-execution`;
  }

  /**
   * Configure SIP session for OpenAI Realtime
   * @param {Object} config - Configuration object
   * @param {string} config.voice - Voice ID
   * @param {string} config.instructions - System instructions
   * @param {Array} config.tools - Tool definitions
   * @param {Object} config.sessionParams - Additional session parameters
   * @returns {Object} - SIP configuration for OpenAI
   */
  configureSipSession(config) {
    if (!this.isSipEnabled()) {
      throw new Error('SIP is not enabled or configured');
    }

    // Validate endpoint before configuring
    const endpointValidation = this.validateEndpoint();
    if (!endpointValidation.valid) {
      throw new Error(`SIP endpoint validation failed: ${endpointValidation.error}`);
    }

    // Get tool execution webhook URL
    const toolExecutionWebhookUrl = this.getToolExecutionWebhookUrl();

    const sessionConfig = {
      modalities: ['audio', 'text'],
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw',
      turn_detection: {
        type: 'server_vad',
        threshold: config.vadThreshold || 0.5,
        prefix_padding_ms: config.startPadding || 300,
        silence_duration_ms: config.endPadding || 500
      },
      temperature: config.temperature || 0.4,
      ...config.sessionParams
    };

    // Add tool execution webhook if configured
    // OpenAI Realtime SIP connector may support this in session config
    // If not supported directly, tools will use the webhook URL configured in OpenAI dashboard
    if (toolExecutionWebhookUrl) {
      // Note: OpenAI may require webhook URL to be configured in their dashboard
      // This is included here for reference and potential future API support
      sessionConfig.tool_execution_webhook_url = toolExecutionWebhookUrl;
    }

    return {
      voice: config.voice || 'ash',
      instructions: config.instructions || 'You are a friendly AI assistant.',
      tools: config.tools || [],
      session: sessionConfig,
      // Include webhook URL in response for reference (OpenAI may use this)
      tool_execution_webhook_url: toolExecutionWebhookUrl
    };
  }

  /**
   * Validate SIP configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} - Validation result
   */
  validateSipConfig(config) {
    const errors = [];

    if (!config.voice) {
      errors.push('Voice is required');
    }

    if (!config.instructions) {
      errors.push('Instructions are required');
    }

    // Use validation module for endpoint/URI validation if provided
    if (config.endpoint) {
      const endpointValidation = sipValidation.validateEndpointUrl(config.endpoint);
      if (!endpointValidation.valid) {
        errors.push(endpointValidation.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create SIP session
   * @param {string} callId - Call ID
   * @param {Object} sessionData - Session data
   * @returns {Object} - Session object
   */
  createSession(callId, sessionData = {}) {
    return sipSessionManager.createSession(callId, sessionData);
  }

  /**
   * Get SIP session
   * @param {string} callId - Call ID
   * @returns {Object|null} - Session object or null
   */
  getSession(callId) {
    return sipSessionManager.getSession(callId);
  }

  /**
   * Update SIP session
   * @param {string} callId - Call ID
   * @param {Object} updates - Updates to apply
   */
  updateSession(callId, updates) {
    sipSessionManager.updateSession(callId, updates);
  }

  /**
   * Delete SIP session
   * @param {string} callId - Call ID
   */
  deleteSession(callId) {
    sipSessionManager.deleteSession(callId);
    sipStatusTracker.cleanup(callId);
  }

  /**
   * Track SIP status
   * @param {string} callId - Call ID
   * @param {string} status - Status
   * @param {Object} metadata - Additional metadata
   */
  trackStatus(callId, status, metadata = {}) {
    sipStatusTracker.trackStatus(callId, status, metadata);
  }

  /**
   * Handle SIP error
   * @param {string} callId - Call ID
   * @param {number} errorCode - Error code
   * @param {string} errorMessage - Error message
   */
  handleError(callId, errorCode, errorMessage) {
    sipStatusTracker.handleErrorCode(callId, errorCode, errorMessage);
  }

  /**
   * Get retry delay for exponential backoff
   * @param {number} attempt - Attempt number (0-indexed)
   * @returns {number} - Delay in milliseconds
   */
  getRetryDelay(attempt) {
    const delay = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Get session statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      activeSessions: sipSessionManager.getSessionCount(),
      isEnabled: this.isSipEnabled(),
      endpoint: this.openaiSipEndpoint ? 'configured' : 'not configured'
    };
  }

  /**
   * Validate SIP configuration on startup
   * Performs comprehensive validation of SIP endpoint, credentials, and configuration
   * @returns {Object} - Validation result with details
   */
  validateOnStartup() {
    const result = {
      valid: false,
      enabled: this.sipEnabled,
      errors: [],
      warnings: [],
      details: {}
    };

    // Check if SIP is enabled
    if (!this.sipEnabled) {
      result.warnings.push('SIP is not enabled (SIP_ENABLED != true)');
      return result;
    }

    // Validate endpoint format
    const endpointValidation = this.validateEndpoint();
    if (!endpointValidation.valid) {
      result.errors.push(`SIP endpoint validation failed: ${endpointValidation.error}`);
      result.details.endpoint = {
        configured: !!this.openaiSipEndpoint,
        value: this.openaiSipEndpoint ? 'configured' : 'not configured',
        error: endpointValidation.error
      };
      return result;
    }

    result.details.endpoint = {
      configured: true,
      value: this.openaiSipEndpoint,
      format: 'valid'
    };

    // Validate authentication credentials format (if provided)
    const sipUsername = process.env.SIP_AUTH_USERNAME;
    const sipPassword = process.env.SIP_AUTH_PASSWORD;
    
    if (sipUsername || sipPassword) {
      if (!sipUsername || !sipPassword) {
        result.warnings.push('SIP authentication partially configured - both username and password are required');
      } else {
        result.details.auth = {
          configured: true,
          username: sipUsername ? 'configured' : 'not configured'
        };
      }
    } else {
      result.details.auth = {
        configured: false,
        note: 'No SIP authentication configured (may use IP-based auth)'
      };
    }

    // Check webhook URL configuration
    const webhookUrl = process.env.BASE_URL || process.env.TUNNEL_DOMAIN;
    if (!webhookUrl) {
      result.warnings.push('Webhook URL not configured (BASE_URL or TUNNEL_DOMAIN) - OpenAI call.accept webhooks may fail');
    } else {
      result.details.webhook = {
        configured: true,
        url: webhookUrl
      };
      
      // Test webhook accessibility (async, don't block)
      this.testWebhookAccessibility(webhookUrl).then(accessible => {
        if (!accessible) {
          console.warn(`⚠️ [SIP] Webhook URL may not be publicly accessible: ${webhookUrl}`);
        }
      }).catch(() => {
        // Ignore errors in async check
      });
    }

    // Validate Twilio SIP trunk SID format (if provided)
    const sipTrunkSid = process.env.TWILIO_SIP_TRUNK_SID;
    if (sipTrunkSid) {
      // Twilio SIP trunk SID format: TK followed by 32 hex characters
      const trunkSidPattern = /^TK[a-f0-9]{32}$/i;
      if (trunkSidPattern.test(sipTrunkSid)) {
        result.details.sipTrunk = {
          configured: true,
          sid: sipTrunkSid.substring(0, 8) + '...' // Show partial SID for security
        };
      } else {
        result.warnings.push(`Twilio SIP trunk SID format appears invalid: ${sipTrunkSid.substring(0, 10)}...`);
        result.details.sipTrunk = {
          configured: true,
          sid: sipTrunkSid.substring(0, 8) + '...',
          format: 'invalid'
        };
      }
    } else {
      result.details.sipTrunk = {
        configured: false,
        note: 'TWILIO_SIP_TRUNK_SID not configured'
      };
    }

    // Check environment variable completeness
    const requiredVars = ['OPENAI_SIP_ENDPOINT'];
    const optionalVars = ['TWILIO_SIP_TRUNK_SID', 'BASE_URL', 'TUNNEL_DOMAIN', 'SIP_AUTH_USERNAME', 'SIP_AUTH_PASSWORD'];
    
    const missingRequired = requiredVars.filter(v => !process.env[v]);
    if (missingRequired.length > 0) {
      result.errors.push(`Missing required environment variables: ${missingRequired.join(', ')}`);
    }

    result.details.environment = {
      required: requiredVars.map(v => ({
        name: v,
        configured: !!process.env[v]
      })),
      optional: optionalVars.map(v => ({
        name: v,
        configured: !!process.env[v]
      }))
    };

    // If we have endpoint and no critical errors, mark as valid
    if (result.errors.length === 0) {
      result.valid = true;
    }

    return result;
  }

  /**
   * Test webhook URL accessibility
   * @private
   * @param {string} baseUrl - Base URL to test
   * @returns {Promise<boolean>} True if accessible
   */
  async testWebhookAccessibility(baseUrl) {
    try {
      const testUrl = `${baseUrl}/api/sip/health`;
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export default new SipService();

