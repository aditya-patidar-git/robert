/**
 * Media Streams WebSocket Client
 * Single responsibility: Manage WebSocket connection to Twilio Media Streams
 * Reusable across all tests that need to send audio input
 * 
 * OPTION 1 IMPLEMENTATION: Connects immediately after call initiation to maximize
 * chance of receiving start event before Twilio connects to agent service.
 */

import { WebSocket } from 'ws';
import UrlBuilder from './urlBuilder.js';
import testConfig from './config/testConfig.js';

class MediaStreamsClient {
  constructor(callSid, wsUrl, options = {}) {
    this.callSid = callSid;
    this.wsUrl = wsUrl;
    this.useTestEndpoint = options.useTestEndpoint || false;
    this.ws = null;
    this.streamSid = null;
    this.connected = false;
    this.connectPromise = null;
    this.connectResolve = null;
    this.connectReject = null;
    this.mediaCallbacks = [];
    this._startFallbackTimer = null;
    this._connectTimeout = null;
    /** Set true during disconnect() to avoid logging in event handlers after tests are done */
    this._teardown = false;
  }

  /**
   * Connect to Media Streams WebSocket
   * OPTION 1: Connects immediately and waits for start event OR uses callSid as fallback
   * @returns {Promise<void>} Resolves when connected (with or without streamSid)
   */
  async connect() {
    if (this.connected && this.streamSid) {
      return; // Already connected
    }

    if (this.connectPromise) {
      return this.connectPromise; // Connection in progress
    }

    if (this.useTestEndpoint) {
      this.wsUrl = UrlBuilder.buildTestMediaStreamsUrl(this.callSid);
      if (!this._teardown) console.log(`[MediaStreamsClient] Using test endpoint: ${this.wsUrl}`);
    }

    this.connectPromise = new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      try {
        if (!this._teardown) console.log(`[MediaStreamsClient] Connecting to ${this.wsUrl} for call ${this.callSid}`);
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          if (!this._teardown) console.log(`[MediaStreamsClient] WebSocket opened for call ${this.callSid}`);
          this._startFallbackTimer = setTimeout(() => {
            this._startFallbackTimer = null;
            if (!this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
              if (!this._teardown) {
                console.log(`[MediaStreamsClient] ⚠️  WebSocket open but no start event after 2s, using callSid as streamSid: ${this.callSid}`);
              }
              this.streamSid = this.callSid; // Fallback: use callSid as streamSid
              this.connected = true;
              if (this.connectResolve) {
                this.connectResolve();
                this.connectResolve = null;
                this.connectReject = null;
              }
            }
          }, 2000);
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
            if (!this._teardown) console.error(`[MediaStreamsClient] Error parsing message:`, error);
          }
        });

        this.ws.on('error', (error) => {
          if (!this._teardown) {
            console.error(`[MediaStreamsClient] WebSocket error for call ${this.callSid}:`, error);
          }
          if (this.connectReject) {
            this.connectReject(error);
            this.connectReject = null;
          }
        });

        this.ws.on('close', () => {
          // Do not log here: close can fire after Jest has finished, causing "Cannot log after tests are done"
          this.connected = false;
          this.streamSid = null;
        });

        // Timeout after 15 seconds (increased for Option 1: connecting before call initiation)
        this._connectTimeout = setTimeout(() => {
          this._connectTimeout = null;
          if (!this.connected) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              if (!this._teardown) console.log(`[MediaStreamsClient] Timeout reached but WebSocket open - using callSid as streamSid`);
              this.streamSid = this.callSid;
              this.connected = true;
              if (this.connectResolve) {
                this.connectResolve();
                this.connectResolve = null;
                this.connectReject = null;
              }
            } else {
              const error = new Error(`Connection timeout for call ${this.callSid}`);
              if (this.connectReject) {
                this.connectReject(error);
                this.connectReject = null;
              }
            }
          }
        }, 15000);

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
   * OPTION 1: Handles start event, connected event, and fallback logic
   * @private
   */
  handleMessage(message) {
    if (message.event === 'start') {
      this.streamSid = message.start?.streamSid;
      if (!this._teardown) console.log(`[MediaStreamsClient] Received streamSid: ${this.streamSid} for call ${this.callSid}`);
      
      if (this.streamSid) {
        this.connected = true;
        if (this.connectResolve) {
          this.connectResolve();
          this.connectResolve = null;
          this.connectReject = null;
        }
      }
    } else if (message.event === 'connected') {
      if (!this._teardown) console.log(`[MediaStreamsClient] Received connected event for call ${this.callSid}`);
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
            if (!this._teardown) console.error(`[MediaStreamsClient] Error in media callback:`, error);
          }
        });
      }
    } else if (message.event === 'stop') {
      if (!this._teardown) console.log(`[MediaStreamsClient] Stream stopped for call ${this.callSid}`);
      this.connected = false;
    } else if (!this._teardown) {
      console.log(`[MediaStreamsClient] Received event: ${message.event} for call ${this.callSid}`);
    }
  }

  /**
   * Send audio chunk via WebSocket
   * Reusable method for any audio chunk
   * OPTION 1: Uses streamSid if available, otherwise uses callSid as fallback
   * @param {string} audioBase64 - Base64-encoded μ-law audio chunk
   * @returns {boolean} True if sent successfully
   */
  sendAudioChunk(audioBase64) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (!this._teardown) console.warn(`[MediaStreamsClient] Cannot send audio - not connected`);
      return false;
    }
    const streamSidToUse = this.streamSid || this.callSid;
    if (!streamSidToUse) {
      if (!this._teardown) console.warn(`[MediaStreamsClient] Cannot send audio - no streamSid or callSid`);
      return false;
    }

    try {
      const mediaMessage = {
        event: 'media',
        streamSid: streamSidToUse,
        media: {
          payload: audioBase64
        }
      };

      this.ws.send(JSON.stringify(mediaMessage));
      return true;
    } catch (error) {
      if (!this._teardown) console.error(`[MediaStreamsClient] Error sending audio chunk:`, error);
      return false;
    }
  }

  /**
   * Disconnect WebSocket (waits for close event or timeout)
   */
  async disconnect() {
    this._teardown = true;
    if (this._startFallbackTimer) {
      clearTimeout(this._startFallbackTimer);
      this._startFallbackTimer = null;
    }
    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    this.connectResolve = null;
    this.connectReject = null;

    if (!this.ws) {
      this.connected = false;
      this.streamSid = null;
      this.connectPromise = null;
      return Promise.resolve();
    }

    const ws = this.ws;
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      this.ws = null;
      this.connected = false;
      this.streamSid = null;
      this.connectPromise = null;
      this.connectResolve = null;
      this.connectReject = null;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws = null;
        this.connected = false;
        this.streamSid = null;
        this.connectPromise = null;
        this.connectResolve = null;
        this.connectReject = null;
        resolve();
      }, 5000);

      ws.once('close', () => {
        clearTimeout(timeout);
        this.ws = null;
        this.connected = false;
        this.streamSid = null;
        this.connectPromise = null;
        this.connectResolve = null;
        this.connectReject = null;
        resolve();
      });

      ws.close();
    });
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
   * OPTION 1: Returns true if WebSocket is open, even without streamSid (uses callSid fallback)
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN && (this.streamSid !== null || this.callSid !== null);
  }
}

export default MediaStreamsClient;
