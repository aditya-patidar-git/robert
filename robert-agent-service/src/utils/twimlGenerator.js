/**
 * TwiML Generator Utility
 * Reusable utility for generating TwiML responses for different call routing methods
 * Follows single-responsibility principle and promotes code reusability
 */

/**
 * Generate TwiML for SIP routing
 * Routes call to OpenAI SIP endpoint using <Dial><Sip> verb
 * @param {string} sipEndpoint - OpenAI SIP endpoint URI (e.g., sip:endpoint@openai.com)
 * @param {Object} options - Additional options
 * @param {number} options.pauseLength - Pause length in seconds (default: 3600)
 * @returns {string} - TwiML XML string
 */
export function generateSipRoutingTwiML(sipEndpoint, options = {}) {
  const pauseLength = options.pauseLength || 3600;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>${sipEndpoint}</Sip>
  </Dial>
  <Pause length="${pauseLength}"/>
</Response>`;
}

/**
 * Generate TwiML for Media Streams routing
 * Routes call to WebSocket Media Stream endpoint
 * @param {string} wsUrl - WebSocket URL for Media Stream
 * @param {Object} options - Additional options
 * @param {string} options.track - Track type: 'inbound', 'outbound', or 'both_tracks' (default: 'both_tracks')
 * @param {number} options.pauseLength - Pause length in seconds (default: 3600)
 * @returns {string} - TwiML XML string
 */
export function generateMediaStreamsTwiML(wsUrl, options = {}) {
  const track = options.track || 'both_tracks';
  const pauseLength = options.pauseLength || 3600;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}" track="${track}"/>
  </Start>
  <Pause length="${pauseLength}"/>
</Response>`;
}

/**
 * Generate TwiML for blocking a call
 * @param {string} message - Message to say before hanging up
 * @returns {string} - TwiML XML string
 */
export function generateBlockedCallTwiML(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate minimal TwiML to keep call alive
 * Used as fallback when routing cannot be determined
 * @param {number} pauseLength - Pause length in seconds (default: 3600)
 * @returns {string} - TwiML XML string
 */
export function generateMinimalTwiML(pauseLength = 3600) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="${pauseLength}"/>
</Response>`;
}

/**
 * Generate error TwiML
 * @param {string} message - Error message to say
 * @returns {string} - TwiML XML string
 */
export function generateErrorTwiML(message = 'An error occurred. Please try again later.') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Build WebSocket URL for Media Streams
 * @param {string} callSid - Call SID
 * @param {Object} options - Options
 * @param {string} options.baseUrl - Base URL (default: from env vars)
 * @returns {string} - WebSocket URL
 */
export function buildMediaStreamsWsUrl(callSid, options = {}) {
  const baseUrl = options.baseUrl || 
    (process.env.TUNNEL_DOMAIN ? `https://${process.env.TUNNEL_DOMAIN}` : process.env.BASE_URL || 'http://localhost:3002');
  
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  return `${wsProtocol}://${wsHost}/media-stream?callSid=${callSid}`;
}

