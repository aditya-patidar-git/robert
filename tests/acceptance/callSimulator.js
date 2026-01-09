/**
 * Call Simulator
 * Synthetic call simulator using Twilio SDK
 * Single responsibility: call simulation only
 */

import twilioHelper from './helpers/twilioHelper.js';
import testConfig from './config/testConfig.js';
import { stateManager } from './helpers/stateManager.js';

class CallSimulator {
  constructor() {
    this.activeCalls = new Map();
  }

  /**
   * Initiate a test call
   */
  async initiateCall(testName, options = {}) {
    const {
      from = testConfig.credentials.twilio.phoneNumber,
      to = testConfig.credentials.twilio.testPhoneNumber,
      webhookUrl = options.webhookUrl,
      record = true
    } = options;

    try {
      const callResult = await twilioHelper.initiateCall(from, to, {
        webhookUrl,
        record,
        statusCallback: options.statusCallback
      });

      const callSid = callResult.callSid;
      this.activeCalls.set(callSid, {
        testName,
        callSid,
        startTime: Date.now(),
        status: callResult.status,
        from,
        to
      });

      // Track in state manager
      stateManager.addCallSid(testName, callSid);

      return {
        callSid,
        status: callResult.status,
        call: callResult.call
      };
    } catch (error) {
      console.error(`[CallSimulator] Error initiating call: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for call to be answered
   */
  async waitForAnswer(callSid, timeout = testConfig.timeouts.callPickup) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const call = await twilioHelper.getCall(callSid);
      
      if (call.status === 'in-progress' || call.status === 'completed') {
        return call;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Call ${callSid} was not answered within ${timeout}ms`);
  }

  /**
   * Send audio input (simulate user speech)
   */
  async sendAudioInput(callSid, audioData) {
    // Note: Real implementation would send audio via Media Streams WebSocket
    // This is a placeholder for the test framework
    // In real tests, we'd need to connect to Media Streams and send audio chunks
    
    console.log(`[CallSimulator] Sending audio input for call ${callSid}`);
    // Implementation would send audio via WebSocket to Media Streams endpoint
    return true;
  }

  /**
   * Send DTMF tones
   */
  async sendDTMF(callSid, digits) {
    return await twilioHelper.sendDTMF(callSid, digits);
  }

  /**
   * Hang up call
   */
  async hangup(callSid) {
    try {
      await twilioHelper.hangupCall(callSid);
      this.activeCalls.delete(callSid);
      return true;
    } catch (error) {
      console.error(`[CallSimulator] Error hanging up call: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get call status
   */
  async getCallStatus(callSid) {
    const call = await twilioHelper.getCall(callSid);
    return call.status;
  }

  /**
   * Get call recordings
   */
  async getRecordings(callSid) {
    return await twilioHelper.getRecordings(callSid);
  }

  /**
   * Get call duration
   */
  getCallDuration(callSid) {
    const callInfo = this.activeCalls.get(callSid);
    if (!callInfo) {
      return null;
    }
    return Date.now() - callInfo.startTime;
  }

  /**
   * Cleanup all active calls
   */
  async cleanup() {
    const hangupPromises = Array.from(this.activeCalls.keys()).map(callSid =>
      this.hangup(callSid).catch(err => 
        console.error(`[CallSimulator] Error cleaning up call ${callSid}:`, err.message)
      )
    );
    
    await Promise.all(hangupPromises);
    this.activeCalls.clear();
  }

  /**
   * Monitor Media Streams for audio output
   * Note: This would require WebSocket connection to Media Streams endpoint
   */
  async monitorAudioOutput(callSid, callback) {
    // Placeholder: Real implementation would:
    // 1. Connect to Media Streams WebSocket
    // 2. Listen for audio chunks
    // 3. Call callback with audio data
    
    console.log(`[CallSimulator] Monitoring audio output for call ${callSid}`);
    // Implementation would establish WebSocket connection
    return {
      stop: () => {
        console.log(`[CallSimulator] Stopped monitoring audio for call ${callSid}`);
      }
    };
  }
}

export const callSimulator = new CallSimulator();
export default callSimulator;

