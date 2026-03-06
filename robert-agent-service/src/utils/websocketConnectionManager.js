import { WebSocket } from 'ws';

/**
 * WebSocket Connection Manager
 * Provides robust WebSocket connection management with:
 * - Keep-alive/ping mechanism
 * - Connection quality monitoring
 * - Transient error detection
 */

let isProcessShuttingDown = false;
if (typeof process !== 'undefined') {
  const onShutdown = () => { isProcessShuttingDown = true; };
  process.once('SIGINT', onShutdown);
  process.once('SIGTERM', onShutdown);
}

export class WebSocketConnectionManager {
  constructor(ws, callSid, options = {}) {
    this.ws = ws;
    this.callSid = callSid;
    this.pingInterval = null;
    this.pongTimeout = null;
    this.isPermanentlyClosed = false;
    this.warningLogged = false;
    this.messageQueue = [];
    this.connectionQuality = {
      latency: [],
      packetLoss: 0,
      lastPongTime: null,
      consecutivePongMisses: 0,
      isHealthy: true
    };

    this.config = {
      pingInterval: options.pingInterval || 30000,
      pongTimeout: options.pongTimeout || 10000,
      maxLatencyHistory: options.maxLatencyHistory || 10,
      unhealthyThreshold: options.unhealthyThreshold || 3
    };

    if (this.ws) {
      this.ws.once('open', () => this.flushQueue());
    }
    this.setupKeepAlive();
    this.setupConnectionQualityMonitoring();
  }

  flushQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.isPermanentlyClosed) return;
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      try {
        const messageStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
        this.ws.send(messageStr);
      } catch (error) {
        console.error(`❌ [${this.callSid}] Error flushing queued message:`, error.message);
      }
    }
  }

  /**
   * Setup keep-alive ping mechanism
   */
  setupKeepAlive() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Handle pong responses
    this.ws.on('pong', () => {
      if (isProcessShuttingDown || this.isPermanentlyClosed || this.pingInterval === null) return;
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
      const now = Date.now();
      const latency = now - (this.lastPingTime || now);
      this.connectionQuality.latency.push(latency);
      if (this.connectionQuality.latency.length > this.config.maxLatencyHistory) {
        this.connectionQuality.latency.shift();
      }
      this.connectionQuality.lastPongTime = now;
      this.connectionQuality.consecutivePongMisses = 0;
      this.connectionQuality.isHealthy = true;
      console.log(`💓 [${this.callSid}] Pong received, latency: ${latency}ms`);
    });

    // Start ping interval
    this.pingInterval = setInterval(() => {
      if (isProcessShuttingDown || this.isPermanentlyClosed || this.pingInterval === null) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        try {
          this.ws.ping();
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
          }
          this.pongTimeout = setTimeout(() => {
            if (this.pingInterval === null || this.isPermanentlyClosed) return;
            this.connectionQuality.consecutivePongMisses++;
            console.warn(`⚠️ [${this.callSid}] Pong timeout - missed ${this.connectionQuality.consecutivePongMisses} consecutive pongs`);
            if (this.connectionQuality.consecutivePongMisses >= this.config.unhealthyThreshold) {
              this.connectionQuality.isHealthy = false;
              console.error(`❌ [${this.callSid}] Connection marked as unhealthy (${this.connectionQuality.consecutivePongMisses} missed pongs)`);
            }
          }, this.config.pongTimeout);
        } catch (error) {
          console.error(`❌ [${this.callSid}] Error sending ping:`, error.message);
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * Send message through WebSocket
   * @param {string|Object} message - Message to send (string or object to stringify)
   * @param {Object} options - Send options (ignored, kept for API compatibility)
   * @returns {boolean} True if sent successfully, false otherwise
   */
  send(message, options = {}) {
    if (this.isPermanentlyClosed) {
      if (!this.warningLogged) {
        console.warn(`⚠️ [${this.callSid}] Message not sent - connection permanently closed`);
        this.warningLogged = true;
      }
      return false;
    }

    if (this.ws && this.ws.readyState === WebSocket.CLOSED) {
      this.isPermanentlyClosed = true;
      if (!this.warningLogged) {
        console.warn(`⚠️ [${this.callSid}] WebSocket is CLOSED - cannot send message`);
        this.warningLogged = true;
      }
      return false;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connectionQuality.isHealthy) {
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        this.ws.send(messageStr);
        return true;
      } catch (error) {
        console.error(`❌ [${this.callSid}] Error sending message:`, error.message);
        return false;
      }
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === undefined)) {
      this.messageQueue.push(message);
      return true;
    }

    return false;
  }

  /**
   * Setup connection quality monitoring
   */
  setupConnectionQualityMonitoring() {
    // Monitor connection state changes
    if (this.ws) {
      this.ws.on('close', () => {
        // Mark as permanently closed when close event fires
        this.isPermanentlyClosed = true;
        this.connectionQuality.isHealthy = false;
        this.stopKeepAlive();
        // Reset warning flag so we can log the close event
        this.warningLogged = false;
        console.log(`🔌 [${this.callSid}] WebSocket closed - marked as permanently closed`);
      });

      this.ws.on('error', () => {
        this.connectionQuality.packetLoss++;
      });
    }
  }

  /**
   * Get connection quality metrics
   * @returns {Object} Connection quality metrics
   */
  getConnectionQuality() {
    const avgLatency = this.connectionQuality.latency.length > 0
      ? this.connectionQuality.latency.reduce((a, b) => a + b, 0) / this.connectionQuality.latency.length
      : null;

    return {
      isHealthy: this.connectionQuality.isHealthy,
      avgLatency: avgLatency ? Math.round(avgLatency) : null,
      maxLatency: this.connectionQuality.latency.length > 0 ? Math.max(...this.connectionQuality.latency) : null,
      minLatency: this.connectionQuality.latency.length > 0 ? Math.min(...this.connectionQuality.latency) : null,
      consecutivePongMisses: this.connectionQuality.consecutivePongMisses,
      lastPongTime: this.connectionQuality.lastPongTime
    };
  }

  /**
   * Check if error is transient (retryable)
   * @param {Error} error - Error object
   * @returns {boolean} True if error is transient
   */
  isTransientError(error) {
    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || error.statusCode || error.status;

    // Transient errors: network issues, timeouts, temporary service unavailability
    const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'];
    const transientStatusCodes = [503, 502, 504, 429]; // Service Unavailable, Bad Gateway, Gateway Timeout, Rate Limit

    if (errorCode && typeof errorCode === 'string' && transientCodes.includes(errorCode)) {
      return true;
    }

    if (errorCode && typeof errorCode === 'number' && transientStatusCodes.includes(errorCode)) {
      return true;
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT')) {
      return true;
    }

    return false;
  }

  /**
   * Stop keep-alive mechanism
   */
  stopKeepAlive() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.isPermanentlyClosed = true;
    this.messageQueue = [];
    this.stopKeepAlive(); // clear interval and timeout first so no more pong logs
    this.warningLogged = false;
    this.connectionQuality = {
      latency: [],
      packetLoss: 0,
      lastPongTime: null,
      consecutivePongMisses: 0,
      isHealthy: false
    };
  }
}
