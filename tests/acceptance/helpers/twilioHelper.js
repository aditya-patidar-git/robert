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
   */
  async initiateCall(from, to, options = {}) {
    this.ensureInitialized();

    try {
      const call = await this.client.calls.create({
        from: from || testConfig.credentials.twilio.phoneNumber,
        to: to || testConfig.credentials.twilio.testPhoneNumber,
        url: options.webhookUrl || UrlBuilder.buildWebhookUrl('/api/inbound/handle-call'),
        method: 'POST',
        statusCallback: options.statusCallback,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: options.record !== false, // Record by default for tests
        ...options
      });

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

