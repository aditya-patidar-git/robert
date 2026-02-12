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
 * @param {string} options.track - Track type (only used with <Start> verb):
 *   - 'inbound_track', 'outbound_track', or 'both_tracks' (default: 'both_tracks')
 *   - When useConnect=true, track is automatically set to 'inbound_track' (Twilio requirement)
 * @param {number} options.pauseLength - Pause length in seconds (default: 3600)
 * @param {boolean} options.enableRecording - Enable call recording (default: false)
 * @param {string} options.recordingStatusCallback - URL for recording status callback
 * @param {boolean} options.useConnect - Use <Connect> verb for bidirectional streaming (default: false)
 *   - <Start><Stream>: UNIDIRECTIONAL - receive audio only, cannot send audio back
 *     Supports: 'inbound_track', 'outbound_track', or 'both_tracks'
 *   - <Connect><Stream>: BIDIRECTIONAL - can send and receive audio (required for inbound calls)
 *     REQUIRES: 'inbound_track' only (Twilio Error 31941 if other values used)
 *     Note: You still send audio back by specifying track='outbound' in media messages
 * @returns {string} - TwiML XML string
 */
export function generateMediaStreamsTwiML(wsUrl, options = {}) {
  const pauseLength = options.pauseLength || 3600;
  const enableRecording = options.enableRecording || false;
  const recordingStatusCallback = options.recordingStatusCallback;
  const useConnect = options.useConnect || false;
  
  // CRITICAL FIX: When using <Connect>, track must be "inbound_track" (not "both_tracks")
  // According to Twilio Error 31941: <Connect> only accepts "inbound_track"
  // However, <Connect> still allows bidirectional communication - you send audio back
  // by specifying track="outbound" in your media messages to Twilio
  // When using <Start>, you can use "inbound_track", "outbound_track", or "both_tracks"
  const track = useConnect 
    ? 'inbound_track'  // <Connect> requires "inbound_track" only
    : (options.track || 'both_tracks');  // <Start> can use any track value
  
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
  <Say>${escapeTwiMLText(message)}</Say>
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
  <Say>${escapeTwiMLText(message)}</Say>
  <Hangup/>
</Response>`;
}

function escapeTwiMLText(text) {
  if (!text || typeof text !== 'string') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate TwiML for voicemail: Say message, Say greeting, Record with maxLength and callback.
 * @param {Object} options
 * @param {string} options.message - After-hours or context message
 * @param {string} options.greeting - Instruction to leave a message
 * @param {number} options.maxDuration - Max recording seconds (capped for Twilio)
 * @param {string} options.recordingStatusCallback - URL for recording completion
 * @returns {string} - TwiML XML string
 */
export function generateVoicemailTwiML(options = {}) {
  const message = escapeTwiMLText(options.message || '');
  const greeting = escapeTwiMLText(options.greeting || 'Please leave your name, number, and a brief message after the tone.');
  const maxDuration = Math.min(Math.max(1, parseInt(options.maxDuration, 10) || 300), 14400);
  const callback = options.recordingStatusCallback || '';
  const callbackAttr = callback ? ` recordingStatusCallback="${callback}" recordingStatusCallbackMethod="POST"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message}</Say>
  <Say>${greeting}</Say>
  <Record maxLength="${maxDuration}"${callbackAttr}/>
  <Hangup/>
</Response>`;
}

/**
 * Generate TwiML to dial a number with action URL (e.g. for after-hours transfer chain).
 * @param {string} number - Phone number to dial
 * @param {string} actionUrl - URL Twilio will request when dial ends (no-answer, busy, etc.)
 * @param {number} [timeout=25] - Ring timeout in seconds
 * @returns {string} - TwiML XML string
 */
export function generateDialWithActionTwiML(number, actionUrl, timeout = 25) {
  const num = escapeTwiMLText(String(number || ''));
  const url = escapeTwiMLText(String(actionUrl || ''));
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${Math.max(5, Math.min(120, timeout))}" action="${url}" method="POST">
    <Number>${num}</Number>
  </Dial>
  <Hangup/>
</Response>`;
}

const ALL_OCCUPIED_MESSAGE = 'All our agents are occupied at the moment. Can we try again after a while, or would you prefer we contact you?';

/**
 * Generate TwiML for "all transfer numbers failed" (Say + Hangup).
 * @param {string} [message] - Optional custom message
 * @returns {string} - TwiML XML string
 */
export function generateAllOccupiedTwiML(message = ALL_OCCUPIED_MESSAGE) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeTwiMLText(message)}</Say>
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

