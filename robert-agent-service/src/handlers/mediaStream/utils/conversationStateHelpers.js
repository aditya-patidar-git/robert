/**
 * Conversation State Helpers
 * 
 * Reusable functions for checking conversation state to avoid duplication.
 * Single responsibility: Provide state checking utilities.
 */

import { conversations } from '../../../shared/state.js';

/**
 * Get language preference state for a call
 * @param {string} callSid - Call SID
 * @param {Object} stateManager - State manager instance (optional, for fallback)
 * @returns {Object} { waitingForLanguage, languageSelected }
 */
export function getLanguagePreferenceState(callSid, stateManager = null) {
  const conversation = conversations[callSid];
  const waitingForLanguage = conversation?.waitingForLanguage || stateManager?.waitingForLanguage || false;
  const languageSelected = conversation?.languagePreferenceState?.selected || stateManager?.languagePreferenceState?.selected || false;
  
  return { waitingForLanguage, languageSelected };
}

/**
 * Get consent state for a call
 * @param {string} callSid - Call SID
 * @param {Object} stateManager - State manager instance (optional, for fallback)
 * @returns {Object} { consentRequested, consentGiven, consentResponded }
 */
export function getConsentState(callSid, stateManager = null) {
  const conversation = conversations[callSid];
  const given = conversation?.recordingConsent?.given ?? stateManager?.recordingConsentState?.given ?? null;
  const consentRequested = conversation?.recordingConsent?.requested || stateManager?.recordingConsentState?.requested || false;
  const consentGiven = given === true;
  // consentResponded: caller has answered the consent question (yes or no) — flow can proceed either way
  const consentResponded = given === true || given === false;
  
  return { consentRequested, consentGiven, consentResponded };
}

/**
 * Get combined conversation flow state
 * @param {string} callSid - Call SID
 * @param {Object} stateManager - State manager instance (optional, for fallback)
 * @returns {Object} Combined state object
 */
export function getConversationFlowState(callSid, stateManager = null) {
  const languageState = getLanguagePreferenceState(callSid, stateManager);
  const consentState = getConsentState(callSid, stateManager);
  
  return {
    ...languageState,
    ...consentState
  };
}
