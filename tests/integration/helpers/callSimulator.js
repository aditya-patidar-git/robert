/**
 * Call simulator for integration tests
 */
import twilioHelper from './twilioHelper.js';
import testConfig from './config/testConfig.js';
import { stateManager } from './stateManager.js';
import MediaStreamsClient from './mediaStreamsClient.js';
import AudioEncoder from './audioEncoder.js';

class CallSimulator {
  constructor() {
    this.activeCalls = new Map();
    this.mediaStreamsClients = new Map();
  }
  async initiateCall(testName, options = {}) {
    const { usingTestCredentials, magicTestNumber, phoneNumber, verifiedCallerId } = testConfig.credentials.twilio;
    let defaultFrom = usingTestCredentials ? magicTestNumber : (verifiedCallerId || phoneNumber);
    const { from = defaultFrom, to = phoneNumber, webhookUrl = null, record = true } = options;
    const callResult = await twilioHelper.initiateCall(from, to, { webhookUrl, record, statusCallback: options.statusCallback });
    const callSid = callResult.callSid;
    const wsUrl = twilioHelper.getMediaStreamsUrl(callSid);
    const client = new MediaStreamsClient(callSid, wsUrl, { useTestEndpoint: true });
    this.mediaStreamsClients.set(callSid, client);
    client.connect().catch(() => {});
    this.activeCalls.set(callSid, { testName, callSid, startTime: Date.now(), status: callResult.status, from, to });
    stateManager.addCallSid(testName, callSid);
    return { callSid, status: callResult.status, call: callResult.call };
  }
  async waitForAnswer(callSid, timeout = testConfig.timeouts.callPickup) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const call = await twilioHelper.getCall(callSid);
      if (call.status === 'in-progress' || call.status === 'completed') return call;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`Call ${callSid} was not answered within ${timeout}ms`);
  }
  async getMediaStreamsClient(callSid) {
    if (this.mediaStreamsClients.has(callSid)) {
      const client = this.mediaStreamsClients.get(callSid);
      if (client.isConnected()) return client;
      try { await client.connect(); return client; } catch (e) { await client.disconnect(); }
    }
    const wsUrl = twilioHelper.getMediaStreamsUrl(callSid);
    const client = new MediaStreamsClient(callSid, wsUrl, { useTestEndpoint: true });
    await client.connect();
    this.mediaStreamsClients.set(callSid, client);
    return client;
  }
  async sendAudioInput(callSid, text, options = {}) {
    const client = await this.getMediaStreamsClient(callSid);
    const language = options.language || 'en';
    let audioBase64 = await AudioEncoder.textToAudio(text, language);
    if (!audioBase64) audioBase64 = AudioEncoder.generateFrenchAudioPlaceholder(text);
    if (!audioBase64) audioBase64 = Buffer.alloc(8000, 0x7F).toString('base64');
    return client.sendAudioChunk(audioBase64);
  }
  async sendDTMF(callSid, digits) { return await twilioHelper.sendDTMF(callSid, digits); }
  async hangup(callSid) {
    if (this.mediaStreamsClients.has(callSid)) {
      await this.mediaStreamsClients.get(callSid).disconnect();
      this.mediaStreamsClients.delete(callSid);
    }
    await twilioHelper.hangupCall(callSid);
    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
      const call = await twilioHelper.getCall(callSid);
      if (call.status === 'completed') break;
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 500));
    this.activeCalls.delete(callSid);
    return true;
  }
  async getCallStatus(callSid) { return (await twilioHelper.getCall(callSid)).status; }
  async getRecordings(callSid) { return await twilioHelper.getRecordings(callSid); }
  getCallDuration(callSid) {
    const info = this.activeCalls.get(callSid);
    return info ? Date.now() - info.startTime : null;
  }
  async cleanup() {
    await Promise.all(Array.from(this.mediaStreamsClients.values()).map(c => c.disconnect().catch(() => {})));
    this.mediaStreamsClients.clear();
    await Promise.all(Array.from(this.activeCalls.keys()).map(sid => this.hangup(sid).catch(() => {})));
    this.activeCalls.clear();
  }
  async monitorAudioOutput(callSid, callback) {
    const client = await this.getMediaStreamsClient(callSid);
    const mediaHandler = (payload, track) => { if (track === 'outbound' && callback) callback(payload); };
    client.onMedia(mediaHandler);
    return { stop: () => client.offMedia(mediaHandler) };
  }
}
export const callSimulator = new CallSimulator();
export default callSimulator;
