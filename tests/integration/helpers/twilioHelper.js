/**
 * Twilio helper for integration tests
 */
import twilio from 'twilio';
import testConfig from './config/testConfig.js';
import UrlBuilder from './urlBuilder.js';

class TwilioHelper {
  constructor() { this.client = null; this.initialize(); }
  initialize() {
    const { accountSid, authToken } = testConfig.credentials.twilio;
    if (accountSid && authToken) this.client = twilio(accountSid, authToken);
    else console.warn('[TwilioHelper] Twilio credentials not configured');
  }
  ensureInitialized() {
    if (!this.client) {
      const { accountSid, authToken } = testConfig.credentials.twilio;
      if (accountSid && authToken) {
        this.client = twilio(accountSid, authToken);
      } else throw new Error('Twilio client not initialized - credentials not available');
    }
  }
  async initiateCall(from, to, options = {}) {
    this.ensureInitialized();
    const { usingTestCredentials, magicTestNumber, phoneNumber, verifiedCallerId } = testConfig.credentials.twilio;
    let defaultFrom = from || (usingTestCredentials ? magicTestNumber : (verifiedCallerId || phoneNumber));
    const callParams = {
      from: defaultFrom,
      to: to || phoneNumber,
      method: 'POST',
      statusCallback: options.statusCallback,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      record: options.record !== false,
      ...options
    };
    if (!options.webhookUrl) callParams.url = UrlBuilder.buildWebhookUrl('/api/inbound/incoming-call');
    else callParams.url = options.webhookUrl;
    const call = await this.client.calls.create(callParams);
    return { callSid: call.sid, status: call.status, call };
  }
  async sendDTMF(callSid, digits) {
    this.ensureInitialized();
    const safe = String(digits).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const twiml = `<Response><Play digits="${safe}"></Play></Response>`;
    return await this.client.calls(callSid).update({ twiml });
  }
  async getCall(callSid) {
    this.ensureInitialized();
    return await this.client.calls(callSid).fetch();
  }
  async getRecordings(callSid) {
    this.ensureInitialized();
    return await this.client.recordings.list({ callSid, limit: 10 });
  }
  async updateCall(callSid, updates) {
    this.ensureInitialized();
    return await this.client.calls(callSid).update(updates);
  }
  async hangupCall(callSid) {
    this.ensureInitialized();
    return await this.client.calls(callSid).update({ status: 'completed' });
  }
  getMediaStreamsUrl(callSid, options = {}) { return UrlBuilder.buildMediaStreamsUrl(callSid, options); }
}
export const twilioHelper = new TwilioHelper();
export default twilioHelper;
