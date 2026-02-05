/**
 * Twilio Sync Service
 * Single responsibility: Handle all Twilio Sync I/O operations.
 * 
 * This service provides low-level CRUD operations for Twilio Sync Maps and Documents.
 * It does NOT contain business logic - that belongs in distributedStateService.
 * 
 * Twilio Sync Concepts:
 * - Sync Service: Container for all sync objects (one per environment)
 * - Sync Map: Key-value store for sessions (key = callSid)
 * - Sync Document: Single JSON object for shared config/state
 * - TTL: Automatic expiry on Map Items (session cleanup)
 * 
 * @module twilioSyncService
 */

import twilio from 'twilio';
import { isPlaceholder, validateTwilioSyncConfig, logValidationResult } from '../utils/configValidator.js';
import { isNetworkError } from '../utils/isRetryableError.js';

class TwilioSyncService {
  constructor() {
    this.client = null;
    this.syncServiceSid = null;
    this.sessionsMapSid = null;
    this.locksDocumentSid = null;
    this.initialized = false;
    this.initPromise = null;
    this.configValidated = false;
    
    // Configuration
    this.config = {
      sessionsMapName: 'call_sessions',
      locksDocumentName: 'active_locks',
      defaultTtl: parseInt(process.env.SYNC_SESSION_TTL, 10) || 3600 // 1 hour
    };
  }

  /**
   * Validate configuration and log warnings if placeholder detected.
   * Should be called during service initialization.
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    if (this.configValidated) {
      return this._lastValidationResult;
    }

    const result = validateTwilioSyncConfig(process.env);
    logValidationResult(result, 'Twilio Sync');
    
    this._lastValidationResult = result;
    this.configValidated = true;
    
    return result;
  }

  /**
   * Check if Twilio Sync is configured.
   * Now includes placeholder detection - returns false if SID is a placeholder.
   * @returns {boolean} True if Sync is properly configured
   */
  isConfigured() {
    // DEBUG: Extensive logging to trace configuration check
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const syncSid = process.env.TWILIO_SYNC_SERVICE_SID;
    
    const hasAccountSid = !!accountSid;
    const hasAuthToken = !!authToken;
    const hasSyncSid = !!syncSid;
    
    if (!hasAccountSid || !hasAuthToken || !hasSyncSid) {
      return false;
    }
    
    // Check for placeholder values
    const syncSidTrimmed = syncSid.trim();
    const placeholderCheck = isPlaceholder(syncSid);
    
    if (placeholderCheck) {
      // Log warning only once
      if (!this._placeholderWarningLogged) {
        console.warn(
          '⚠️ [TwilioSyncService] TWILIO_SYNC_SERVICE_SID appears to be a placeholder. ' +
          'Distributed state will be disabled. ' +
          'To enable, create a Twilio Sync Service at https://console.twilio.com/sync/services ' +
          'and update your .env file with the actual SID.'
        );
        this._placeholderWarningLogged = true;
      }
      return false;
    }
    
    return true;
  }

  /**
   * Initialize the Twilio Sync service.
   * Creates the Sync client and ensures required maps/documents exist.
   * 
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // Return immediately if already initialized
    if (this.initialized) {
      return true;
    }
    
    // Check if configured
    const configured = this.isConfigured();
    
    if (!configured) {
      return false;
    }
    
    // Create initialization promise
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
      console.log('[TwilioSyncService] Initializing...');
      
      // Validate configuration (logs warnings if placeholder detected)
      this.validateConfiguration();
      
      // Create Twilio client
      const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      this.client = twilio(accountSid, authToken);
      this.syncServiceSid = process.env.TWILIO_SYNC_SERVICE_SID;
      
      // Ensure sessions map exists
      this.sessionsMapSid = await this._ensureMapExists(this.config.sessionsMapName);
      
      // Ensure locks document exists
      this.locksDocumentSid = await this._ensureDocumentExists(this.config.locksDocumentName, {});
      
      this.initialized = true;
      console.log('[TwilioSyncService] Initialized successfully');
      console.log(`  - Sessions Map SID: ${this.sessionsMapSid}`);
      console.log(`  - Locks Document SID: ${this.locksDocumentSid}`);
      
      return true;
    } catch (error) {
      console.error('[TwilioSyncService] Initialization failed:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Ensure a Sync Map exists, creating it if necessary.
   * @private
   */
  async _ensureMapExists(uniqueName) {
    try {
      // Try to fetch existing map
      const maps = await this.client.sync.v1
        .services(this.syncServiceSid)
        .syncMaps.list({ limit: 50 });
      
      let map = maps.find(m => m.uniqueName === uniqueName);
      
      if (!map) {
        // Create new map
        map = await this.client.sync.v1
          .services(this.syncServiceSid)
          .syncMaps.create({ uniqueName });
        console.log(`[TwilioSyncService] Created Sync Map: ${uniqueName}`);
      }
      
      return map.sid;
    } catch (error) {
      console.error(`[TwilioSyncService] Error ensuring map ${uniqueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Ensure a Sync Document exists, creating it if necessary.
   * @private
   */
  async _ensureDocumentExists(uniqueName, initialData = {}) {
    try {
      // Try to fetch existing document
      const documents = await this.client.sync.v1
        .services(this.syncServiceSid)
        .documents.list({ limit: 50 });
      
      let doc = documents.find(d => d.uniqueName === uniqueName);
      
      if (!doc) {
        // Create new document
        doc = await this.client.sync.v1
          .services(this.syncServiceSid)
          .documents.create({ uniqueName, data: initialData });
        console.log(`[TwilioSyncService] Created Sync Document: ${uniqueName}`);
      }
      
      return doc.sid;
    } catch (error) {
      console.error(`[TwilioSyncService] Error ensuring document ${uniqueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a session from the sessions Sync Map.
   * 
   * @param {string} callSid - Call SID (map item key)
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async getSession(callSid) {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init) {
        return null;
      }
    }
    
    try {
      const item = await this.client.sync.v1
        .services(this.syncServiceSid)
        .syncMaps(this.sessionsMapSid)
        .syncMapItems(callSid)
        .fetch();
      
      return item.data;
    } catch (error) {
      // 20404 = Not Found - this is expected for new sessions
      if (error.code === 20404) {
        return null;
      }
      console.error(`[TwilioSync] Error getting session ${callSid}:`, error.message);
      throw error;
    }
  }

  /**
   * Set a session in the sessions Sync Map.
   * Creates or updates the session with automatic TTL.
   * 
   * @param {string} callSid - Call SID (map item key)
   * @param {Object} data - Session data
   * @param {number} [ttl] - Time-to-live in seconds (default from config)
   * @returns {Promise<boolean>} True if successful
   */
  async setSession(callSid, data, ttl = this.config.defaultTtl) {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init) return false;
    }
    
    try {
      // Try to update existing item
      await this.client.sync.v1
        .services(this.syncServiceSid)
        .syncMaps(this.sessionsMapSid)
        .syncMapItems(callSid)
        .update({ data, ttl });
      
      return true;
    } catch (error) {
      // 20404 = Not Found - create new item
      if (error.code === 20404) {
        try {
          await this.client.sync.v1
            .services(this.syncServiceSid)
            .syncMaps(this.sessionsMapSid)
            .syncMapItems.create({ key: callSid, data, ttl });

          return true;
        } catch (createError) {
          if (createError.code === 54208 || createError.status === 409) {
            try {
              await this.client.sync.v1
                .services(this.syncServiceSid)
                .syncMaps(this.sessionsMapSid)
                .syncMapItems(callSid)
                .update({ data, ttl });
              return true;
            } catch (updateErr) {
              if (isNetworkError(updateErr)) {
                console.warn(`[TwilioSyncService] Network error updating session ${callSid}:`, updateErr.message);
              } else {
                console.error(`[TwilioSyncService] Error updating session ${callSid}:`, updateErr.message);
              }
              throw updateErr;
            }
          }
          if (isNetworkError(createError)) {
            console.warn(`[TwilioSyncService] Network error creating session ${callSid}:`, createError.message);
          } else {
            console.error(`[TwilioSyncService] Error creating session ${callSid}:`, createError.message);
          }
          throw createError;
        }
      }
      
      if (isNetworkError(error)) {
        console.warn(`[TwilioSyncService] Network error setting session ${callSid}:`, error.message);
      } else {
        console.error(`[TwilioSyncService] Error setting session ${callSid}:`, error.message);
      }
      throw error;
    }
  }

  /**
   * Delete a session from the sessions Sync Map.
   * 
   * @param {string} callSid - Call SID (map item key)
   * @returns {Promise<boolean>} True if successful (or already deleted)
   */
  async deleteSession(callSid) {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init) return false;
    }
    
    try {
      await this.client.sync.v1
        .services(this.syncServiceSid)
        .syncMaps(this.sessionsMapSid)
        .syncMapItems(callSid)
        .remove();
      
      return true;
    } catch (error) {
      // 20404 = Not Found - already deleted, that's fine
      if (error.code === 20404) {
        return true;
      }
      console.error(`[TwilioSyncService] Error deleting session ${callSid}:`, error.message);
      throw error;
    }
  }

  /**
   * List all sessions (for debugging/admin purposes).
   * 
   * @param {number} [limit=100] - Maximum number of sessions to return
   * @returns {Promise<Array>} Array of session items
   */
  async listSessions(limit = 100) {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init) return [];
    }
    
    try {
      const items = await this.client.sync.v1
        .services(this.syncServiceSid)
        .syncMaps(this.sessionsMapSid)
        .syncMapItems.list({ limit });
      
      return items.map(item => ({
        key: item.key,
        data: item.data,
        dateCreated: item.dateCreated,
        dateUpdated: item.dateUpdated,
        dateExpires: item.dateExpires
      }));
    } catch (error) {
      console.error('[TwilioSyncService] Error listing sessions:', error.message);
      throw error;
    }
  }

  /**
   * Acquire a distributed lock for a call.
   * Uses the locks document with atomic updates.
   * 
   * @param {string} callSid - Call SID to lock
   * @param {string} instanceId - ID of the instance acquiring the lock
   * @param {number} [ttlSeconds=30] - Lock TTL in seconds
   * @returns {Promise<boolean>} True if lock acquired
   */
  async acquireLock(callSid, instanceId, ttlSeconds = 30) {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init) return true; // Fail open if not configured
    }
    
    try {
      // Get current locks
      const doc = await this.client.sync.v1
        .services(this.syncServiceSid)
        .documents(this.locksDocumentSid)
        .fetch();
      
      const locks = doc.data || {};
      const now = Date.now();
      const expiresAt = now + (ttlSeconds * 1000);
      
      // Check if lock exists and is still valid
      if (locks[callSid]) {
        const existingLock = locks[callSid];
        if (existingLock.expires > now && existingLock.instanceId !== instanceId) {
          // Lock is held by another instance and not expired
          return false;
        }
      }
      
      // Clean up expired locks and add new lock
      const cleanedLocks = {};
      for (const [key, lock] of Object.entries(locks)) {
        if (lock.expires > now) {
          cleanedLocks[key] = lock;
        }
      }
      cleanedLocks[callSid] = { instanceId, expires: expiresAt };
      
      // Update with revision check (atomic)
      await this.client.sync.v1
        .services(this.syncServiceSid)
        .documents(this.locksDocumentSid)
        .update({ data: cleanedLocks });
      
      return true;
    } catch (error) {
      // Conflict error means another instance updated the document
      if (error.code === 20409) {
        return false;
      }
      console.error(`[TwilioSyncService] Error acquiring lock for ${callSid}:`, error.message);
      return true; // Fail open on unexpected errors
    }
  }

  /**
   * Release a distributed lock for a call.
   * 
   * @param {string} callSid - Call SID to unlock
   * @param {string} instanceId - ID of the instance releasing the lock
   * @returns {Promise<boolean>} True if lock released
   */
  async releaseLock(callSid, instanceId) {
    if (!this.initialized) {
      return true;
    }
    
    try {
      const doc = await this.client.sync.v1
        .services(this.syncServiceSid)
        .documents(this.locksDocumentSid)
        .fetch();
      
      const locks = doc.data || {};
      
      // Only release if we own the lock
      if (locks[callSid] && locks[callSid].instanceId === instanceId) {
        delete locks[callSid];
        
        await this.client.sync.v1
          .services(this.syncServiceSid)
          .documents(this.locksDocumentSid)
          .update({ data: locks });
      }
      
      return true;
    } catch (error) {
      console.error(`[TwilioSyncService] Error releasing lock for ${callSid}:`, error.message);
      return true; // Don't fail on release errors
    }
  }

  /**
   * Get or create a generic Sync Document.
   * 
   * @param {string} uniqueName - Document unique name
   * @param {Object} [defaultData={}] - Default data if creating new document
   * @returns {Promise<Object|null>} Document data
   */
  async getDocument(uniqueName, defaultData = {}) {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init) return null;
    }
    
    try {
      const doc = await this.client.sync.v1
        .services(this.syncServiceSid)
        .documents(uniqueName)
        .fetch();
      
      return doc.data;
    } catch (error) {
      if (error.code === 20404) {
        // Create new document
        try {
          const doc = await this.client.sync.v1
            .services(this.syncServiceSid)
            .documents.create({ uniqueName, data: defaultData });
          
          return doc.data;
        } catch (createError) {
          console.error(`[TwilioSyncService] Error creating document ${uniqueName}:`, createError.message);
          throw createError;
        }
      }
      console.error(`[TwilioSyncService] Error getting document ${uniqueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Update a Sync Document.
   * 
   * @param {string} uniqueName - Document unique name
   * @param {Object} data - New data
   * @returns {Promise<boolean>} True if successful
   */
  async updateDocument(uniqueName, data) {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init) return false;
    }
    
    try {
      await this.client.sync.v1
        .services(this.syncServiceSid)
        .documents(uniqueName)
        .update({ data });
      
      return true;
    } catch (error) {
      console.error(`[TwilioSyncService] Error updating document ${uniqueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get the Sync Service status and statistics.
   * Useful for health checks and monitoring.
   * 
   * @returns {Promise<Object>} Service status
   */
  async getStatus() {
    if (!this.initialized) {
      return {
        configured: this.isConfigured(),
        initialized: false,
        error: 'Not initialized'
      };
    }
    
    try {
      const service = await this.client.sync.v1
        .services(this.syncServiceSid)
        .fetch();
      
      // Get session count
      const sessions = await this.client.sync.v1
        .services(this.syncServiceSid)
        .syncMaps(this.sessionsMapSid)
        .syncMapItems.list({ limit: 1 });
      
      return {
        configured: true,
        initialized: true,
        serviceSid: service.sid,
        friendlyName: service.friendlyName,
        sessionsMapSid: this.sessionsMapSid,
        locksDocumentSid: this.locksDocumentSid,
        sessionCount: sessions.length
      };
    } catch (error) {
      return {
        configured: this.isConfigured(),
        initialized: this.initialized,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new TwilioSyncService();

// Also export class for testing
export { TwilioSyncService };
