/**
 * SIP Validation Module
 * Validates SIP endpoint configuration and connectivity
 */

class SipValidation {
  /**
   * Validate SIP URI format
   * @param {string} uri - SIP URI to validate
   * @returns {Object} - Validation result
   */
  validateSipUri(uri) {
    if (!uri || typeof uri !== 'string') {
      return {
        valid: false,
        error: 'SIP URI is required and must be a string'
      };
    }

    // Basic SIP URI format: sip:user@domain:port or sip:domain:port
    const sipUriPattern = /^sip:[^@]+@[^:]+(?::\d+)?$/i;
    if (!sipUriPattern.test(uri)) {
      return {
        valid: false,
        error: `Invalid SIP URI format: ${uri}. Expected format: sip:user@domain:port`
      };
    }

    return { valid: true };
  }

  /**
   * Validate SIP endpoint URL
   * @param {string} endpoint - Endpoint URL
   * @returns {Object} - Validation result
   */
  validateEndpointUrl(endpoint) {
    if (!endpoint || typeof endpoint !== 'string') {
      return {
        valid: false,
        error: 'SIP endpoint URL is required'
      };
    }

    try {
      const url = new URL(endpoint);
      if (!['http:', 'https:', 'sip:', 'sips:'].includes(url.protocol)) {
        return {
          valid: false,
          error: `Invalid endpoint protocol: ${url.protocol}. Must be http, https, sip, or sips`
        };
      }
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid endpoint URL format: ${error.message}`
      };
    }
  }

  /**
   * Validate authentication credentials
   * @param {Object} credentials - Auth credentials
   * @returns {Object} - Validation result
   */
  validateCredentials(credentials) {
    if (!credentials) {
      return {
        valid: false,
        error: 'Authentication credentials are required'
      };
    }

    // Check for username/password or IP-based auth
    if (credentials.username && !credentials.password) {
      return {
        valid: false,
        error: 'Password is required when username is provided'
      };
    }

    if (credentials.password && !credentials.username) {
      return {
        valid: false,
        error: 'Username is required when password is provided'
      };
    }

    // IP-based auth doesn't need username/password
    if (!credentials.username && !credentials.password && !credentials.allowedIPs) {
      return {
        valid: false,
        error: 'Either username/password or allowed IPs must be configured'
      };
    }

    return { valid: true };
  }

  /**
   * Validate complete SIP configuration
   * @param {Object} config - SIP configuration
   * @returns {Object} - Validation result with errors array
   */
  validateSipConfig(config) {
    const errors = [];

    if (!config.endpoint) {
      errors.push('SIP endpoint is required');
    } else {
      const endpointValidation = this.validateEndpointUrl(config.endpoint);
      if (!endpointValidation.valid) {
        errors.push(endpointValidation.error);
      }
    }

    if (config.uri) {
      const uriValidation = this.validateSipUri(config.uri);
      if (!uriValidation.valid) {
        errors.push(uriValidation.error);
      }
    }

    if (config.credentials) {
      const credValidation = this.validateCredentials(config.credentials);
      if (!credValidation.valid) {
        errors.push(credValidation.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new SipValidation();

