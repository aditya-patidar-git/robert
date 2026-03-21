/**
 * Shared State Module
 * Provides both synchronous in-memory access and async distributed state access.
 * 
 * For horizontal scalability, use the async methods (getConversation, setConversation, etc.)
 * which leverage Twilio Sync for distributed state when configured.
 * 
 * The direct exports (conversations, realtimeClients) are maintained for backward
 * compatibility but only provide local instance state.
 * 
 * @module shared/state
 */

import distributedStateService from '../services/distributedStateService.js';
import { sanitizeForJSON } from '../utils/objectUtils.js';

// ============================================================================
// LEGACY EXPORTS - Direct object access (local instance only)
// ============================================================================

/**
 * In-memory conversation storage (local instance only).
 * For horizontal scalability, prefer getConversation/setConversation which use distributed state when configured.
 */
export const conversations = {}; // in-memory storage (backward compatible)
// Structure: {
//   [callSid]: {
//     transcript: [],
//     bargeInFlushedGraceText: String|undefined, // speech-continuation buffer flushed on barge-in; merged into next user turn once
//     prematureResponses: {},  // { bikeType: { responseText, storedAt, expectedTool } } - user responses to premature questions
//     from: String,
//     to: String,
//     language: String,
//     recordingConsent: {
//       requested: Boolean,
//       given: Boolean|null,
//       requestedAt: Date,
//       respondedAt: Date
//     },
//     memoryConsent: {
//       requested: Boolean,
//       given: Boolean|null,
//       requestedAt: Date,
//       respondedAt: Date
//     },
//     kba: {
//       verified: Boolean,
//       method: String, // 'email_postcode_bookingref' or 'email_postcode_bookingref_otp'
//       verifiedAt: Date,
//       otpVerified: Boolean,
//       otpVerifiedAt: Date,
//       email: String,
//       postcode: String,
//       bookingReference: String
//     },
//     mobileSearchAttempts: {
//       count: Number, // 0-3 attempts
//       lastAttempt: String|null, // Last mobile number attempted
//       values: Array<String>, // Array of mobile numbers attempted
//       lastAttemptTime: Date|null
//     },
//     verificationAttempts: {
//       fullName: Number, // 0-7 attempts per field
//       postcode: Number,
//       telephoneNumber: Number
//     },
//     clientDetails: {
//       fullName: String,
//       postcode: String,
//       telephoneNumber: String,
//       email: String
//     },
//     clientVerified: Boolean,
//     clientVerifiedAt: Date|null,
//     verificationMethod: String|null, // 'fullName_postcode_telephone'
//     bookingConsent: {
//       given: Boolean,
//       timestamp: Date|null,
//       dryRunDiff: Object|null // { date, time, centre, fees, policyNotes }
//     },
//     policyCheck: {
//       performed: Boolean,
//       timestamp: Date|null,
//       results: Object|null // Policy summary from KB
//     }
//   }
// }

/**
 * Store active Realtime API connections (local instance only).
 * WebSocket connections cannot be distributed, so this remains local.
 */
export const realtimeClients = {}; // Store active Realtime API connections

// ============================================================================
// DISTRIBUTED STATE METHODS - Use these for horizontal scalability
// ============================================================================

/**
 * Initialize the distributed state system.
 * Call this on server startup to enable distributed state.
 * 
 * @returns {Promise<boolean>} True if distributed mode enabled
 */
export async function initializeDistributedState() {
  try {
    const result = await distributedStateService.initialize();
    console.log(`[State] Distributed state initialized: ${result ? 'enabled' : 'in-memory only'}`);
    return result;
  } catch (error) {
    console.error('[State] Failed to initialize distributed state:', error.message);
    return false;
  }
}

/**
 * Get a conversation by call SID.
 * Uses distributed state when available, falls back to local memory.
 * 
 * @param {string} callSid - Call SID
 * @returns {Promise<Object|null>} Conversation data or null
 */
export async function getConversation(callSid) {
  const localConversation = conversations[callSid];
  const localPageRef = localConversation?.bookingSession?.pageRef;

  try {
    const distributed = await distributedStateService.getSession(callSid);
    if (distributed) {
      const merged = { ...distributed };

      if (localPageRef && distributed.bookingSession) {
        merged.bookingSession = {
          ...distributed.bookingSession,
          pageRef: localPageRef
        };
      } else if (localPageRef && localConversation?.bookingSession) {
        merged.bookingSession = {
          ...localConversation.bookingSession,
          ...distributed.bookingSession
        };
      }

      merged.workflowContext = localConversation?.workflowContext ?? distributed?.workflowContext;

      // Sync stores a compact lastAvailabilityCheck (no allSlots). Preserve local full data when present.
      if (localConversation?.lastAvailabilityCheck?.allSlots != null && !Array.isArray(distributed?.lastAvailabilityCheck?.allSlots)) {
        merged.lastAvailabilityCheck = localConversation.lastAvailabilityCheck;
      }

      conversations[callSid] = merged;
      return merged;
    }
  } catch (error) {
    console.warn(`[State] Error getting distributed conversation ${callSid}:`, error.message);
  }

  return conversations[callSid] || null;
}

/**
 * Set a conversation.
 * Writes to both local memory and distributed state.
 * 
 * @param {string} callSid - Call SID
 * @param {Object} data - Conversation data
 * @param {number} [ttl] - Time-to-live in seconds (for distributed state)
 * @returns {Promise<boolean>} True if successful
 */
export async function setConversation(callSid, data, ttl = undefined) {
  // Always update local memory (keep original data with all objects)
  conversations[callSid] = data;
  
  // Also update distributed state (sanitization happens in distributedStateService.setSession())
  try {
    await distributedStateService.setSession(callSid, data, ttl);
  } catch (error) {
    console.warn(`[State] Error setting distributed conversation ${callSid}:`, error.message);
  }
  
  return true;
}

/**
 * Update specific fields in a conversation.
 * 
 * @param {string} callSid - Call SID
 * @param {Object} updates - Fields to update
 * @param {number} [ttl] - Time-to-live in seconds
 * @returns {Promise<boolean>} True if successful
 */
export async function updateConversation(callSid, updates, ttl = undefined) {
  const local = conversations[callSid];
  const localPageRef = local?.bookingSession?.pageRef;
  const localClientDetails = local?.clientDetails;
  const localClientVerified = local?.clientVerified;
  const localClientVerifiedAt = local?.clientVerifiedAt;
  const localVerificationMethod = local?.verificationMethod;
  const localVerificationState = local?.verificationState;

  // When we're writing bookingSession (e.g. cancellation step update), use local as base so
  // we don't overwrite with stale Sync data. For other updates, use local as base when it exists
  // so partial updates (e.g. searchRetryState, lookupRetryState) never overwrite in-memory
  // workflow/session state with stale Sync data—important for barge-in resume and multi-call correctness.
  const existing = updates.bookingSession != null
    ? (local || {})
    : (local != null ? local : (await getConversation(callSid) || {}));
  const merged = {
    ...existing,
    ...updates,
    _lastUpdated: new Date().toISOString()
  };

  if (merged.bookingSession && localPageRef) {
    merged.bookingSession.pageRef = localPageRef;
  }
  if (localClientDetails) {
    merged.clientDetails = localClientDetails;
  }
  if (localClientVerified !== undefined) {
    merged.clientVerified = localClientVerified;
  }
  if (localClientVerifiedAt != null) {
    merged.clientVerifiedAt = localClientVerifiedAt;
  }
  if (localVerificationMethod != null) {
    merged.verificationMethod = localVerificationMethod;
  }
  if (localVerificationState != null && typeof localVerificationState === 'object') {
    merged.verificationState = localVerificationState;
  }
  merged.workflowContext = local?.workflowContext ?? merged.workflowContext;

  return setConversation(callSid, merged, ttl);
}

/**
 * Delete a conversation.
 * Removes from both local memory and distributed state.
 * 
 * @param {string} callSid - Call SID
 * @returns {Promise<boolean>} True if successful
 */
export async function deleteConversation(callSid) {
  // Remove from local memory
  delete conversations[callSid];
  
  // Remove from distributed state
  try {
    await distributedStateService.deleteSession(callSid);
  } catch (error) {
    console.warn(`[State] Error deleting distributed conversation ${callSid}:`, error.message);
  }
  
  return true;
}

/**
 * Check if a conversation exists.
 * 
 * @param {string} callSid - Call SID
 * @returns {Promise<boolean>} True if exists
 */
export async function hasConversation(callSid) {
  // Check local first (fast)
  if (conversations[callSid]) {
    return true;
  }
  
  // Check distributed
  try {
    return await distributedStateService.hasSession(callSid);
  } catch (error) {
    return false;
  }
}

/**
 * Acquire a distributed lock for a call.
 * Use this before making changes that require exclusive access.
 * 
 * @param {string} callSid - Call SID to lock
 * @param {number} [ttl] - Lock TTL in seconds (default: 30)
 * @returns {Promise<boolean>} True if lock acquired
 */
export async function acquireLock(callSid, ttl = 30) {
  return distributedStateService.acquireLock(callSid, ttl);
}

/**
 * Release a distributed lock.
 * 
 * @param {string} callSid - Call SID to unlock
 * @returns {Promise<boolean>} True if released
 */
export async function releaseLock(callSid) {
  return distributedStateService.releaseLock(callSid);
}

/**
 * Get state system status for monitoring.
 * 
 * @returns {Promise<Object>} Status object
 */
export async function getStateStatus() {
  const distributedStatus = await distributedStateService.getStatus();
  
  return {
    localConversationCount: Object.keys(conversations).length,
    localRealtimeClientCount: Object.keys(realtimeClients).length,
    distributed: distributedStatus
  };
}

/**
 * Sync a local conversation to distributed state.
 * Useful after modifying the local `conversations` object directly.
 * 
 * @param {string} callSid - Call SID to sync
 * @returns {Promise<boolean>} True if synced
 */
export async function syncToDistributed(callSid) {
  const localData = conversations[callSid];
  if (!localData) {
    return false;
  }
  
  try {
    // Sanitize data before syncing to ensure JSON serialization works
    const sanitizedData = sanitizeForJSON(localData);
    await distributedStateService.setSession(callSid, sanitizedData);
    return true;
  } catch (error) {
    console.warn(`[State] Error syncing conversation ${callSid}:`, error.message);
    return false;
  }
}

/**
 * Sync from distributed state to local memory.
 * Useful for warming the local cache.
 * 
 * @param {string} callSid - Call SID to sync
 * @returns {Promise<boolean>} True if synced
 */
export async function syncFromDistributed(callSid) {
  try {
    const distributed = await distributedStateService.getSession(callSid);
    if (distributed) {
      conversations[callSid] = distributed;
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[State] Error syncing from distributed ${callSid}:`, error.message);
    return false;
  }
}
