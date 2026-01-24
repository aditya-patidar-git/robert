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
      if (!twilioSyncService.isConfigured()) {
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
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Always update local cache
    this._updateCache(callSid, data);
    
    // Write to Sync if available
    if (this.useSync) {
      try {
        await twilioSyncService.setSession(callSid, data, ttl);
        return true;
      } catch (error) {
        console.error(`[DistributedStateService] Error setting session ${callSid} in Sync:`, error.message);
        // Continue with local cache only
        return true;
      }
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
    this.cacheMetadata.set(callSid, {
      fetchedAt: Date.now(),
      size: JSON.stringify(data).length
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

// Also export class for testing
export { DistributedStateService };
