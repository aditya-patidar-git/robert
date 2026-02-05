/**
 * URL Builder for integration tests
 */
class UrlBuilder {
  static getBaseUrl(options = {}) {
    if (options.forceLocalhost) return 'http://localhost:3002';
    if (process.env.TUNNEL_DOMAIN) return `https://${process.env.TUNNEL_DOMAIN}`;
    if (process.env.BASE_URL) return process.env.BASE_URL;
    if (process.env.AGENT_SERVICE_URL) return process.env.AGENT_SERVICE_URL;
    return 'http://localhost:3002';
  }
  static buildWebhookUrl(endpoint = '/api/inbound/incoming-call', options = {}) {
    const baseUrl = this.getBaseUrl(options);
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }
  static buildMediaStreamsUrl(callSid, options = {}) {
    const baseUrl = this.getBaseUrl(options);
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${wsProtocol}://${wsHost}/media-stream?callSid=${callSid}`;
  }
  static buildTestMediaStreamsUrl(callSid, options = {}) {
    const baseUrl = this.getBaseUrl(options);
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${wsProtocol}://${wsHost}/media-stream-test?callSid=${callSid}`;
  }
  static isUsingTunnel() { return !!process.env.TUNNEL_DOMAIN; }
}
export default UrlBuilder;
