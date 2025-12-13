/**
 * SIP Call Router
 * Handles SIP call routing with retry logic and fallback to Media Streams
 */

import sipService from '../sipService.js';

class SipCallRouter {
  /**
   * Attempt to route call via SIP with retry logic
   * @param {Object} twilioClient - Twilio client instance
   * @param {string} to - Destination number
   * @param {string} from - Source number
   * @param {Object} options - Routing options
   * @returns {Promise<Object|null>} - Call object or null if failed
   */
  async attemptSipRouting(twilioClient, to, from, options = {}) {
    if (!sipService.isSipEnabled()) {
      return null;
    }

    // Validate endpoint before attempting
    const endpointValidation = sipService.validateEndpoint();
    if (!endpointValidation.valid) {
      console.warn(`⚠️ [SIP] Endpoint validation failed: ${endpointValidation.error}`);
      return null;
    }

    const maxRetries = options.maxRetries || sipService.retryConfig.maxRetries;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`📞 [SIP] Attempt ${attempt + 1}/${maxRetries} to route call via SIP: ${to}`);

        // Note: Actual SIP routing is configured in Twilio Elastic SIP Trunk
        // The trunk routes to OpenAI Realtime SIP endpoint
        // This function validates SIP is available but doesn't create the call
        // The call creation happens via Twilio trunk configuration
        
        // For now, SIP calls come through the SIP webhook handler (handleCallAccept)
        // Outbound SIP calls would need Twilio trunk configured to route to OpenAI SIP endpoint
        // This is a placeholder that returns null to trigger Media Streams fallback
        
        // TODO: When Twilio SIP trunk is configured, this should:
        // 1. Create call via Twilio with SIP routing
        // 2. Or return indication that SIP routing should be used
        // For now, we fallback to Media Streams
        
        console.log(`⚠️ [SIP] SIP trunk routing not yet implemented, will use Media Streams`);
        return null;

      } catch (error) {
        lastError = error;
        console.error(`❌ [SIP] Attempt ${attempt + 1} failed:`, error.message);

        // Don't retry on last attempt
        if (attempt < maxRetries - 1) {
          const delay = sipService.getRetryDelay(attempt);
          console.log(`⏳ [SIP] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    console.error(`❌ [SIP] All ${maxRetries} attempts failed. Last error:`, lastError?.message);
    return null;
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if SIP should be used for a call
   * @param {Object} telephonyConfig - Telephony configuration
   * @returns {boolean} - True if SIP should be used
   */
  shouldUseSip(telephonyConfig) {
    // Check if SIP is enabled in config and service
    const sipEnabled = telephonyConfig?.sipSettings?.primaryPath === 'sip' && sipService.isSipEnabled();
    
    if (!sipEnabled) {
      return false;
    }

    // Additional checks can be added here (e.g., number whitelist, time-based routing)
    return true;
  }

  /**
   * Route call with SIP fallback to Media Streams
   * @param {Object} twilioClient - Twilio client instance
   * @param {string} to - Destination number
   * @param {string} from - Source number
   * @param {Object} telephonyConfig - Telephony configuration
   * @param {Object} mediaStreamsOptions - Media Streams call options
   * @returns {Promise<Object>} - Call object and method used
   */
  async routeCall(twilioClient, to, from, telephonyConfig, mediaStreamsOptions) {
    const useSip = this.shouldUseSip(telephonyConfig);
    let call = null;
    let method = 'Media Streams';

    if (useSip) {
      // Attempt SIP routing with retry
      call = await this.attemptSipRouting(twilioClient, to, from, {
        maxRetries: sipService.retryConfig.maxRetries
      });

      if (call) {
        method = 'SIP';
        console.log(`✅ [SIP] Call routed via SIP: ${to}`);
      } else {
        // Fallback to Media Streams
        console.log(`📞 [SIP] SIP routing failed, falling back to Media Streams for ${to}`);
      }
    }

    // Use Media Streams if SIP not used or failed
    if (!call) {
      call = await twilioClient.calls.create(mediaStreamsOptions);
      method = 'Media Streams';
    }

    return { call, method };
  }
}

export default new SipCallRouter();

