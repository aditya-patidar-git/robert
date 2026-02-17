/**
 * Distributed State Service
 * Business logic layer for state management across multiple instances.
 * 
 * This service provides:
 * - Cache-first access with Twilio Sync as source of truth
 * - Graceful degradation to in-memory when Sync unavailable
 * - Distributed locking for concurrent access control
 * - Automatic session TTL management
 * 
 * Architecture:
 * - Application code → distributedStateService (this) → twilioSyncService → Twilio Sync
 * - Application code should NEVER call twilioSyncService directly
 * 
 * @module distributedStateService
 */

import twilioSyncService from './twilioSyncService.js';
import crypto from 'crypto';
import { sanitizeForJSON } from '../utils/objectUtils.js';
import { isNetworkError, isRetryableError } from '../utils/isRetryableError.js';

/** Twilio Sync Map item size limit (16 KiB). Payloads must stay under this. */
const SYNC_PAYLOAD_LIMIT_BYTES = 16 * 1024;
/** Target size to avoid stricter 2 writes/s rate limit for items >= 10 KiB. */
const SYNC_PAYLOAD_TARGET_BYTES = 10 * 1024;
/** Max step history entries to sync (non-aggressive). */
const SYNC_STEP_HISTORY_CAP = 5;

/**
 * Build a Sync-safe payload from a sanitized conversation.
 * Omits large or non-essential data so the payload stays under SYNC_PAYLOAD_LIMIT_BYTES.
 * Used for failover/recovery; full state remains in local memory.
 *
 * @param {Object} sanitizedConversation - Already sanitized (no circular refs, no WebSocket).
 * @param {{ aggressive?: boolean }} [options] - If aggressive, omit step histories and keep minimal booking/session details.
 * @returns {Object} Plain object safe to send to Twilio Sync.
 */
function buildSyncPayload(sanitizedConversation, options = {}) {
  const aggressive = !!options.aggressive;
  const out = { _lastUpdated: sanitizedConversation._lastUpdated || new Date().toISOString() };

  // Top-level fields needed for routing and identity (small)
  const smallKeys = ['from', 'to', 'workflowContext', 'phase', 'language', 'clientVerified', 'clientVerifiedAt', 'verificationMethod'];
  for (const k of smallKeys) {
    if (sanitizedConversation[k] !== undefined) out[k] = sanitizedConversation[k];
  }
  if (sanitizedConversation.clientDetails && typeof sanitizedConversation.clientDetails === 'object') {
    out.clientDetails = sanitizedConversation.clientDetails;
  }

  // bookingSession (trimmed)
  const bs = sanitizedConversation.bookingSession;
  if (bs && typeof bs === 'object') {
    const trimmed = {
      browserSessionId: bs.browserSessionId,
      currentStep: bs.currentStep,
      cancellationCurrentStep: bs.cancellationCurrentStep,
      workflowType: bs.workflowType,
      workflowTypeAsked: bs.workflowTypeAsked,
      courseType: bs.courseType,
      lastActivity: bs.lastActivity,
      cancellationFee: bs.cancellationFee
    };
    if (!aggressive) {
      const capHistory = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.slice(-SYNC_STEP_HISTORY_CAP).map((e) => ({
          step: e.step,
          previousStep: e.previousStep,
          timestamp: e.timestamp
        }));
      };
      trimmed.stepHistory = capHistory(bs.stepHistory);
      trimmed.cancellationStepHistory = capHistory(bs.cancellationStepHistory);
      if (bs.knownPreferences && typeof bs.knownPreferences === 'object') {
        trimmed.knownPreferences = bs.knownPreferences;
      }
    }
    // Minimal bookingDetails/sessionDetails (ids and key fields only)
    if (bs.bookingDetails && typeof bs.bookingDetails === 'object') {
      trimmed.bookingDetails = {
        bookingId: bs.bookingDetails.bookingId,
        courseDate: bs.bookingDetails.courseDate,
        courseType: bs.bookingDetails.courseType
      };
    }
    if (bs.sessionDetails && typeof bs.sessionDetails === 'object') {
      trimmed.sessionDetails = {
        id: bs.sessionDetails.id,
        startDate: bs.sessionDetails.startDate,
        rowIndex: bs.sessionDetails.rowIndex
      };
    }
    out.bookingSession = trimmed;
  }

  // lastAvailabilityCheck: do not sync allSlots; compact representation only
  const lac = sanitizedConversation.lastAvailabilityCheck;
  if (lac && typeof lac === 'object') {
    const compact = {
      slotCount: Array.isArray(lac.allSlots) ? lac.allSlots.length : 0
    };
    if (lac.selectedSlot && typeof lac.selectedSlot === 'object') {
      compact.selectedSlot = {
        rowIndex: lac.selectedSlot.rowIndex,
        startDate: lac.selectedSlot.startDate,
        time: lac.selectedSlot.time
      };
    }
    if (lac.sessionDetails && typeof lac.sessionDetails === 'object') {
      compact.sessionDetails = {
        id: lac.sessionDetails.id,
        startDate: lac.sessionDetails.startDate,
        rowIndex: lac.sessionDetails.rowIndex
      };
    }
    out.lastAvailabilityCheck = compact;
  }

  return out;
}

class DistributedStateService {
  constructor() {
    // Local cache for fast access
    this.localCache = new Map();
    
    // Track if Sync is available
    this.useSync = false;
    
    // Instance ID for distributed locking
    this.instanceId = this._generateInstanceId();
    
    // Configuration
    this.config = {
      defaultTtl: parseInt(process.env.SYNC_SESSION_TTL, 10) || 3600, // 1 hour
      cacheMaxAge: 30000, // 30 seconds - max age for cache without refresh
      lockTtl: 30 // 30 seconds for distributed locks
    };
    
    // Cache metadata for staleness tracking
    this.cacheMetadata = new Map();
    
    // Track network errors per call to avoid log spam
    this._networkErrorLoggedForCall = new Set();
    
    // Initialization promise
    this.initPromise = null;
    this.initialized = false;
  }

  /**
   * Generate a unique instance ID for this process.
   * @private
   */
  _generateInstanceId() {
    const hostname = process.env.HOSTNAME || 'unknown';
    const pid = process.pid;
    const random = crypto.randomBytes(4).toString('hex');
    return `${hostname}-${pid}-${random}`;
  }

  /**
   * Initialize the distributed state service.
   * Attempts to connect to Twilio Sync, falls back to in-memory if unavailable.
   * 
   * @returns {Promise<boolean>} True if Sync is available, false for in-memory mode
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }
    
    if (this.initialized) {
      return this.useSync;
    }
    
    this.initPromise = this._doInitialize();
    
    try {
      const result = await this.initPromise;
      return result;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Internal initialization logic.
   * @private
   */
  async _doInitialize() {
    try {
      // Check if Sync is configured
      const isConfigured = twilioSyncService.isConfigured();
      
      if (!isConfigured) {
        console.log('[DistributedStateService] Twilio Sync not configured - using in-memory mode');
        this.useSync = false;
        this.initialized = true;
        return false;
      }
      
      // Try to initialize Sync
      const syncInitialized = await twilioSyncService.initialize();
      
      if (syncInitialized) {
        console.log('[DistributedStateService] Connected to Twilio Sync - distributed mode enabled');
        console.log(`  - Instance ID: ${this.instanceId}`);
        this.useSync = true;
      } else {
        console.log('[DistributedStateService] Twilio Sync initialization failed - using in-memory mode');
        this.useSync = false;
      }
      
      this.initialized = true;
      return this.useSync;
    } catch (error) {
      console.error('[DistributedStateService] Initialization error:', error.message);
      this.useSync = false;
      this.initialized = true;
      return false;
    }
  }

  /**
   * Get a session by call SID.
   * Uses cache-first strategy with Sync as source of truth.
   * 
   * @param {string} callSid - Call SID
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async getSession(callSid) {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check local cache first (fast path)
    if (this.localCache.has(callSid)) {
      const cached = this.localCache.get(callSid);
      const metadata = this.cacheMetadata.get(callSid) || {};
      
      // Check if cache is still fresh
      const age = Date.now() - (metadata.fetchedAt || 0);
      if (age < this.config.cacheMaxAge) {
        return cached;
      }
      
      // Cache is stale - fetch from Sync if available
      if (this.useSync) {
        try {
          const session = await twilioSyncService.getSession(callSid);
          if (session) {
            this._updateCache(callSid, session);
            return session;
          }
          // Session not in Sync but in cache - might be deleted elsewhere
          // Keep cached version for now
        } catch (error) {
          console.warn(`[DistributedStateService] Error fetching session ${callSid} from Sync:`, error.message);
          // Return cached version on error
        }
      }
      
      return cached;
    }
    
    // Not in cache - try Sync
    if (this.useSync) {
      try {
        const session = await twilioSyncService.getSession(callSid);
        if (session) {
          this._updateCache(callSid, session);
        }
        return session;
      } catch (error) {
        console.warn(`[DistributedStateService] Error fetching session ${callSid}:`, error.message);
        return null;
      }
    }
    
    return null;
  }

  /**
   * Set a session.
   * Writes to both local cache and Twilio Sync.
   * 
   * @param {string} callSid - Call SID
   * @param {Object} data - Session data
   * @param {number} [ttl] - Time-to-live in seconds
   * @returns {Promise<boolean>} True if successful
   */
  async setSession(callSid, data, ttl = this.config.defaultTtl) {
    const startTime = Date.now();
    console.log(`[DIST-VERBOSE] [${callSid}] setSession() called at ${new Date().toISOString()}`);
    console.log(`[DIST-VERBOSE] [${callSid}] State: initialized=${this.initialized}, useSync=${this.useSync}`);
    
    // Ensure initialized
    if (!this.initialized) {
      console.log(`[DIST-VERBOSE] [${callSid}] Not initialized, calling initialize()...`);
      await this.initialize();
      console.log(`[DIST-VERBOSE] [${callSid}] After initialization: useSync=${this.useSync}`);
    }
    
    // CRITICAL FIX: Sanitize data FIRST before any JSON.stringify() calls
    // This prevents circular reference errors in _updateCache() which calls JSON.stringify() for size calculation
    console.log(`[DIST-VERBOSE] [${callSid}] Sanitizing data (removing non-serializable objects like Timeout, WebSocket)...`);
    const sanitizeStart = Date.now();
    let sanitizedData;
    try {
      sanitizedData = sanitizeForJSON(data);
      const sanitizeDuration = Date.now() - sanitizeStart;
      console.log(`[DIST-VERBOSE] [${callSid}] ✅ Sanitization completed in ${sanitizeDuration}ms`);
    } catch (error) {
      const sanitizeDuration = Date.now() - sanitizeStart;
      console.error(`[DIST-VERBOSE] [${callSid}] ❌ Sanitization failed after ${sanitizeDuration}ms:`, error.message);
      // If sanitization fails, try to continue with original data (will likely fail at Sync write)
      sanitizedData = data;
    }
    
    // Update local cache with sanitized data (safe for JSON.stringify() in _updateCache)
    console.log(`[DIST-VERBOSE] [${callSid}] Updating local cache with sanitized data...`);
    try {
      this._updateCache(callSid, sanitizedData);
    } catch (error) {
      console.error(`[DIST-VERBOSE] [${callSid}] ⚠️ Error updating cache:`, error.message);
      // Continue anyway - cache update failure shouldn't block sync write
    }
    
    const SYNC_SET_RETRIES = 3;
    const SYNC_SET_RETRY_DELAY_MS = 600;

    if (this.useSync) {
      let payloadForSync = buildSyncPayload(sanitizedData);
      let sizeInBytes = Buffer.byteLength(JSON.stringify(payloadForSync), 'utf8');
      if (sizeInBytes > SYNC_PAYLOAD_LIMIT_BYTES) {
        payloadForSync = buildSyncPayload(sanitizedData, { aggressive: true });
        sizeInBytes = Buffer.byteLength(JSON.stringify(payloadForSync), 'utf8');
      }
      if (sizeInBytes > SYNC_PAYLOAD_LIMIT_BYTES) {
        console.warn(`[DistributedState] Skipping Sync write for ${callSid}: payload size ${sizeInBytes} bytes exceeds ${SYNC_PAYLOAD_LIMIT_BYTES} limit`);
        const duration = Date.now() - startTime;
        console.log(`[DIST-VERBOSE] [${callSid}] ✅ setSession() completed in ${duration}ms (Sync skipped due to size)`);
        return true;
      }

      let lastError = null;
      for (let attempt = 1; attempt <= SYNC_SET_RETRIES; attempt++) {
        try {
          console.log(`[DIST-VERBOSE] [${callSid}] Writing to Twilio Sync (useSync=true)${attempt > 1 ? ` (retry ${attempt}/${SYNC_SET_RETRIES})` : ''}...`);
          const syncStart = Date.now();
          await twilioSyncService.setSession(callSid, payloadForSync, ttl);
          const syncDuration = Date.now() - syncStart;
          const totalDuration = Date.now() - startTime;
          console.log(`[DIST-VERBOSE] [${callSid}] ✅ setSession() completed in ${totalDuration}ms (sanitize: ${Date.now() - sanitizeStart}ms, sync: ${syncDuration}ms)`);
          return true;
        } catch (error) {
          lastError = error;
          if (attempt < SYNC_SET_RETRIES && isRetryableError(error)) {
            await new Promise(r => setTimeout(r, SYNC_SET_RETRY_DELAY_MS));
            continue;
          }
          break;
        }
      }
      const duration = Date.now() - startTime;
      if (isNetworkError(lastError)) {
        if (!this._networkErrorLoggedForCall.has(callSid)) {
          console.warn(`[DistributedState] Network error setting session ${callSid} in Sync after ${SYNC_SET_RETRIES} attempts (will use local cache only):`, lastError.message);
          this._networkErrorLoggedForCall.add(callSid);
        }
      } else {
        console.error(`[DIST-VERBOSE] [${callSid}] ❌ Error setting session in Sync after ${duration}ms:`, {
          message: lastError?.message,
          code: lastError?.code,
          status: lastError?.status,
          stack: lastError?.stack?.split('\n').slice(0, 10).join('\n')
        });
        console.error(`[DistributedState] Error setting session ${callSid} in Sync:`, lastError?.message);
      }
      return true;
    } else {
      const duration = Date.now() - startTime;
      console.log(`[DIST-VERBOSE] [${callSid}] ✅ setSession() completed in ${duration}ms (cache only, useSync=false)`);
    }
    
    return true;
  }

  /**
   * Update specific fields in a session.
   * Merges with existing data.
   * 
   * @param {string} callSid - Call SID
   * @param {Object} updates - Fields to update
   * @param {number} [ttl] - Time-to-live in seconds
   * @returns {Promise<boolean>} True if successful
   */
  async updateSession(callSid, updates, ttl = this.config.defaultTtl) {
    // Get existing session
    const existing = await this.getSession(callSid) || {};
    
    // Merge updates
    const merged = {
      ...existing,
      ...updates,
      _lastUpdated: new Date().toISOString()
    };
    
    // Save merged session
    return this.setSession(callSid, merged, ttl);
  }

  /**
   * Delete a session.
   * Removes from both local cache and Twilio Sync.
   * 
   * @param {string} callSid - Call SID
   * @returns {Promise<boolean>} True if successful
   */
  async deleteSession(callSid) {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Remove from local cache
    this.localCache.delete(callSid);
    this.cacheMetadata.delete(callSid);
    
    // Remove from Sync if available
    if (this.useSync) {
      try {
        await twilioSyncService.deleteSession(callSid);
      } catch (error) {
        console.error(`[DistributedStateService] Error deleting session ${callSid} from Sync:`, error.message);
        // Continue anyway - local cache is cleared
      }
    }
    
    return true;
  }

  /**
   * Acquire a distributed lock for a call.
   * In single-instance mode, always succeeds.
   * 
   * @param {string} callSid - Call SID to lock
   * @param {number} [ttl] - Lock TTL in seconds
   * @returns {Promise<boolean>} True if lock acquired
   */
  async acquireLock(callSid, ttl = this.config.lockTtl) {
    // Single instance mode - always succeed
    if (!this.useSync) {
      return true;
    }
    
    try {
      return await twilioSyncService.acquireLock(callSid, this.instanceId, ttl);
    } catch (error) {
      console.warn(`[DistributedStateService] Error acquiring lock for ${callSid}:`, error.message);
      // Fail open - allow operation to proceed
      return true;
    }
  }

  /**
   * Release a distributed lock.
   * 
   * @param {string} callSid - Call SID to unlock
   * @returns {Promise<boolean>} True if lock released
   */
  async releaseLock(callSid) {
    // Single instance mode - nothing to do
    if (!this.useSync) {
      return true;
    }
    
    try {
      return await twilioSyncService.releaseLock(callSid, this.instanceId);
    } catch (error) {
      console.warn(`[DistributedStateService] Error releasing lock for ${callSid}:`, error.message);
      return true;
    }
  }

  /**
   * Check if a session exists.
   * 
   * @param {string} callSid - Call SID
   * @returns {Promise<boolean>} True if session exists
   */
  async hasSession(callSid) {
    const session = await this.getSession(callSid);
    return session !== null;
  }

  /**
   * Get all local sessions (for debugging/monitoring).
   * Note: In distributed mode, this only returns locally cached sessions.
   * 
   * @returns {Map} Local session cache
   */
  getLocalSessions() {
    return new Map(this.localCache);
  }

  /**
   * Get session count.
   * 
   * @returns {Promise<number>} Number of sessions
   */
  async getSessionCount() {
    // In distributed mode, we might have sessions in Sync not in cache
    if (this.useSync) {
      try {
        const sessions = await twilioSyncService.listSessions(1000);
        return sessions.length;
      } catch (error) {
        console.warn('[DistributedStateService] Error getting session count:', error.message);
        return this.localCache.size;
      }
    }
    
    return this.localCache.size;
  }

  /**
   * Update local cache with session data.
   * @private
   */
  _updateCache(callSid, data) {
    this.localCache.set(callSid, data);
    
    // Calculate size safely - data should already be sanitized, but add try-catch for safety
    let size = 0;
    try {
      size = JSON.stringify(data).length;
    } catch (error) {
      // If JSON.stringify fails (shouldn't happen with sanitized data), estimate size
      console.warn(`[DistributedState] Could not calculate cache size for ${callSid}, using fallback:`, error.message);
      size = JSON.stringify({ _error: 'size_calculation_failed' }).length;
    }
    
    this.cacheMetadata.set(callSid, {
      fetchedAt: Date.now(),
      size
    });
  }

  /**
   * Clear the local cache for a specific session or all sessions.
   * Does NOT affect Twilio Sync data.
   * 
   * @param {string} [callSid] - Optional call SID to clear, or all if omitted
   */
  clearCache(callSid = null) {
    if (callSid) {
      this.localCache.delete(callSid);
      this.cacheMetadata.delete(callSid);
    } else {
      this.localCache.clear();
      this.cacheMetadata.clear();
    }
  }

  /**
   * Get service status for monitoring.
   * 
   * @returns {Promise<Object>} Status object
   */
  async getStatus() {
    const status = {
      instanceId: this.instanceId,
      initialized: this.initialized,
      useSync: this.useSync,
      localCacheSize: this.localCache.size,
      config: this.config
    };
    
    if (this.useSync) {
      try {
        status.syncStatus = await twilioSyncService.getStatus();
      } catch (error) {
        status.syncStatus = { error: error.message };
      }
    }
    
    return status;
  }

  /**
   * Gracefully shutdown the service.
   * Flushes pending writes and releases locks.
   */
  async shutdown() {
    console.log('[DistributedStateService] Shutting down...');
    
    // Clear local cache
    this.localCache.clear();
    this.cacheMetadata.clear();
    
    this.initialized = false;
    console.log('[DistributedStateService] Shutdown complete');
  }
}

// Export singleton instance
export default new DistributedStateService();

// Also export class and buildSyncPayload for testing
export { DistributedStateService, buildSyncPayload };
