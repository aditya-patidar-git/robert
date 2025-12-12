/**
 * Session Management Service
 * Centralized service for session lifecycle management, cleanup, and monitoring
 */

import { createConversationState, mergeConversationState, validateConversationState } from '../shared/stateFactory.js';
import { conversations } from '../shared/state.js';

class SessionManagementService {
  constructor() {
    // Configuration from environment variables
    this.sessionTTL = parseInt(process.env.SESSION_TTL_MINUTES || '60', 10) * 60 * 1000; // Convert to ms
    this.maxSessions = parseInt(process.env.MAX_SESSIONS || '100', 10);
    this.cleanupInterval = parseInt(process.env.SESSION_CLEANUP_INTERVAL_SECONDS || '60', 10) * 1000; // Convert to ms
    
    this.cleanupTimer = null;
    this.cleanupCount = 0;
    this.evictionCount = 0;
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Initialize a new session with standardized structure
   * @param {string} callSid - Call SID identifier
   * @param {Object} initialData - Initial state data
   * @returns {Object} Created session state
   */
  initializeSession(callSid, initialData = {}) {
    if (!callSid) {
      throw new Error('CallSid is required to initialize session');
    }

    // Check if session already exists
    if (conversations[callSid]) {
      console.log(`📝 [SESSION] Session ${callSid} already exists, updating lastActivityTime`);
      conversations[callSid].lastActivityTime = Date.now();
      return conversations[callSid];
    }

    // Check memory limit before creating new session
    this.enforceMemoryLimit();

    // Create standardized state
    const state = createConversationState(callSid, {
      ...initialData,
      callSid: callSid
    });

    conversations[callSid] = state;
    console.log(`✅ [SESSION] Initialized session ${callSid} (total: ${Object.keys(conversations).length})`);
    
    return state;
  }

  /**
   * Get session with validation and activity update
   * @param {string} callSid - Call SID identifier
   * @returns {Object|null} Session state or null if not found
   */
  getSession(callSid) {
    if (!callSid) {
      return null;
    }

    const session = conversations[callSid];
    if (!session) {
      return null;
    }

    // Update last activity time
    session.lastActivityTime = Date.now();

    // Validate structure
    if (!validateConversationState(session)) {
      console.warn(`⚠️ [SESSION] Invalid state structure for ${callSid}, reinitializing`);
      // Reinitialize with existing data
      conversations[callSid] = createConversationState(callSid, session);
      return conversations[callSid];
    }

    return session;
  }

  /**
   * Update session data
   * @param {string} callSid - Call SID identifier
   * @param {Object} updates - Updates to apply
   * @returns {Object|null} Updated session or null if not found
   */
  updateSession(callSid, updates) {
    const session = this.getSession(callSid);
    if (!session) {
      console.warn(`⚠️ [SESSION] Cannot update session ${callSid}: not found`);
      return null;
    }

    // Merge updates
    conversations[callSid] = mergeConversationState(session, updates);
    console.log(`📝 [SESSION] Updated session ${callSid}`);
    
    return conversations[callSid];
  }

  /**
   * Delete session
   * @param {string} callSid - Call SID identifier
   * @returns {boolean} True if deleted, false if not found
   */
  deleteSession(callSid) {
    if (!callSid) {
      return false;
    }

    if (conversations[callSid]) {
      delete conversations[callSid];
      console.log(`🧹 [SESSION] Deleted session ${callSid} (remaining: ${Object.keys(conversations).length})`);
      return true;
    }

    return false;
  }

  /**
   * Clean up stale sessions (exceeding TTL)
   * @returns {number} Number of sessions cleaned up
   */
  cleanupStaleSessions() {
    const now = Date.now();
    const staleSessions = [];
    const MIN_SESSION_AGE = 60000; // Don't clean up sessions less than 1 minute old
    
    for (const [callSid, session] of Object.entries(conversations)) {
      // Skip test sessions (they should be manually cleaned up)
      if (callSid.startsWith('test-')) {
        continue;
      }
      
      const age = now - (session.lastActivityTime || session.startTime || 0);
      
      // Only clean up if session is old enough AND exceeds TTL
      if (age > MIN_SESSION_AGE && age > this.sessionTTL) {
        staleSessions.push(callSid);
      }
    }

    // Delete stale sessions
    staleSessions.forEach(callSid => {
      this.deleteSession(callSid);
      this.cleanupCount++;
    });

    if (staleSessions.length > 0) {
      console.log(`🧹 [SESSION] Cleaned up ${staleSessions.length} stale session(s) (TTL: ${this.sessionTTL / 1000 / 60} minutes)`);
    }

    return staleSessions.length;
  }

  /**
   * Enforce memory limit by evicting oldest sessions (LRU)
   * @returns {number} Number of sessions evicted
   */
  enforceMemoryLimit() {
    const sessionCount = Object.keys(conversations).length;
    
    if (sessionCount < this.maxSessions) {
      return 0; // No eviction needed
    }

    // Calculate how many to evict
    const toEvict = sessionCount - this.maxSessions + 1; // Evict one more than needed to make room
    
    // Sort sessions by lastActivityTime (oldest first)
    const sessions = Object.entries(conversations)
      .map(([callSid, session]) => ({
        callSid,
        lastActivityTime: session.lastActivityTime || session.startTime || 0
      }))
      .sort((a, b) => a.lastActivityTime - b.lastActivityTime);

    // Evict oldest sessions
    const evicted = sessions.slice(0, toEvict);
    evicted.forEach(({ callSid }) => {
      this.deleteSession(callSid);
      this.evictionCount++;
    });

    if (evicted.length > 0) {
      console.warn(`⚠️ [SESSION] Evicted ${evicted.length} session(s) due to memory limit (max: ${this.maxSessions})`);
    }

    return evicted.length;
  }

  /**
   * Start periodic cleanup interval
   */
  startCleanupInterval() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanupStaleSessions();
      } catch (error) {
        console.error('❌ [SESSION] Error in cleanup interval:', error);
      }
    }, this.cleanupInterval);

    console.log(`🔄 [SESSION] Started cleanup interval (every ${this.cleanupInterval / 1000} seconds)`);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('🛑 [SESSION] Stopped cleanup interval');
    }
  }

  /**
   * Get session metrics for monitoring
   * @returns {Object} Metrics object
   */
  getSessionMetrics() {
    const sessionCount = Object.keys(conversations).length;
    const now = Date.now();
    
    // Calculate average age
    let totalAge = 0;
    let activeCount = 0;
    
    for (const session of Object.values(conversations)) {
      const age = now - (session.startTime || now);
      totalAge += age;
      activeCount++;
    }
    
    const avgAge = activeCount > 0 ? totalAge / activeCount : 0;

    return {
      activeSessions: sessionCount,
      maxSessions: this.maxSessions,
      sessionTTLMinutes: this.sessionTTL / 1000 / 60,
      cleanupIntervalSeconds: this.cleanupInterval / 1000,
      totalCleanups: this.cleanupCount,
      totalEvictions: this.evictionCount,
      averageSessionAgeMs: Math.round(avgAge),
      memoryUsagePercent: Math.round((sessionCount / this.maxSessions) * 100)
    };
  }

  /**
   * Get all active session IDs
   * @returns {Array<string>} Array of callSids
   */
  getActiveSessionIds() {
    return Object.keys(conversations);
  }
}

// Export singleton instance
export default new SessionManagementService();

