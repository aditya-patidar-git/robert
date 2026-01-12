/**
 * Conversation State Accessor
 * Provides safe access to conversation state with null checks
 * Prevents undefined access errors when conversation is cleaned up
 */

import { conversations } from './state.js';

/**
 * Safely get conversation state for a call
 * @param {string} callSid - Call SID identifier
 * @returns {Object|null} Conversation state or null if not found/cleaned up
 */
export function getConversationState(callSid) {
  if (!callSid) {
    return null;
  }
  
  const conversation = conversations[callSid];
  if (!conversation) {
    return null;
  }
  
  return conversation;
}

/**
 * Safely get recording consent state
 * @param {string} callSid - Call SID identifier
 * @returns {Object|null} Recording consent state or null if conversation doesn't exist
 */
export function getRecordingConsent(callSid) {
  const conversation = getConversationState(callSid);
  if (!conversation) {
    return null;
  }
  
  // Ensure recordingConsent exists
  if (!conversation.recordingConsent) {
    conversation.recordingConsent = {
      requested: false,
      given: null,
      requestedAt: null,
      respondedAt: null
    };
  }
  
  return conversation.recordingConsent;
}

/**
 * Safely update recording consent
 * @param {string} callSid - Call SID identifier
 * @param {Object} updates - Updates to apply
 * @returns {boolean} True if update was successful, false if conversation doesn't exist
 */
export function updateRecordingConsent(callSid, updates) {
  const consent = getRecordingConsent(callSid);
  if (!consent) {
    return false;
  }
  
  Object.assign(consent, updates);
  return true;
}

/**
 * Check if conversation exists and is active
 * @param {string} callSid - Call SID identifier
 * @returns {boolean} True if conversation exists
 */
export function conversationExists(callSid) {
  return !!getConversationState(callSid);
}

