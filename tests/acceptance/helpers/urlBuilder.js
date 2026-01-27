/**
 * URL Builder Utility
 * Reusable utility for building URLs for webhooks and Media Streams
 * Single responsibility: URL construction only
 * Supports both tunnel (Cloudflare) and direct connection scenarios
 */

class UrlBuilder {
  /**
   * Get base URL for agent service
   * Priority: TUNNEL_DOMAIN > BASE_URL > AGENT_SERVICE_URL > localhost:3002
   * @param {Object} options - Options
   * @param {boolean} options.forceLocalhost - Force localhost (for testing)
   * @returns {string} Base URL
   */
  static getBaseUrl(options = {}) {
    if (options.forceLocalhost) {
      return 'http://localhost:3002';
    }

    // Priority: TUNNEL_DOMAIN > BASE_URL > AGENT_SERVICE_URL > default
    if (process.env.TUNNEL_DOMAIN) {
      return `https://${process.env.TUNNEL_DOMAIN}`;
    }

    if (process.env.BASE_URL) {
      return process.env.BASE_URL;
    }

    if (process.env.AGENT_SERVICE_URL) {
      return process.env.AGENT_SERVICE_URL;
    }

    // Default to localhost:3002 (agent service port)
    return 'http://localhost:3002';
  }

  /**
   * Build webhook URL for Twilio call handling
   * @param {string} endpoint - API endpoint (e.g., '/api/inbound/handle-call')
   * @param {Object} options - Options
   * @returns {string} Full webhook URL
   */
  static buildWebhookUrl(endpoint = '/api/inbound/handle-call', options = {}) {
    const baseUrl = this.getBaseUrl(options);
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }

  /**
   * Build Media Streams WebSocket URL
   * @param {string} callSid - Call SID
   * @param {Object} options - Options
   * @returns {string} WebSocket URL
   */
  static buildMediaStreamsUrl(callSid, options = {}) {
    const baseUrl = this.getBaseUrl(options);
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    return `${wsProtocol}://${wsHost}/media-stream?callSid=${callSid}`;
  }

  /**
   * Check if using tunnel
   * @returns {boolean} True if TUNNEL_DOMAIN is set
   */
  static isUsingTunnel() {
    return !!process.env.TUNNEL_DOMAIN;
  }
}

export default UrlBuilder;
