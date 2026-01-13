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
 * @param {boolean} options.enableRecording - Enable call recording (default: false)
 * @param {string} options.recordingStatusCallback - URL for recording status callback
 * @param {boolean} options.useConnect - Use <Connect> verb for bidirectional streaming (default: false)
 *   - <Start><Stream>: UNIDIRECTIONAL - receive audio only, cannot send audio back
 *   - <Connect><Stream>: BIDIRECTIONAL - can send and receive audio (required for inbound calls)
 * @returns {string} - TwiML XML string
 */
export function generateMediaStreamsTwiML(wsUrl, options = {}) {
  const track = options.track || 'both_tracks';
  const pauseLength = options.pauseLength || 3600;
  const enableRecording = options.enableRecording || false;
  const recordingStatusCallback = options.recordingStatusCallback;
  const useConnect = options.useConnect || false;
  
  // NOTE: <Record> verb conflicts with Media Streams and can cause audio silence
  // Recording should be handled via Twilio API (using record: true in call creation)
  // instead of TwiML verb when using Media Streams
  let recordingXml = '';
  if (enableRecording && recordingStatusCallback) {
    console.warn('⚠️ [TwiML] <Record> verb with Media Streams may cause audio issues. Consider using Twilio API for recording instead.');
    recordingXml = `
  <Record 
    recordingStatusCallback="${recordingStatusCallback}"
    recordingStatusCallbackMethod="POST"
    recordingChannels="dual"
  />`;
  }
  
  // Use <Connect> for bidirectional streaming (required for sending audio back to Twilio)
  // Use <Start> for unidirectional streaming (receive only)
  if (useConnect) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" track="${track}"/>
  </Connect>
  <Pause length="${pauseLength}"/>
</Response>`;
  }
  
  // Default: Use <Start> for unidirectional streaming (outbound calls may use this)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}" track="${track}"/>
  </Start>${recordingXml}
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

