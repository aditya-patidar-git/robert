/**
 * State Factory
 * Ensures consistent conversation state structure across all handlers
 */

/**
 * Create a standardized conversation state object
 * @param {string} callSid - Call SID identifier
 * @param {Object} options - Optional initial values
 * @returns {Object} Standardized conversation state
 */
export function createConversationState(callSid, options = {}) {
  const now = Date.now();
  
  return {
    callSid: callSid,
    transcript: options.transcript || [],
    from: options.from || null,
    to: options.to || null,
    language: options.language || 'en-GB',
    startTime: options.startTime || now,
    lastActivityTime: now, // For TTL tracking
    callType: options.callType || 'Twilio', // 'Twilio' | 'SIP'
    realtimeWs: options.realtimeWs || null,
    
    // Recording consent
    recordingConsent: options.recordingConsent || {
      requested: false,
      given: null,
      requestedAt: null,
      respondedAt: null
    },
    
    // Memory consent
    memoryConsent: options.memoryConsent || {
      requested: false,
      given: null,
      requestedAt: null,
      respondedAt: null
    },
    
    // Language preference
    waitingForLanguage: options.waitingForLanguage || false,
    languagePreferenceState: options.languagePreferenceState || {
      asked: false,
      selected: false,
      language: null,
      askedAt: null,
      selectedAt: null
    },
    
    // KBA (Knowledge-Based Authentication)
    kba: options.kba || {
      verified: false,
      method: null,
      verifiedAt: null,
      otpVerified: false,
      otpVerifiedAt: null,
      email: null,
      postcode: null,
      bookingReference: null
    },
    
    // Mobile search attempts
    mobileSearchAttempts: options.mobileSearchAttempts || {
      count: 0,
      lastAttempt: null,
      values: [],
      lastAttemptTime: null
    },
    
    // Verification attempts
    verificationAttempts: options.verificationAttempts || {
      fullName: 0,
      postcode: 0,
      telephoneNumber: 0
    },
    
    // Client details
    clientDetails: options.clientDetails || null,
    
    // Client verification
    clientVerified: options.clientVerified || false,
    clientVerifiedAt: options.clientVerifiedAt || null,
    verificationMethod: options.verificationMethod || null,
    
    // Booking consent
    bookingConsent: options.bookingConsent || {
      given: false,
      timestamp: null,
      dryRunDiff: null
    },
    
    // Policy check
    policyCheck: options.policyCheck || {
      performed: false,
      timestamp: null,
      results: null
    }
  };
}

/**
 * Merge existing state with updates, preserving structure
 * @param {Object} existingState - Current state object
 * @param {Object} updates - Updates to apply
 * @returns {Object} Merged state
 */
export function mergeConversationState(existingState, updates) {
  const merged = { ...existingState };
  
  // Update lastActivityTime on any change
  merged.lastActivityTime = Date.now();
  
  // Merge top-level fields
  Object.keys(updates).forEach(key => {
    if (key === 'recordingConsent' || key === 'memoryConsent' || key === 'kba' || 
        key === 'mobileSearchAttempts' || key === 'verificationAttempts' || 
        key === 'bookingConsent' || key === 'policyCheck' || key === 'languagePreferenceState') {
      // Deep merge for nested objects
      merged[key] = { ...merged[key], ...updates[key] };
    } else if (key === 'transcript') {
      // For transcript, append if array
      if (Array.isArray(updates[key])) {
        merged[key] = [...(merged[key] || []), ...updates[key]];
      } else {
        merged[key] = updates[key];
      }
    } else {
      merged[key] = updates[key];
    }
  });
  
  return merged;
}

/**
 * Validate state structure
 * @param {Object} state - State object to validate
 * @returns {boolean} True if valid
 */
export function validateConversationState(state) {
  if (!state || typeof state !== 'object') {
    return false;
  }
  
  // Check required fields
  const requiredFields = ['callSid', 'transcript', 'startTime', 'lastActivityTime'];
  for (const field of requiredFields) {
    if (!(field in state)) {
      console.warn(`⚠️ [STATE] Missing required field: ${field}`);
      return false;
    }
  }
  
  return true;
}

