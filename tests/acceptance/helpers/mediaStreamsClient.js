/**
 * Media Streams WebSocket Client
 * Single responsibility: Manage WebSocket connection to Twilio Media Streams
 * Reusable across all tests that need to send audio input
 */

import { WebSocket } from 'ws';
import testConfig from '../config/testConfig.js';

class MediaStreamsClient {
  constructor(callSid, wsUrl) {
    this.callSid = callSid;
    this.wsUrl = wsUrl;
    this.ws = null;
    this.streamSid = null;
    this.connected = false;
    this.connectPromise = null;
    this.connectResolve = null;
    this.connectReject = null;
    this.mediaCallbacks = []; // Store callbacks for media events
  }

  /**
   * Connect to Media Streams WebSocket
   * @returns {Promise<void>} Resolves when connected and streamSid received
   */
  async connect() {
    if (this.connected && this.streamSid) {
      return; // Already connected
    }

    if (this.connectPromise) {
      return this.connectPromise; // Connection in progress
    }

    this.connectPromise = new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      try {
        console.log(`[MediaStreamsClient] Connecting to ${this.wsUrl} for call ${this.callSid}`);
        
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          console.log(`[MediaStreamsClient] WebSocket opened for call ${this.callSid}`);
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
            
            // Also emit custom event for media messages
            if (message.event === 'media') {
              this.ws.emit('mediaMessage', message);
            }
          } catch (error) {
            console.error(`[MediaStreamsClient] Error parsing message:`, error);
          }
        });

        this.ws.on('error', (error) => {
          console.error(`[MediaStreamsClient] WebSocket error for call ${this.callSid}:`, error);
          if (this.connectReject) {
            this.connectReject(error);
            this.connectReject = null;
          }
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[MediaStreamsClient] WebSocket closed for call ${this.callSid}: ${code} ${reason}`);
          this.connected = false;
          this.streamSid = null;
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.connected) {
            const error = new Error(`Connection timeout for call ${this.callSid}`);
            if (this.connectReject) {
              this.connectReject(error);
              this.connectReject = null;
            }
          }
        }, 10000);

      } catch (error) {
        if (this.connectReject) {
          this.connectReject(error);
          this.connectReject = null;
        }
      }
    });

    return this.connectPromise;
  }

  /**
   * Handle incoming WebSocket messages
   * @private
   */
  handleMessage(message) {
    if (message.event === 'start') {
      this.streamSid = message.start?.streamSid;
      console.log(`[MediaStreamsClient] Received streamSid: ${this.streamSid} for call ${this.callSid}`);
      
      if (this.streamSid) {
        this.connected = true;
        if (this.connectResolve) {
          this.connectResolve();
          this.connectResolve = null;
          this.connectReject = null;
        }
      }
    } else if (message.event === 'media') {
      // Handle incoming audio - call registered callbacks
      const track = message.media?.track;
      const payload = message.media?.payload;
      
      if (payload) {
        // Call all registered media callbacks
        this.mediaCallbacks.forEach(callback => {
          try {
            callback(payload, track);
          } catch (error) {
            console.error(`[MediaStreamsClient] Error in media callback:`, error);
          }
        });
      }
    } else if (message.event === 'stop') {
      console.log(`[MediaStreamsClient] Stream stopped for call ${this.callSid}`);
      this.connected = false;
    }
  }

  /**
   * Send audio chunk via WebSocket
   * Reusable method for any audio chunk
   * @param {string} audioBase64 - Base64-encoded μ-law audio chunk
   * @returns {boolean} True if sent successfully
   */
  sendAudioChunk(audioBase64) {
    if (!this.connected || !this.streamSid || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[MediaStreamsClient] Cannot send audio - not connected (connected: ${this.connected}, streamSid: ${this.streamSid})`);
      return false;
    }

    try {
      const mediaMessage = {
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload: audioBase64
        }
      };

      this.ws.send(JSON.stringify(mediaMessage));
      return true;
    } catch (error) {
      console.error(`[MediaStreamsClient] Error sending audio chunk:`, error);
      return false;
    }
  }

  /**
   * Disconnect WebSocket
   */
  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.streamSid = null;
    this.connectPromise = null;
    this.connectResolve = null;
    this.connectReject = null;
  }

  /**
   * Register callback for media events
   * @param {Function} callback - Callback function (payload, track) => void
   */
  onMedia(callback) {
    if (typeof callback === 'function') {
      this.mediaCallbacks.push(callback);
    }
  }

  /**
   * Remove media callback
   * @param {Function} callback - Callback to remove
   */
  offMedia(callback) {
    const index = this.mediaCallbacks.indexOf(callback);
    if (index > -1) {
      this.mediaCallbacks.splice(index, 1);
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.streamSid !== null && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default MediaStreamsClient;
