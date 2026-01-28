/**
 * Call Simulator
 * Synthetic call simulator using Twilio SDK
 * Single responsibility: call simulation only
 */

import twilioHelper from './helpers/twilioHelper.js';
import testConfig from './config/testConfig.js';
import { stateManager } from './helpers/stateManager.js';
import MediaStreamsClient from './helpers/mediaStreamsClient.js';
import AudioEncoder from './helpers/audioEncoder.js';

class CallSimulator {
  constructor() {
    this.activeCalls = new Map();
    this.mediaStreamsClients = new Map(); // Store Media Streams clients per call
  }

  /**
   * Initiate a test call
   * With test credentials: FROM magic number (+15005550006) TO Twilio number
   * With production credentials: FROM verified caller ID (personal mobile) TO Twilio number
   * The webhook URL will be set automatically by twilioHelper (required by Twilio API)
   * 
   * NOTE: Test credentials do NOT trigger webhooks - calls are simulated only
   * NOTE: For production credentials, use VERIFIED_CALLER_ID env var (your verified personal mobile)
   * 
   * OPTION 1 IMPLEMENTATION: Connects Media Streams client BEFORE initiating call
   * so test client receives start event when Twilio connects.
   */
  async initiateCall(testName, options = {}) {
    const { usingTestCredentials, magicTestNumber, phoneNumber, verifiedCallerId } = testConfig.credentials.twilio;
    
    // Determine FROM number:
    // - Test credentials: use magic number
    // - Production with verified caller ID: use verified number
    // - Production without verified caller ID: fallback to Twilio number (may fail if not allowed)
    let defaultFrom;
    if (usingTestCredentials) {
      defaultFrom = magicTestNumber;
    } else if (verifiedCallerId) {
      defaultFrom = verifiedCallerId;
    } else {
      console.warn('[CallSimulator] ⚠️  No VERIFIED_CALLER_ID set - using Twilio number as FROM (may fail)');
      defaultFrom = phoneNumber;
    }
    
    const {
      from = defaultFrom,
      to = phoneNumber, // Always use Twilio number as TO
      webhookUrl = null, // Optional: if not provided, defaults to inbound webhook
      record = true
    } = options;

    try {
      // OPTION 1: Initiate call first to get callSid, then IMMEDIATELY connect Media Streams client
      // This ensures test client connects as early as possible to receive start event
      const callResult = await twilioHelper.initiateCall(from, to, {
        webhookUrl,
        record,
        statusCallback: options.statusCallback
      });

      const callSid = callResult.callSid;
      
      // IMMEDIATELY connect Media Streams client with real callSid
      // Connect synchronously to ensure connection starts before Twilio connects
      // This maximizes chance of receiving start event (though there's still a race condition)
      console.log(`[CallSimulator] Immediately connecting Media Streams client for call ${callSid}...`);
      const wsUrl = twilioHelper.getMediaStreamsUrl(callSid);
      const client = new MediaStreamsClient(callSid, wsUrl, { useTestEndpoint: true });
      
      // Store client immediately
      this.mediaStreamsClients.set(callSid, client);
      
      // Start connecting immediately (don't await - let it connect in background)
      // The connection will wait for start event with increased timeout
      client.connect().catch(err => {
        console.warn(`[CallSimulator] Media Streams initial connection attempt failed: ${err.message}`);
        console.warn(`[CallSimulator] Will retry when getMediaStreamsClient is called`);
      });
      
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
   * Get or create Media Streams client for a call
   * @private
   * OPTION 1: Reuses connection created during initiateCall() if available
   */
  async getMediaStreamsClient(callSid) {
    if (this.mediaStreamsClients.has(callSid)) {
      const client = this.mediaStreamsClients.get(callSid);
      if (client.isConnected()) {
        return client;
      }
      // If not connected yet, wait for connection to complete
      // This handles the case where connection was started in initiateCall() but start event hasn't arrived yet
      try {
        await client.connect();
        return client;
      } catch (error) {
        // If connection failed, try reconnecting
        console.warn(`[CallSimulator] Existing Media Streams client connection failed, reconnecting...`);
        await client.disconnect();
      }
    }

    // Fallback: Create new connection if not already created during initiateCall()
    // This should rarely happen with Option 1 implementation
    console.log(`[CallSimulator] Creating new Media Streams client for call ${callSid} (fallback)`);
    const wsUrl = twilioHelper.getMediaStreamsUrl(callSid);
    const client = new MediaStreamsClient(callSid, wsUrl, { useTestEndpoint: true });
    
    // Connect to Media Streams
    await client.connect();
    
    this.mediaStreamsClients.set(callSid, client);
    return client;
  }

  /**
   * Send audio input (simulate user speech)
   * @param {string} callSid - Call SID
   * @param {string} text - Text to send as audio (will be converted to audio)
   * @param {Object} options - Options
   * @param {string} options.language - Language code (default: 'en')
   * @returns {Promise<boolean>} True if sent successfully
   */
  async sendAudioInput(callSid, text, options = {}) {
    try {
      console.log(`[CallSimulator] Sending audio input for call ${callSid}: "${text}"`);
      
      // Get or create Media Streams client
      const client = await this.getMediaStreamsClient(callSid);
      
      // Convert text to audio
      // For now, use placeholder audio generation
      // In production, this would use TTS service
      const language = options.language || 'en';
      let audioBase64 = await AudioEncoder.textToAudio(text, language);
      
      // If textToAudio returns empty, generate placeholder
      if (!audioBase64) {
        if (language === 'fr') {
          // Use French audio placeholder for Test 1
          audioBase64 = AudioEncoder.generateFrenchAudioPlaceholder(text);
        } else {
          // Generate placeholder audio for other languages
          audioBase64 = AudioEncoder.generateFrenchAudioPlaceholder(text); // Reuse for now
        }
      }
      
      // Fallback: create minimal audio chunk (silence) if still empty
      if (!audioBase64) {
        console.warn(`[CallSimulator] Could not generate audio for "${text}", using silence chunk`);
        // Create minimal audio chunk (silence)
        const samples = 8000; // 1 second at 8kHz
        const audioData = Buffer.alloc(samples, 0x7F); // μ-law silence
        audioBase64 = audioData.toString('base64');
      }
      
      // Send audio chunk via WebSocket
      const sent = client.sendAudioChunk(audioBase64);
      
      if (!sent) {
        console.warn(`[CallSimulator] Failed to send audio chunk for call ${callSid}`);
        return false;
      }
      
      console.log(`[CallSimulator] ✓ Audio input sent for call ${callSid}`);
      return true;
    } catch (error) {
      console.error(`[CallSimulator] Error sending audio input: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send DTMF tones
   */
  async sendDTMF(callSid, digits) {
    return await twilioHelper.sendDTMF(callSid, digits);
  }

  /**
   * Hang up call (waits for WebSocket close and Twilio termination)
   */
  async hangup(callSid) {
    try {
      // Disconnect Media Streams client first (waits for close)
      if (this.mediaStreamsClients.has(callSid)) {
        const client = this.mediaStreamsClients.get(callSid);
        await client.disconnect();
        this.mediaStreamsClients.delete(callSid);
      }

      // Hang up via Twilio API
      await twilioHelper.hangupCall(callSid);

      // Wait for call to actually terminate (status = 'completed')
      const startTime = Date.now();
      const maxWait = 10000; // 10 seconds max
      while (Date.now() - startTime < maxWait) {
        const call = await twilioHelper.getCall(callSid);
        if (call.status === 'completed') {
          console.log(`[CallSimulator] Call ${callSid} terminated (status: completed)`);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Poll every 500ms
      }

      // Allow test client registry cleanup on agent side
      console.log(`[CallSimulator] Waiting for test client registry cleanup for call ${callSid}...`);
      await new Promise(resolve => setTimeout(resolve, 500));

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
    // Disconnect all Media Streams clients
    const disconnectPromises = Array.from(this.mediaStreamsClients.values()).map(client =>
      client.disconnect().catch(err =>
        console.error(`[CallSimulator] Error disconnecting Media Streams client:`, err.message)
      )
    );
    await Promise.all(disconnectPromises);
    this.mediaStreamsClients.clear();
    
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
   * @param {string} callSid - Call SID
   * @param {Function} callback - Callback function called with audio chunks
   * @returns {Promise<Object>} Monitor object with stop() method
   */
  async monitorAudioOutput(callSid, callback) {
    try {
      console.log(`[CallSimulator] Monitoring audio output for call ${callSid}`);
      
      // Get or create Media Streams client
      const client = await this.getMediaStreamsClient(callSid);
      
      // Set up callback for outbound audio (agent speaking)
      const mediaHandler = (payload, track) => {
        // Only process outbound audio (agent speaking)
        if (track === 'outbound' && callback) {
          callback(payload);
        }
      };
      
      // Register callback with MediaStreamsClient
      client.onMedia(mediaHandler);
      
      return {
        stop: () => {
          console.log(`[CallSimulator] Stopped monitoring audio for call ${callSid}`);
          client.offMedia(mediaHandler);
        }
      };
    } catch (error) {
      console.error(`[CallSimulator] Error setting up audio monitoring: ${error.message}`);
      // Return a no-op monitor if setup fails
      return {
        stop: () => {
          console.log(`[CallSimulator] Stopped monitoring (was not active)`);
        }
      };
    }
  }
}

export const callSimulator = new CallSimulator();
export default callSimulator;

