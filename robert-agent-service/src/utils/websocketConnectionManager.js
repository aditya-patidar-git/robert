/**
 * WebSocket Connection Manager
 * Provides robust WebSocket connection management with:
 * - Keep-alive/ping mechanism
 * - Connection quality monitoring
 * - Transient error detection
 */

export class WebSocketConnectionManager {
  constructor(ws, callSid, options = {}) {
    this.ws = ws;
    this.callSid = callSid;
    this.pingInterval = null;
    this.pongTimeout = null;
    this.isPermanentlyClosed = false; // Track permanent closure
    this.warningLogged = false; // Track if warning has been logged to prevent log spam
    this.connectionQuality = {
      latency: [],
      packetLoss: 0,
      lastPongTime: null,
      consecutivePongMisses: 0,
      isHealthy: true
    };
    
    // Configuration
    this.config = {
      pingInterval: options.pingInterval || 30000, // 30 seconds
      pongTimeout: options.pongTimeout || 10000, // 10 seconds to receive pong
      maxLatencyHistory: options.maxLatencyHistory || 10,
      unhealthyThreshold: options.unhealthyThreshold || 3 // consecutive missed pongs
    };
    
    this.setupKeepAlive();
    this.setupConnectionQualityMonitoring();
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
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
      
      const now = Date.now();
      const latency = now - (this.lastPingTime || now);
      
      // Track latency
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
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        try {
          this.ws.ping();
          
          // Set timeout for pong response
          this.pongTimeout = setTimeout(() => {
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
    // Don't send if connection is permanently closed
    if (this.isPermanentlyClosed) {
      // Only log warning once to prevent log spam from repeated send attempts
      if (!this.warningLogged) {
        console.warn(`⚠️ [${this.callSid}] Message not sent - connection permanently closed`);
        this.warningLogged = true;
      }
      return false;
    }
    
    // If WebSocket is CLOSED, mark as permanently closed
    if (this.ws && this.ws.readyState === WebSocket.CLOSED) {
      this.isPermanentlyClosed = true;
      // Only log warning once to prevent log spam
      if (!this.warningLogged) {
        console.warn(`⚠️ [${this.callSid}] WebSocket is CLOSED - cannot send message`);
        this.warningLogged = true;
      }
      return false;
    }
    
    // Only send if connection is OPEN and healthy
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
    
    // Connection not ready
    console.warn(`⚠️ [${this.callSid}] Message not sent - WebSocket not ready (readyState: ${this.ws?.readyState}, healthy: ${this.connectionQuality.isHealthy})`);
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
    // Mark as permanently closed during cleanup
    this.isPermanentlyClosed = true;
    this.stopKeepAlive();
    // Reset warning flag so cleanup can log if needed
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
