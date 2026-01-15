/**
 * WebSocket Connection Manager
 * Provides robust WebSocket connection management with:
 * - Keep-alive/ping mechanism
 * - Message queuing for failed sends
 * - Connection quality monitoring
 * - Transient error detection
 */

export class WebSocketConnectionManager {
  constructor(ws, callSid, options = {}) {
    this.ws = ws;
    this.callSid = callSid;
    this.messageQueue = [];
    this.pingInterval = null;
    this.pongTimeout = null;
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
      maxQueueSize: options.maxQueueSize || 100,
      maxLatencyHistory: options.maxLatencyHistory || 10,
      unhealthyThreshold: options.unhealthyThreshold || 3 // consecutive missed pongs
    };
    
    this.setupKeepAlive();
    this.setupMessageQueue();
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
   * Setup message queue for failed sends
   */
  setupMessageQueue() {
    // Process queue when connection is restored
    if (this.ws) {
      this.ws.on('open', () => {
        this.flushMessageQueue();
      });
    }
  }

  /**
   * Send message with queuing support
   * @param {string|Object} message - Message to send (string or object to stringify)
   * @param {Object} options - Send options
   * @returns {boolean} True if sent immediately, false if queued
   */
  send(message, options = {}) {
    const { queueOnFailure = true, priority = 'normal' } = options;
    
    // Convert object to string if needed
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    // Check if connection is open
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connectionQuality.isHealthy) {
      try {
        this.ws.send(messageStr);
        return true;
      } catch (error) {
        console.error(`❌ [${this.callSid}] Error sending message:`, error.message);
        if (queueOnFailure) {
          this.queueMessage(messageStr, priority);
        }
        return false;
      }
    } else {
      // Connection not ready, queue message
      if (queueOnFailure) {
        this.queueMessage(messageStr, priority);
        console.log(`📦 [${this.callSid}] Message queued (readyState: ${this.ws?.readyState}, healthy: ${this.connectionQuality.isHealthy})`);
      } else {
        console.warn(`⚠️ [${this.callSid}] Message not sent and not queued (readyState: ${this.ws?.readyState})`);
      }
      return false;
    }
  }

  /**
   * Queue a message for later sending
   * @param {string} message - Message to queue
   * @param {string} priority - Priority: 'high', 'normal', 'low'
   */
  queueMessage(message, priority = 'normal') {
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      // Remove lowest priority message if queue is full
      const lowPriorityIndex = this.messageQueue.findIndex(m => m.priority === 'low');
      if (lowPriorityIndex !== -1) {
        this.messageQueue.splice(lowPriorityIndex, 1);
        console.warn(`⚠️ [${this.callSid}] Queue full, removed low priority message`);
      } else {
        // Remove oldest normal priority message
        const normalPriorityIndex = this.messageQueue.findIndex(m => m.priority === 'normal');
        if (normalPriorityIndex !== -1) {
          this.messageQueue.splice(normalPriorityIndex, 1);
          console.warn(`⚠️ [${this.callSid}] Queue full, removed oldest normal priority message`);
        } else {
          // Queue is full of high priority, drop oldest
          this.messageQueue.shift();
          console.warn(`⚠️ [${this.callSid}] Queue full, dropped oldest high priority message`);
        }
      }
    }

    this.messageQueue.push({
      message,
      priority,
      timestamp: Date.now(),
      retryCount: 0
    });
  }

  /**
   * Flush queued messages when connection is restored
   */
  flushMessageQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Sort by priority: high -> normal -> low
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.messageQueue.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.timestamp - b.timestamp; // Older messages first within same priority
    });

    const failedMessages = [];
    
    while (this.messageQueue.length > 0) {
      const queued = this.messageQueue.shift();
      
      try {
        this.ws.send(queued.message);
        console.log(`✅ [${this.callSid}] Sent queued message (priority: ${queued.priority}, age: ${Date.now() - queued.timestamp}ms)`);
      } catch (error) {
        console.error(`❌ [${this.callSid}] Error sending queued message:`, error.message);
        queued.retryCount++;
        
        // Retry up to 3 times, then drop
        if (queued.retryCount < 3) {
          failedMessages.push(queued);
        } else {
          console.warn(`⚠️ [${this.callSid}] Dropping message after ${queued.retryCount} retry attempts`);
        }
      }
    }

    // Re-queue failed messages
    this.messageQueue.push(...failedMessages);
  }

  /**
   * Setup connection quality monitoring
   */
  setupConnectionQualityMonitoring() {
    // Monitor connection state changes
    if (this.ws) {
      this.ws.on('close', () => {
        this.connectionQuality.isHealthy = false;
        this.stopKeepAlive();
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
      lastPongTime: this.connectionQuality.lastPongTime,
      queuedMessages: this.messageQueue.length
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
    this.stopKeepAlive();
    this.messageQueue = [];
    this.connectionQuality = {
      latency: [],
      packetLoss: 0,
      lastPongTime: null,
      consecutivePongMisses: 0,
      isHealthy: false
    };
  }
}
