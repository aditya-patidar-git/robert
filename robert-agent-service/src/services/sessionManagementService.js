/**
 * Session Management Service
 * Centralized service for session lifecycle management, cleanup, and monitoring.
 * 
 * Now supports distributed state via Twilio Sync:
 * - When Sync is configured, TTL is managed by Sync (automatic cleanup)
 * - Manual cleanup timers only run for local-only mode
 * - Sessions are synced to distributed state for horizontal scalability
 */

import { createConversationState, mergeConversationState, validateConversationState } from '../shared/stateFactory.js';
import { 
  conversations, 
  setConversation, 
  getConversation, 
  deleteConversation,
  initializeDistributedState,
  realtimeClients 
} from '../shared/state.js';
import distributedStateService from './distributedStateService.js';
import { validateSessionConfig, logValidationResult } from '../utils/configValidator.js';
import { closeSipCallWebSocket } from './sipWebSocketRegistry.js';

class SessionManagementService {
  constructor() {
    // Configuration from environment variables (defaults)
    this.sessionTTL = parseInt(process.env.SESSION_TTL_MINUTES || '60', 10) * 60 * 1000; // Convert to ms
    this.sessionTTLSeconds = parseInt(process.env.SYNC_SESSION_TTL, 10) || this.sessionTTL / 1000; // For Sync TTL
    this.maxSessions = parseInt(process.env.MAX_SESSIONS || '100', 10);
    this.cleanupInterval = parseInt(process.env.SESSION_CLEANUP_INTERVAL_SECONDS || '60', 10) * 1000; // Convert to ms
    
    // Database-configurable settings (will be updated from configManager)
    this.maxConcurrentCalls = 50; // Will be synced from DB config
    this.callTimeout = 300; // Seconds, will be synced from DB config
    
    this.cleanupTimer = null;
    this.cleanupCount = 0;
    this.evictionCount = 0;
    
    // Track if distributed state is available
    this.useDistributedState = false;
    
    // Track configuration validation
    this.configValidated = false;
    
    // Track initialization state (lazy initialization - call initialize() explicitly)
    this._initialized = false;
    this._initPromise = null;
  }

  /**
   * Update session limits from configManager settings.
   * Called periodically to sync with database configuration.
   * @param {Object} systemSettings - System settings from configManager
   */
  updateFromConfig(systemSettings) {
    if (!systemSettings) return;
    
    const { maxConcurrentCalls, callTimeout } = systemSettings;
    
    let changed = false;
    
    if (maxConcurrentCalls && maxConcurrentCalls !== this.maxConcurrentCalls) {
      this.maxConcurrentCalls = maxConcurrentCalls;
      // Update maxSessions to be at least maxConcurrentCalls + buffer
      const minSessions = Math.ceil(maxConcurrentCalls * 1.2); // 20% buffer
      if (this.maxSessions < minSessions) {
        this.maxSessions = minSessions;
      }
      changed = true;
    }
    
    if (callTimeout && callTimeout !== this.callTimeout) {
      this.callTimeout = callTimeout;
      // Update session TTL to be at least callTimeout + 5 minutes buffer
      const minTTL = (callTimeout + 300) * 1000;
      if (this.sessionTTL < minTTL) {
        this.sessionTTL = minTTL;
        this.sessionTTLSeconds = this.sessionTTL / 1000;
      }
      changed = true;
    }
    
    if (changed) {
      console.log(`📋 [SESSION] Config updated: maxConcurrentCalls=${this.maxConcurrentCalls}, callTimeout=${this.callTimeout}s, maxSessions=${this.maxSessions}`);
    }
  }

  /**
   * Get the current call limit.
   * @returns {number} Max concurrent calls allowed
   */
  getMaxConcurrentCalls() {
    return this.maxConcurrentCalls;
  }

  /**
   * Get the current call timeout in seconds.
   * @returns {number} Call timeout in seconds
   */
  getCallTimeout() {
    return this.callTimeout;
  }

  /**
   * Check if a new call can be accepted based on current limits.
   * @returns {boolean} True if under limit, false if at capacity
   */
  canAcceptNewCall() {
    const currentCalls = Object.keys(conversations).length;
    return currentCalls < this.maxConcurrentCalls;
  }

  /**
   * Validate session configuration and log warnings.
   * Called during service initialization.
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    if (this.configValidated) {
      return this._lastValidationResult;
    }

    const result = validateSessionConfig(process.env);
    logValidationResult(result, 'Session Management');
    
    // Additional validation for concurrent call support
    if (this.maxSessions < 50) {
      result.warnings.push(
        `MAX_SESSIONS (${this.maxSessions}) is below recommended minimum (50) for 20 concurrent calls. ` +
        'Consider increasing to at least 50 to handle concurrent calls with buffer.'
      );
    }

    this._lastValidationResult = result;
    this.configValidated = true;
    
    return result;
  }

  /**
   * Public initialize method - call this explicitly after environment variables are loaded.
   * Ensures distributed state initialization happens after dotenv has loaded all env vars.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    // Return existing promise if initialization is in progress
    if (this._initPromise) {
      return this._initPromise;
    }
    
    // Return immediately if already initialized
    if (this._initialized) {
      return;
    }
    
    // Create initialization promise
    this._initPromise = this._initialize();
    
    try {
      await this._initPromise;
      this._initialized = true;
    } finally {
      this._initPromise = null;
    }
  }

  /**
   * Internal initialization logic.
   * @private
   */
  async _initialize() {
    try {
      // Validate configuration (logs warnings if issues detected)
      this.validateConfiguration();
      
      // Initialize distributed state
      this.useDistributedState = await initializeDistributedState();
      
      if (this.useDistributedState) {
        console.log(`✅ [SESSION] Distributed state enabled - Sync TTL will handle session expiry (${this.sessionTTLSeconds}s)`);
        // With Sync TTL, we can reduce cleanup frequency (only for local cache maintenance)
        this.cleanupInterval = Math.max(this.cleanupInterval, 300000); // At least 5 minutes
      }
      
      // Start cleanup interval (for local cache and non-Sync mode)
      this.startCleanupInterval();
    } catch (error) {
      console.error('[SESSION] Initialization error:', error.message);
      // Fall back to local-only mode
      this.startCleanupInterval();
    }
  }

  /**
   * Initialize a new session with standardized structure.
   * Syncs to distributed state when available.
   * 
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
      conversations[callSid].lastActivityTime = Date.now();
      // Sync to distributed state (fire-and-forget)
      this._syncToDistributed(callSid, conversations[callSid]);
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
    
    // Sync to distributed state with TTL (fire-and-forget)
    this._syncToDistributed(callSid, state);
    
    console.log(`✅ [SESSION] Initialized session ${callSid} (total: ${Object.keys(conversations).length}, distributed: ${this.useDistributedState})`);
    
    return state;
  }

  /**
   * Sync a session to distributed state (fire-and-forget).
   * @private
   */
  _syncToDistributed(callSid, data) {
    if (this.useDistributedState) {
      setConversation(callSid, data, this.sessionTTLSeconds)
        .catch(err => {
          console.warn(`[SESSION] Failed to sync ${callSid} to distributed state:`, err.message);
        });
    }
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
   * Update session data.
   * Syncs to distributed state when available.
   * 
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
    
    // Sync to distributed state (fire-and-forget)
    this._syncToDistributed(callSid, conversations[callSid]);
    
    console.log(`📝 [SESSION] Updated session ${callSid}`);
    
    return conversations[callSid];
  }

  /**
   * Delete session.
   * Removes from both local memory and distributed state.
   * 
   * @param {string} callSid - Call SID identifier
   * @returns {boolean} True if deleted, false if not found
   */
  deleteSession(callSid) {
    if (!callSid) {
      return false;
    }

    const existed = !!conversations[callSid];
    
    // Delete from local memory
    if (conversations[callSid]) {
      delete conversations[callSid];
    }
    
    // Delete from distributed state (fire-and-forget)
    if (this.useDistributedState) {
      deleteConversation(callSid).catch(err => {
        console.warn(`[SESSION] Failed to delete ${callSid} from distributed state:`, err.message);
      });
    }
    
    if (existed) {
      console.log(`🧹 [SESSION] Deleted session ${callSid} (remaining: ${Object.keys(conversations).length})`);
    }

    return existed;
  }

  /**
   * Clean up stale sessions (exceeding TTL).
   * 
   * Note: When Twilio Sync is enabled, session expiry is handled automatically
   * by Sync TTL. This method primarily cleans up the local cache in that case.
   * 
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

    // Clean up SIP WebSockets, realtimeClients, and then delete stale sessions
    staleSessions.forEach(callSid => {
      closeSipCallWebSocket(callSid);
      const client = realtimeClients[callSid];
      if (client) {
        if (typeof client.connectionManager?.cleanup === 'function') {
          client.connectionManager.cleanup();
        }
        if (client.openaiWs && client.openaiWs.readyState === 1) {
          client.openaiWs.close(1000, 'Session expired');
        }
        if (client.twilioWs && client.twilioWs.readyState === 1) {
          client.twilioWs.close(1000, 'Session expired');
        }
        delete realtimeClients[callSid];
      }
      this.deleteSession(callSid);
      this.cleanupCount++;
    });

    if (staleSessions.length > 0) {
      const mode = this.useDistributedState ? 'local cache' : 'local storage';
      console.log(`🧹 [SESSION] Cleaned up ${staleSessions.length} stale session(s) from ${mode} (TTL: ${this.sessionTTL / 1000 / 60} minutes)`);
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
   * Get session metrics for monitoring.
   * Includes distributed state info when available.
   * 
   * @returns {Promise<Object>} Metrics object
   */
  async getSessionMetrics() {
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

    const metrics = {
      activeSessions: sessionCount,
      maxSessions: this.maxSessions,
      sessionTTLMinutes: this.sessionTTL / 1000 / 60,
      cleanupIntervalSeconds: this.cleanupInterval / 1000,
      totalCleanups: this.cleanupCount,
      totalEvictions: this.evictionCount,
      averageSessionAgeMs: Math.round(avgAge),
      memoryUsagePercent: Math.round((sessionCount / this.maxSessions) * 100),
      useDistributedState: this.useDistributedState
    };
    
    // Add distributed state metrics if available
    if (this.useDistributedState) {
      try {
        const distributedStatus = await distributedStateService.getStatus();
        metrics.distributed = {
          enabled: true,
          syncTTLSeconds: this.sessionTTLSeconds,
          ...distributedStatus
        };
      } catch (error) {
        metrics.distributed = {
          enabled: true,
          error: error.message
        };
      }
    }

    return metrics;
  }

  /**
   * Get all active session IDs.
   * Returns local session IDs; for distributed session count, use getSessionMetrics.
   * 
   * @returns {Array<string>} Array of callSids
   */
  getActiveSessionIds() {
    return Object.keys(conversations);
  }

  /**
   * Get a session from distributed state (async version).
   * Falls back to local memory if not found in distributed state.
   * 
   * @param {string} callSid - Call SID identifier
   * @returns {Promise<Object|null>} Session state or null if not found
   */
  async getSessionAsync(callSid) {
    if (!callSid) {
      return null;
    }

    // Try distributed state first
    if (this.useDistributedState) {
      try {
        const distributed = await getConversation(callSid);
        if (distributed) {
          // Update local cache
          conversations[callSid] = distributed;
          distributed.lastActivityTime = Date.now();
          return distributed;
        }
      } catch (error) {
        console.warn(`[SESSION] Error getting distributed session ${callSid}:`, error.message);
      }
    }

    // Fall back to local session
    return this.getSession(callSid);
  }

  /**
   * Check if distributed state is enabled.
   * @returns {boolean} True if distributed state is enabled
   */
  isDistributedEnabled() {
    return this.useDistributedState;
  }
}

// Export singleton instance
export default new SessionManagementService();

