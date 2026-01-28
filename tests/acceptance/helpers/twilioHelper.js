/**
 * Twilio Helper
 * Reusable Twilio operations for tests
 * Single responsibility: Twilio API operations only
 */

import twilio from 'twilio';
import testConfig from '../config/testConfig.js';
import UrlBuilder from './urlBuilder.js';

class TwilioHelper {
  constructor() {
    this.client = null;
    this.initialize();
  }

  initialize() {
    const { accountSid, authToken } = testConfig.credentials.twilio;
    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    } else {
      console.warn('[TwilioHelper] Twilio credentials not configured');
    }
  }

  /**
   * Ensure client is initialized, try to re-initialize if needed
   */
  ensureInitialized() {
    if (!this.client) {
      const { accountSid, authToken } = testConfig.credentials.twilio;
      if (accountSid && authToken) {
        this.client = twilio(accountSid, authToken);
        console.log('[TwilioHelper] Twilio client initialized');
      } else {
        throw new Error('Twilio client not initialized - credentials not available');
      }
    }
  }

  /**
   * Initiate a test call
   * Note: Twilio API requires a 'url' parameter for ALL programmatic calls,
   * even when calling TO your Twilio number (inbound calls).
   * The console webhook config only applies to external callers, not API-created calls.
   * 
   * IMPORTANT: Test credentials do NOT trigger webhooks - calls are simulated only.
   * Use production credentials to test actual inbound call webhooks.
   */
  async initiateCall(from, to, options = {}) {
    this.ensureInitialized();

    try {
      const { usingTestCredentials, magicTestNumber, phoneNumber, verifiedCallerId } = testConfig.credentials.twilio;
      
      // Determine if this is an inbound call (calling TO Twilio number)
      const twilioNumber = phoneNumber;
      const isInboundCall = to === twilioNumber || 
                          (!to && !from) || // Both default to Twilio number = inbound
                          (to && to === (process.env.TWILIO_NUMBER || '+442045726060'));

      // Determine FROM number:
      // - If explicitly provided, use it
      // - Test credentials: use magic number
      // - Production with verified caller ID: use verified number
      // - Production without verified caller ID: fallback to Twilio number (may fail)
      let defaultFrom;
      if (from) {
        defaultFrom = from; // Use explicitly provided FROM
      } else if (usingTestCredentials) {
        defaultFrom = magicTestNumber;
      } else if (verifiedCallerId) {
        defaultFrom = verifiedCallerId;
      } else {
        console.warn('[TwilioHelper] ⚠️  No VERIFIED_CALLER_ID set - using Twilio number as FROM (may fail)');
        defaultFrom = twilioNumber;
      }

      // Build call parameters
      const callParams = {
        from: defaultFrom,
        to: to || twilioNumber, // Default to Twilio number
        method: 'POST',
        statusCallback: options.statusCallback,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: options.record !== false, // Record by default for tests
        ...options
      };
      
      // Log which credentials and FROM number are being used
      if (usingTestCredentials) {
        console.log('[TwilioHelper] Using TEST credentials - webhooks will NOT be triggered');
        console.log(`[TwilioHelper] Call: FROM ${defaultFrom} TO ${to || twilioNumber}`);
      } else {
        console.log('[TwilioHelper] Using PRODUCTION credentials - webhooks will be triggered');
        console.log(`[TwilioHelper] Call: FROM ${defaultFrom} (verified caller ID) TO ${to || twilioNumber}`);
      }

      // Twilio API requires 'url' parameter for ALL programmatic calls
      // Use provided webhookUrl, or default to inbound webhook for inbound calls
      if (options.webhookUrl) {
        callParams.url = options.webhookUrl;
      } else {
        // Default to inbound webhook URL (works for both inbound and outbound test calls)
        callParams.url = UrlBuilder.buildWebhookUrl('/api/inbound/handle-call');
      }

      const call = await this.client.calls.create(callParams);

      return {
        callSid: call.sid,
        status: call.status,
        call: call
      };
    } catch (error) {
      console.error('[TwilioHelper] Error initiating call:', error.message);
      throw error;
    }
  }

  /**
   * Send DTMF tones
   */
  async sendDTMF(callSid, digits) {
    this.ensureInitialized();

    try {
      const dtmf = await this.client.calls(callSid)
        .dtmf
        .create({ digits });

      return dtmf;
    } catch (error) {
      console.error('[TwilioHelper] Error sending DTMF:', error.message);
      throw error;
    }
  }

  /**
   * Get call details
   */
  async getCall(callSid) {
    this.ensureInitialized();

    try {
      const call = await this.client.calls(callSid).fetch();
      return call;
    } catch (error) {
      console.error('[TwilioHelper] Error fetching call:', error.message);
      throw error;
    }
  }

  /**
   * Get call recordings
   */
  async getRecordings(callSid) {
    this.ensureInitialized();

    try {
      const recordings = await this.client.recordings.list({
        callSid: callSid,
        limit: 10
      });
      return recordings;
    } catch (error) {
      console.error('[TwilioHelper] Error fetching recordings:', error.message);
      throw error;
    }
  }

  /**
   * Update call (for transfer, etc.)
   */
  async updateCall(callSid, updates) {
    this.ensureInitialized();

    try {
      const call = await this.client.calls(callSid).update(updates);
      return call;
    } catch (error) {
      console.error('[TwilioHelper] Error updating call:', error.message);
      throw error;
    }
  }

  /**
   * Hang up call
   */
  async hangupCall(callSid) {
    this.ensureInitialized();

    try {
      const call = await this.client.calls(callSid).update({ status: 'completed' });
      return call;
    } catch (error) {
      console.error('[TwilioHelper] Error hanging up call:', error.message);
      throw error;
    }
  }

  /**
   * Fetch Voice Insights metrics
   */
  async getVoiceInsights(callSid) {
    this.ensureInitialized();

    try {
      // Voice Insights API endpoint
      const insights = await this.client.insights.v1.calls(callSid).fetch();
      return insights;
    } catch (error) {
      console.error('[TwilioHelper] Error fetching Voice Insights:', error.message);
      // Voice Insights may not be available immediately
      return null;
    }
  }

  /**
   * Wait for call status
   */
  async waitForCallStatus(callSid, targetStatus, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const call = await this.getCall(callSid);
      if (call.status === targetStatus) {
        return call;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Call ${callSid} did not reach status ${targetStatus} within ${timeout}ms`);
  }

  /**
   * Get Media Streams WebSocket URL for a call
   * Reusable method for connecting to Media Streams WebSocket
   * Uses UrlBuilder for consistent URL construction
   * @param {string} callSid - Call SID
   * @param {Object} options - Options (passed to UrlBuilder)
   * @returns {string} - WebSocket URL
   */
  getMediaStreamsUrl(callSid, options = {}) {
    return UrlBuilder.buildMediaStreamsUrl(callSid, options);
  }
}

export const twilioHelper = new TwilioHelper();
export default twilioHelper;

