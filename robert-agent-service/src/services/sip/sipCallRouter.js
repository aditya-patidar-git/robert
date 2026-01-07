/**
 * SIP Call Router
 * Handles SIP call routing with retry logic and fallback to Media Streams
 */

import sipService from '../sipService.js';
import sipHealthMonitor from './sipHealthMonitor.js';

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

        // Get SIP configuration
        const sipEndpoint = sipService.getSipEndpoint();
        if (!sipEndpoint) {
          console.warn(`⚠️ [SIP] SIP endpoint not configured, falling back to Media Streams`);
          return null;
        }

        // For outbound calls via SIP:
        // 1. Create Twilio call that routes through Elastic SIP Trunk
        // 2. The trunk configuration in Twilio routes to OpenAI SIP endpoint
        // 3. OpenAI sends call.accept webhook to our service
        
        // Get SIP trunk SID from options or environment
        const sipTrunkSid = options.sipTrunkSid || process.env.TWILIO_SIP_TRUNK_SID;
        
        if (!sipTrunkSid) {
          console.warn(`⚠️ [SIP] SIP trunk SID not configured. For SIP routing, configure TWILIO_SIP_TRUNK_SID or pass sipTrunkSid in options. Falling back to Media Streams.`);
          return null;
        }

        // Create call via Twilio with SIP routing
        // For SIP connector: Routing happens at Twilio SIP Trunk level (configured in Twilio console)
        // The trunk should be configured to route to OpenAI SIP endpoint
        // Trim phone number to remove leading/trailing spaces
        const trimmedTo = (options.sipUri || to).trim();
        
        console.log(`📞 [SIP] Creating Twilio call via SIP trunk to: ${trimmedTo}`);
        console.log(`📞 [SIP] Note: Ensure Twilio SIP Trunk is configured to route to OpenAI SIP endpoint`);
        
        // Get base URL for status callbacks
        const baseUrl = process.env.TUNNEL_DOMAIN 
          ? `https://${process.env.TUNNEL_DOMAIN}` 
          : process.env.BASE_URL || 'http://localhost:3002';
        
        // For SIP connector, we need to provide a URL that returns TwiML with <Sip> verb
        // Twilio requires either 'url' or 'twiml' parameter when creating calls
        // The webhook will return TwiML with <Sip> verb that routes to OpenAI's SIP endpoint
        const sipWebhookUrl = options.sipWebhookUrl || `${baseUrl}/api/sip/call-handler`;
        
        const callOptions = {
          to: trimmedTo, // Use phone number directly
          from: from,
          // For SIP connector, provide URL that returns TwiML with <Sip> verb
          // The <Sip> verb routes the call to OpenAI's SIP endpoint
          // OpenAI will then send call.accept webhook to /api/sip/call-accept
          url: sipWebhookUrl,
          // Status callback for tracking
          statusCallback: options.statusCallback || `${baseUrl}/api/outbound/call-status`,
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          // SIP-specific options
          sipAuthUsername: options.sipAuthUsername || process.env.SIP_AUTH_USERNAME,
          sipAuthPassword: options.sipAuthPassword || process.env.SIP_AUTH_PASSWORD,
          ...options.twilioCallOptions
        };

        // Create the call via Twilio
        // Twilio will route this through the Elastic SIP Trunk
        // The trunk configuration (in Twilio console) routes to OpenAI SIP endpoint
        // OpenAI will then send call.accept webhook to /api/sip/call-accept
        const call = await twilioClient.calls.create(callOptions);
        
        console.log(`✅ [SIP] Call created via SIP: ${call.sid}`);
        console.log(`📞 [SIP] Call status: ${call.status}`);
        
        // Track SIP call
        sipService.trackStatus(call.sid, 'initiated', { from, to, method: 'SIP' });
        
        return call;

      } catch (error) {
        lastError = error;
        const failureReason = this.getFailureReason(error);
        console.error(`❌ [SIP] Attempt ${attempt + 1} failed:`, error.message);
        console.log(`📊 [SIP] Fallback reason: ${failureReason}`);

        // Don't retry on last attempt
        if (attempt < maxRetries - 1) {
          const delay = sipService.getRetryDelay(attempt);
          console.log(`⏳ [SIP] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    const finalFailureReason = this.getFailureReason(lastError);
    console.error(`❌ [SIP] All ${maxRetries} attempts failed. Last error:`, lastError?.message);
    console.log(`📊 [SIP] Final fallback reason: ${finalFailureReason}`);
    
    // Track fallback metrics (async, don't wait)
    this.trackFallbackMetrics(finalFailureReason).catch(err => {
      console.warn(`⚠️ [SIP] Failed to track fallback metrics:`, err.message);
    });
    
    return null;
  }

  /**
   * Get failure reason from error
   * @private
   * @param {Error} error - Error object
   * @returns {string} Failure reason
   */
  getFailureReason(error) {
    if (!error) return 'unknown_error';
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || error.status;
    
    // Check for specific error patterns
    if (errorCode === 404 || errorMessage.includes('not found')) {
      return 'endpoint_not_found';
    }
    if (errorCode === 401 || errorCode === 403 || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return 'authentication_failed';
    }
    if (errorCode === 408 || errorMessage.includes('timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'network_error';
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 'validation_failed';
    }
    if (errorMessage.includes('trunk') || errorMessage.includes('sip trunk')) {
      return 'sip_trunk_error';
    }
    
    return 'unknown_error';
  }

  /**
   * Track fallback metrics
   * @private
   * @param {string} reason - Fallback reason
   * @returns {Promise<void>}
   */
  async trackFallbackMetrics(reason) {
    try {
      // Track in health monitor
      sipHealthMonitor.trackCall('fallback', 'SIP', false, reason);
      
      // Log fallback event (could be stored in database for analytics)
      console.log(`📊 [SIP] Fallback to Media Streams - Reason: ${reason}`);
    } catch (error) {
      // Don't throw - metrics tracking shouldn't block fallback
      console.warn(`⚠️ [SIP] Failed to track fallback metrics:`, error.message);
    }
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
    // PRIORITY 1: SIP_ENABLED env var (for testing/override)
    // If explicitly set in .env, it takes full control
    if (process.env.SIP_ENABLED !== undefined) {
      const envValue = process.env.SIP_ENABLED === 'true';
      console.log(`🔀 [ROUTING] SIP_ENABLED=${process.env.SIP_ENABLED} - Using env var override`);
      
      if (envValue) {
        // SIP_ENABLED=true - check if SIP service is properly configured
        if (!sipService.isSipEnabled()) {
          console.log(`⚠️ [ROUTING] SIP_ENABLED=true but SIP service not configured (missing OPENAI_SIP_ENDPOINT?)`);
          return false;
        }
        return true;
      } else {
        // SIP_ENABLED=false - force Media Streams
        console.log(`📞 [ROUTING] SIP_ENABLED=false - Forcing Media Streams`);
        return false;
      }
    }
    
    // PRIORITY 2: Database config (for production when env var not set)
    const dbPrimaryPath = telephonyConfig?.sipSettings?.primaryPath;
    const dbSipEnabled = dbPrimaryPath === 'sip';
    const sipServiceEnabled = sipService.isSipEnabled();
    
    console.log(`🔀 [ROUTING] SIP_ENABLED not set - Using database config: primaryPath=${dbPrimaryPath}, sipService.enabled=${sipServiceEnabled}`);
    
    // Use SIP if database says 'sip' AND SIP service is configured
    return dbSipEnabled && sipServiceEnabled;
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
    
    // Log which method is being used and why
    const envVarSet = process.env.SIP_ENABLED !== undefined;
    const dbPath = telephonyConfig?.sipSettings?.primaryPath || 'not_set';
    const sipServiceEnabled = sipService.isSipEnabled();
    
    console.log(`🔀 [ROUTING] Decision: SIP_ENABLED=${process.env.SIP_ENABLED || 'not_set'}, DB primaryPath=${dbPath}, sipService.enabled=${sipServiceEnabled}, willUseSip=${useSip}`);

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
    } else {
      console.log(`📞 [ROUTING] Using Media Streams (SIP not enabled or not configured)`);
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

