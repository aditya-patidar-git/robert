/**
 * SIP Session Manager
 * Manages active SIP sessions, timeouts, and cleanup
 */

class SipSessionManager {
  constructor() {
    this.sessions = new Map(); // Map<callId, sessionData>
    this.defaultTimeout = 3600000; // 1 hour default
    this.cleanupInterval = null;
    this.cleanupIntervalMs = 60000; // Check every minute
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupIntervalMs);

    console.log('✅ SIP Session Manager cleanup started');
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('✅ SIP Session Manager cleanup stopped');
    }
  }

  /**
   * Create a new SIP session
   * @param {string} callId - Call ID
   * @param {Object} sessionData - Session data
   * @returns {Object} - Session object
   */
  createSession(callId, sessionData = {}) {
    const session = {
      callId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      timeout: sessionData.timeout || this.defaultTimeout,
      status: 'active',
      metadata: sessionData.metadata || {},
      // Track pending tool calls for concurrency management
      pendingToolCalls: new Set(), // Set<toolCallId>
      activeToolExecutions: new Map(), // Map<toolName, {call_id, startTime, callSid}>
      ...sessionData
    };

    this.sessions.set(callId, session);
    console.log(`✅ [SIP] Session created: ${callId}`);

    // Start cleanup if not already running
    if (!this.cleanupInterval) {
      this.startCleanup();
    }

    return session;
  }

  /**
   * Get session by call ID
   * @param {string} callId - Call ID
   * @returns {Object|null} - Session object or null
   */
  getSession(callId) {
    const session = this.sessions.get(callId);
    if (session) {
      // Update last activity
      session.lastActivity = Date.now();
    }
    return session || null;
  }

  /**
   * Update session
   * @param {string} callId - Call ID
   * @param {Object} updates - Updates to apply
   */
  updateSession(callId, updates) {
    const session = this.sessions.get(callId);
    if (!session) {
      console.warn(`⚠️ [SIP] Cannot update non-existent session: ${callId}`);
      return;
    }

    Object.assign(session, updates);
    session.lastActivity = Date.now();
    this.sessions.set(callId, session);
  }

  /**
   * Delete session
   * @param {string} callId - Call ID
   */
  deleteSession(callId) {
    const session = this.sessions.get(callId);
    if (session) {
      // Clean up tool execution tracking
      if (session.pendingToolCalls) {
        session.pendingToolCalls.clear();
      }
      if (session.activeToolExecutions) {
        session.activeToolExecutions.clear();
      }
    }
    
    const deleted = this.sessions.delete(callId);
    if (deleted) {
      console.log(`✅ [SIP] Session deleted: ${callId}`);
    }
  }

  /**
   * Add pending tool call to session
   * @param {string} callId - Call ID
   * @param {string} toolCallId - Tool call ID
   */
  addPendingToolCall(callId, toolCallId) {
    const session = this.sessions.get(callId);
    if (session && session.pendingToolCalls) {
      session.pendingToolCalls.add(toolCallId);
      session.lastActivity = Date.now();
    }
  }

  /**
   * Remove pending tool call from session
   * @param {string} callId - Call ID
   * @param {string} toolCallId - Tool call ID
   */
  removePendingToolCall(callId, toolCallId) {
    const session = this.sessions.get(callId);
    if (session && session.pendingToolCalls) {
      session.pendingToolCalls.delete(toolCallId);
      session.lastActivity = Date.now();
    }
  }

  /**
   * Mark tool as active execution
   * @param {string} callId - Call ID
   * @param {string} toolName - Tool name
   * @param {string} toolCallId - Tool call ID
   */
  setActiveToolExecution(callId, toolName, toolCallId) {
    const session = this.sessions.get(callId);
    if (session && session.activeToolExecutions) {
      session.activeToolExecutions.set(toolName, {
        call_id: toolCallId,
        startTime: Date.now(),
        callSid: callId
      });
      session.lastActivity = Date.now();
    }
  }

  /**
   * Remove active tool execution
   * @param {string} callId - Call ID
   * @param {string} toolName - Tool name
   */
  removeActiveToolExecution(callId, toolName) {
    const session = this.sessions.get(callId);
    if (session && session.activeToolExecutions) {
      session.activeToolExecutions.delete(toolName);
      session.lastActivity = Date.now();
    }
  }

  /**
   * Get all active sessions
   * @returns {Array} - Array of session objects
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   * @returns {number} - Number of active sessions
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expired = [];

    for (const [callId, session] of this.sessions.entries()) {
      const age = now - session.lastActivity;
      if (age > session.timeout) {
        expired.push(callId);
      }
    }

    if (expired.length > 0) {
      console.log(`🧹 [SIP] Cleaning up ${expired.length} expired sessions`);
      expired.forEach(callId => {
        this.deleteSession(callId);
      });
    }
  }

  /**
   * Clean up all sessions (for shutdown)
   */
  cleanupAll() {
    const count = this.sessions.size;
    this.sessions.clear();
    console.log(`🧹 [SIP] Cleaned up all ${count} sessions`);
  }
}

export default new SipSessionManager();

