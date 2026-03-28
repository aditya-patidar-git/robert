/**
 * Slot Storage Utilities
 * Reusable functions for matching and storing selected slots
 */

import sessionStateManager from '../browser/sessionStateManager.js';
import { conversations } from '../../shared/state.js';

/**
 * Match a user-selected slot to one of the available slots
 * @param {Object} selectedSlot - Slot selected by user (may be partial)
 * @param {Array} allSlots - Array of all available slots from availability check
 * @returns {Object|null} Matched slot object or null if no match
 */
export function matchSlotToAvailableSlots(selectedSlot, allSlots) {
  if (!selectedSlot || !allSlots || !Array.isArray(allSlots) || allSlots.length === 0) {
    return null;
  }

  // Try to find matching slot in allSlots
  const matchingSlot = allSlots.find(slot => {
    // Match by date (flexible matching)
    const slotDate = slot.startDate || slot.date;
    const selectedDate = selectedSlot.startDate || selectedSlot.date;
    const dateMatch = !selectedDate || !slotDate || 
      slotDate === selectedDate || 
      slotDate.includes(selectedDate) || 
      selectedDate.includes(slotDate) ||
      (slot.date && selectedSlot.date && slot.date.toLowerCase().includes(selectedSlot.date.toLowerCase()));
    
    // Match by time (flexible matching)
    const slotTime = slot.time?.replace(/\s*(am|pm)\s*/gi, '').trim().toLowerCase();
    const selectedTime = selectedSlot.time?.replace(/\s*(am|pm)\s*/gi, '').trim().toLowerCase();
    const timeMatch = !selectedTime || !slotTime || 
      slotTime === selectedTime || 
      slotTime.includes(selectedTime) || 
      selectedTime.includes(slotTime);
    
    // Match by location (flexible matching)
    const slotLocation = slot.location?.toLowerCase().trim();
    const selectedLocation = selectedSlot.location?.toLowerCase().trim();
    const locationMatch = !selectedLocation || !slotLocation || 
      slotLocation === selectedLocation || 
      slotLocation.includes(selectedLocation) || 
      selectedLocation.includes(slotLocation);
    
    // Match if at least date matches, and time/location match if provided
    return dateMatch && (!selectedTime || timeMatch) && (!selectedLocation || locationMatch);
  });

  return matchingSlot || null;
}

/**
 * Recover a concrete slot when selectedSlot/sessionDetails were never written (e.g. model skipped agreedSlot)
 * but availability left exactly one option in allSlots or slotsToAnnounce.
 * Also returns already-stored slot/sessionDetails from conversation or sessionStateManager if present.
 *
 * @param {string} callSid
 * @returns {Object|null} Usable slot object, or null if ambiguous or nothing to recover
 */
export function rehydrateSessionDetailsFromLastAvailability(callSid) {
  if (!callSid) return null;
  if (!conversations[callSid]) return null;

  const fromManager = sessionStateManager.getSessionDetails(callSid);
  if (fromManager && typeof fromManager === 'object') {
    return fromManager;
  }

  const lac = conversations[callSid].lastAvailabilityCheck;
  if (!lac || typeof lac !== 'object') return null;

  const existing = lac.selectedSlot || lac.sessionDetails;
  if (existing && typeof existing === 'object') {
    return existing;
  }

  const allSlots = Array.isArray(lac.allSlots) ? lac.allSlots : [];
  const announce = Array.isArray(lac.slotsToAnnounce) ? lac.slotsToAnnounce : [];

  let candidate = null;
  if (allSlots.length === 1) {
    candidate = allSlots[0];
  } else if (announce.length === 1) {
    candidate = announce[0];
  }

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  try {
    return storeSelectedSlot(callSid, candidate, allSlots.length ? allSlots : null);
  } catch (e) {
    console.warn(`⚠️ [${callSid}] rehydrateSessionDetailsFromLastAvailability: storeSelectedSlot failed (${e.message}) — persisting to conversation only`);
    if (!conversations[callSid].lastAvailabilityCheck) {
      conversations[callSid].lastAvailabilityCheck = {};
    }
    conversations[callSid].lastAvailabilityCheck.selectedSlot = candidate;
    conversations[callSid].lastAvailabilityCheck.sessionDetails = candidate;
    return candidate;
  }
}

/**
 * Store selected slot in conversation and session state
 * @param {string} callSid - Call SID identifier
 * @param {Object} selectedSlot - Slot selected by user
 * @param {Array} allSlots - Optional array of all available slots for matching
 * @returns {Object} The stored slot (matched or original)
 */
export function storeSelectedSlot(callSid, selectedSlot, allSlots = null) {
  if (!callSid || !selectedSlot) {
    throw new Error('callSid and selectedSlot are required');
  }

  // Ensure conversation exists
  if (!conversations[callSid]) {
    conversations[callSid] = {};
  }
  if (!conversations[callSid].lastAvailabilityCheck) {
    conversations[callSid].lastAvailabilityCheck = {};
  }

  // Get allSlots from conversation if not provided
  if (!allSlots && conversations[callSid].lastAvailabilityCheck.allSlots) {
    allSlots = conversations[callSid].lastAvailabilityCheck.allSlots;
  }

  // Match the selected slot to one of the allSlots if available
  let matchedSlot = selectedSlot;
  if (allSlots && Array.isArray(allSlots) && allSlots.length > 0) {
    const matchingSlot = matchSlotToAvailableSlots(selectedSlot, allSlots);
    if (matchingSlot) {
      matchedSlot = matchingSlot;
      console.log(`✅ [${callSid}] Matched user-selected slot to allSlots:`, {
        date: matchingSlot.date,
        time: matchingSlot.time,
        location: matchingSlot.location
      });
    } else {
      console.log(`⚠️ [${callSid}] User-selected slot not found in allSlots, storing provided slot:`, {
        date: selectedSlot.date,
        time: selectedSlot.time,
        location: selectedSlot.location
      });
    }
  }

  // Store the matched/provided slot
  conversations[callSid].lastAvailabilityCheck.selectedSlot = matchedSlot;
  conversations[callSid].lastAvailabilityCheck.sessionDetails = matchedSlot;
  sessionStateManager.setSessionDetails(callSid, matchedSlot);
  
  console.log(`✅ [${callSid}] Stored selectedSlot in conversation.lastAvailabilityCheck and sessionStateManager:`, {
    date: matchedSlot.date,
    time: matchedSlot.time,
    location: matchedSlot.location,
    instructor: matchedSlot.instructor || 'N/A'
  });

  return matchedSlot;
}

/**
 * Store preferences before availability check
 * @param {string} callSid - Call SID identifier
 * @param {Object} preferences - Preferences object {preferredDate, preferredTime, location, instructor}
 */
export function storePreferencesBeforeAvailabilityCheck(callSid, preferences) {
  if (!callSid || !preferences) {
    return;
  }

  // Remove undefined values
  const cleanPreferences = {};
  Object.keys(preferences).forEach(key => {
    if (preferences[key] !== undefined && preferences[key] !== null) {
      cleanPreferences[key] = preferences[key];
    }
  });

  if (Object.keys(cleanPreferences).length > 0) {
    sessionStateManager.updatePreferences(callSid, cleanPreferences);
    console.log(`✅ [${callSid}] Stored preferences BEFORE Step 1:`, cleanPreferences);
  }
}

