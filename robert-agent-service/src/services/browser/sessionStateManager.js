import { conversations, updateConversation } from '../../shared/state.js';

/**
 * Session State Manager
 * Manages browser session state per callSid for step-based booking tools
 * Stores state in conversations[callSid].bookingSession
 * 
 * All state mutations are automatically synced to Twilio Sync via updateConversation()
 * for distributed state management and horizontal scalability.
 */
class SessionStateManager {
  constructor() {
    // State structure stored in conversations[callSid].bookingSession:
    // {
    //   browserSessionId: string,
    //   currentStep: number | null,           // Booking workflow step
    //   cancellationCurrentStep: number | null, // Cancellation workflow step (separate so user can book then cancel in same call)
    //   workflowType: 'existing' | 'new' | null,
    //   courseType: string | null,
    //   knownPreferences: object,
    //   sessionDetails: object | null,
    //   bookingDetails: object | null,
    //   cancellationFee: number | null,
    //   pageRef: Page | null,
    //   lastActivity: number,
    //   stepHistory: Array<...>,              // Booking step audit trail
    //   cancellationStepHistory: Array<...>  // Cancellation step audit trail
    // }
  }

  /**
   * Initialize booking session for a call
   * @param {string} callSid - Call SID identifier
   * @param {string} courseType - Course type (ITM, CBT, etc.)
   * @returns {Object} Initialized session state
   */
  initializeSession(callSid, courseType) {
    if (!callSid) {
      throw new Error('callSid is required to initialize booking session');
    }

    // Ensure conversation exists
    if (!conversations[callSid]) {
      conversations[callSid] = {};
    }

    // Initialize booking session if it doesn't exist
    if (!conversations[callSid].bookingSession) {
      const newSession = {
        browserSessionId: `browser_${callSid}_${Date.now()}`,
        currentStep: null,
        cancellationCurrentStep: null,
        workflowType: null,
        workflowTypeAsked: false,
        courseType: courseType || null,
        knownPreferences: {},
        sessionDetails: null,
        bookingDetails: null,
        cancellationFee: null,
        pageRef: null,
        lastActivity: Date.now(),
        stepHistory: [],
        cancellationStepHistory: []
      };

      conversations[callSid].bookingSession = newSession;

      // Sync to Twilio Sync
      updateConversation(callSid, { bookingSession: newSession }).catch(error => {
        console.warn(`[SESSION] Failed to sync initial bookingSession to Twilio Sync for ${callSid}:`, error.message);
      });

      console.log(`✅ [SESSION] Initialized booking session for ${callSid} (course: ${courseType})`);
    } else {
      this._syncBookingSession(callSid, (session) => {
        session.lastActivity = Date.now();
        if (courseType != null && courseType !== 'TBD') {
          session.courseType = courseType;
        }
      });
    }

    return conversations[callSid].bookingSession;
  }

  /**
   * Get current step number for a call
   * @param {string} callSid - Call SID identifier
   * @returns {number|null} Current step number or null if not started
   */
  getCurrentStep(callSid) {
    const session = this.getSession(callSid);
    return session ? session.currentStep : null;
  }

  /**
   * Set current step number
   * @param {string} callSid - Call SID identifier
   * @param {number} step - Step number
   * @param {Object} result - Optional step result for history
   */
  setCurrentStep(callSid, step, result = null) {
    const session = this.getSession(callSid);
    if (!session) {
      console.warn(`[SESSION] setCurrentStep skipped — session already cleared for ${callSid} (call likely ended)`);
      return;
    }

    const previousStep = session.currentStep;

    this._syncBookingSession(callSid, (session) => {
      session.currentStep = step;

      // Add to step history
      session.stepHistory.push({
        step,
        previousStep,
        timestamp: Date.now(),
        result: result ? { success: result.success, error: result.error } : null
      });

      // Keep only last 50 steps in history
      if (session.stepHistory.length > 50) {
        session.stepHistory = session.stepHistory.slice(-50);
      }
    });

    console.log(`📊 [SESSION] ${callSid}: Step ${previousStep} → ${step}`);
  }

  getCancellationCurrentStep(callSid) {
    const session = this.getSession(callSid);
    return session && session.cancellationCurrentStep !== undefined ? session.cancellationCurrentStep : null;
  }

  setCancellationCurrentStep(callSid, step, result = null) {
    const session = this.getSession(callSid);
    if (!session) {
      console.warn(`[SESSION] setCancellationCurrentStep skipped — session already cleared for ${callSid} (call likely ended)`);
      return;
    }
    if (!session.cancellationStepHistory) {
      session.cancellationStepHistory = [];
    }
    const previousStep = session.cancellationCurrentStep ?? null;
    this._syncBookingSession(callSid, (s) => {
      s.cancellationCurrentStep = step;
      if (!s.cancellationStepHistory) s.cancellationStepHistory = [];
      s.cancellationStepHistory.push({
        step,
        previousStep,
        timestamp: Date.now(),
        result: result ? { success: result.success, error: result.error } : null
      });
      if (s.cancellationStepHistory.length > 50) {
        s.cancellationStepHistory = s.cancellationStepHistory.slice(-50);
      }
    });
    console.log(`📊 [SESSION] ${callSid}: Cancellation step ${previousStep} → ${step}`);
  }

  getCancellationStepHistory(callSid) {
    const session = this.getSession(callSid);
    return session?.cancellationStepHistory || [];
  }

  /**
   * Get known preferences
   * @param {string} callSid - Call SID identifier
   * @returns {Object} Known preferences object
   */
  getKnownPreferences(callSid) {
    const session = this.getSession(callSid);
    return session ? session.knownPreferences : {};
  }

  /**
   * Update known preferences
   * @param {string} callSid - Call SID identifier
   * @param {Object} preferences - Preferences to add/update
   */
  updatePreferences(callSid, preferences) {
    this._syncBookingSession(callSid, (session) => {
      session.knownPreferences = {
        ...session.knownPreferences,
        ...preferences
      };
    });

    console.log(`📝 [SESSION] ${callSid}: Updated preferences:`, Object.keys(preferences).join(', '));
  }

  /**
   * Clear specific preference keys from known preferences
   * @param {string} callSid - Call SID identifier
   * @param {string[]} keys - Preference keys to remove
   */
  clearPreferences(callSid, keys) {
    if (!keys || keys.length === 0) return;
    this._syncBookingSession(callSid, (session) => {
      if (session.knownPreferences) {
        for (const key of keys) {
          delete session.knownPreferences[key];
        }
      }
    });
    console.log(`🧹 [SESSION] ${callSid}: Cleared preferences:`, keys.join(', '));
  }

  /**
   * Get workflow type
   * @param {string} callSid - Call SID identifier
   * @returns {string|null} Workflow type ('existing', 'new', or null)
   */
  getWorkflowType(callSid) {
    const session = this.getSession(callSid);
    return session ? session.workflowType : null;
  }

  /**
   * Set workflow type
   * @param {string} callSid - Call SID identifier
   * @param {string} workflowType - 'existing' or 'new'
   */
  setWorkflowType(callSid, workflowType) {
    if (workflowType !== 'existing' && workflowType !== 'new') {
      throw new Error(`Invalid workflow type: ${workflowType}. Must be 'existing' or 'new'`);
    }

    this._syncBookingSession(callSid, (session) => {
      session.workflowType = workflowType;
      session.workflowTypeAsked = true; // Mark that Step 3 (workflow type question) has been asked
    });

    console.log(`🔄 [SESSION] ${callSid}: Workflow type set to ${workflowType} (Step 3 completed)`);
  }

  /**
   * Mark that Step 3 (workflow type question) has been asked
   * This is called when the agent asks the workflow type question conversationally
   * @param {string} callSid - Call SID identifier
   */
  markWorkflowTypeAsked(callSid) {
    this._syncBookingSession(callSid, (session) => {
      session.workflowTypeAsked = true;
    });

    console.log(`✅ [SESSION] ${callSid}: Step 3 (workflow type question) marked as asked`);
  }

  /**
   * Store the caller's trained-before hint derived from their verbal response.
   * @param {string} callSid
   * @param {'existing'|'new'} hint
   */
  setCallerTrainedBeforeHint(callSid, hint) {
    this._syncBookingSession(callSid, (session) => {
      session.callerTrainedBeforeHint = hint;
    });
    console.log(`🔍 [SESSION] ${callSid}: Caller trained-before hint stored: ${hint}`);
  }

  /**
   * Retrieve the stored trained-before hint (if any).
   * @param {string} callSid
   * @returns {'existing'|'new'|null}
   */
  getCallerTrainedBeforeHint(callSid) {
    const session = this.getSession(callSid);
    return session?.callerTrainedBeforeHint ?? null;
  }

  /**
   * Get course type
   * @param {string} callSid - Call SID identifier
   * @returns {string|null} Course type
   */
  getCourseType(callSid) {
    const session = this.getSession(callSid);
    return session ? session.courseType : null;
  }

  /**
   * Get session details (selected slot)
   * @param {string} callSid - Call SID identifier
   * @returns {Object|null} Session details
   */
  getSessionDetails(callSid) {
    const session = this.getSession(callSid);
    return session ? session.sessionDetails : null;
  }

  /**
   * Set session details (selected slot)
   * @param {string} callSid - Call SID identifier
   * @param {Object} sessionDetails - Session details
   */
  setSessionDetails(callSid, sessionDetails) {
    this._syncBookingSession(callSid, (session) => {
      session.sessionDetails = sessionDetails;
    });
  }

  /**
   * Draft args for new-client fill_contact_details (merged on each call).
   * Lets a follow-up with only addressConfirmed (or partial args) still complete survey + Next.
   */
  getPendingNewClientContactArgs(callSid) {
    const session = this.getSession(callSid);
    const d = session?.pendingNewClientContactArgs;
    return d && typeof d === 'object' ? { ...d } : null;
  }

  setPendingNewClientContactArgs(callSid, plainObject) {
    if (!callSid) return;
    this._syncBookingSession(callSid, (session) => {
      session.pendingNewClientContactArgs =
        plainObject && typeof plainObject === 'object' ? { ...plainObject } : {};
    });
  }

  clearPendingNewClientContactArgs(callSid) {
    if (!callSid) return;
    this._syncBookingSession(callSid, (session) => {
      delete session.pendingNewClientContactArgs;
    });
  }

  /**
   * Get booking details
   * @param {string} callSid - Call SID identifier
   * @returns {Object|null} Booking details
   */
  getBookingDetails(callSid) {
    const session = this.getSession(callSid);
    return session ? session.bookingDetails : null;
  }

  /**
   * Set booking details
   * @param {string} callSid - Call SID identifier
   * @param {Object} bookingDetails - Booking details
   */
  setBookingDetails(callSid, bookingDetails) {
    this._syncBookingSession(callSid, (session) => {
      session.bookingDetails = bookingDetails;
    });
  }

  getCancellationFee(callSid) {
    const session = this.getSession(callSid);
    return session?.cancellationFee ?? null;
  }

  setCancellationFee(callSid, fee) {
    this._syncBookingSession(callSid, (session) => {
      session.cancellationFee = fee;
    });
  }

  /**
   * Get browser page reference
   * @param {string} callSid - Call SID identifier
   * @returns {Object|null} Playwright page reference
   */
  getBrowserSession(callSid) {
    const session = this.getSession(callSid);
    return session ? session.pageRef : null;
  }

  /**
   * Set browser page reference
   * @param {string} callSid - Call SID identifier
   * @param {Object} pageRef - Playwright page reference
   */
  setBrowserSession(callSid, pageRef) {
    const session = this.getSession(callSid);
    if (!session) {
      console.warn(`[SESSION] setBrowserSession skipped — session already cleared for ${callSid} (call likely ended)`);
      return;
    }

    session.pageRef = pageRef;
    session.lastActivity = Date.now();
    // Don't sync pageRef - it's a local-only reference
  }

  /**
   * Internal helper: Sync bookingSession updates to Twilio Sync
   * Updates local state immediately and syncs to distributed state asynchronously
   * @private
   * @param {string} callSid - Call SID identifier
   * @param {Function} updater - Function that mutates the bookingSession object
   */
  _syncBookingSession(callSid, updater) {
    const session = this.getSession(callSid);
    if (!session) {
      console.warn(`[SESSION] _syncBookingSession skipped — session already cleared for ${callSid} (call likely ended)`);
      return;
    }

    // Update local state immediately (for fast reads)
    updater(session);
    session.lastActivity = Date.now();

    // Sync to Twilio Sync asynchronously (fire-and-forget for performance)
    // This ensures state is available across instances without blocking
    // CRITICAL: Exclude pageRef from sync (Playwright Page objects cannot be serialized)
    // Create a sanitized copy without pageRef for Twilio Sync
    const { pageRef, ...sessionForSync } = session;

    updateConversation(callSid, { bookingSession: sessionForSync }).catch(error => {
      console.warn(`[SESSION] Failed to sync bookingSession to Twilio Sync for ${callSid}:`, error.message);
    });
  }

  /**
   * Get full session object
   * @param {string} callSid - Call SID identifier
   * @returns {Object|null} Session object or null if not found
   */
  getSession(callSid) {
    if (!callSid || !conversations[callSid]) {
      return null;
    }
    return conversations[callSid].bookingSession || null;
  }

  /**
   * Clear booking session
   * @param {string} callSid - Call SID identifier
   */
  clearSession(callSid) {
    if (conversations[callSid] && conversations[callSid].bookingSession) {
      delete conversations[callSid].bookingSession;

      // Sync deletion to Twilio Sync
      updateConversation(callSid, { bookingSession: null }).catch(error => {
        console.warn(`[SESSION] Failed to sync bookingSession deletion to Twilio Sync for ${callSid}:`, error.message);
      });

      console.log(`🧹 [SESSION] Cleared booking session for ${callSid}`);
    }
  }

  /**
   * Check if session exists
   * @param {string} callSid - Call SID identifier
   * @returns {boolean} True if session exists
   */
  hasSession(callSid) {
    return this.getSession(callSid) !== null;
  }

  // ========== CLIENT SEARCH RETRY ESCALATION ==========

  /**
   * Initialize or get client search retry state for escalation tracking
   * @param {string} callSid - Call SID identifier
   * @returns {Object} Current search retry state
   */
  initializeSearchRetryState(callSid) {
    if (!conversations[callSid]) {
      conversations[callSid] = {};
    }
    if (!conversations[callSid].searchRetryState) {
      conversations[callSid].searchRetryState = {
        attempt: 0,
        currentStrategy: 'mobile',
        strategiesUsed: [],
        lastSearchValue: null,
        found: false
      };
    }
    return conversations[callSid].searchRetryState;
  }

  /**
   * Increment search attempt and return escalation guidance
   * Escalation order per documentation:
   *   Attempts 1-2: repeat/alternate mobile number
   *   Attempt 3:    switch to full email address
   *   Attempt 4:    switch to name fragment (first 3 + last 3 letters)
   *   Attempt 5+:   max reached — offer new client or transfer
   * @param {string} callSid - Call SID identifier
   * @returns {Object} { attempt, currentStrategy, nextStrategy, maxReached, message }
   */
  incrementSearchAttempt(callSid) {
    const state = this.initializeSearchRetryState(callSid);
    state.attempt += 1;

    const attempt = state.attempt;
    let nextStrategy = state.currentStrategy;
    let message = '';
    let maxReached = false;

    if (attempt <= 2) {
      nextStrategy = 'mobile';
      message = attempt === 1
        ? 'Could you please repeat your mobile number for me?'
        : 'Do you have an alternative mobile number we could try?';
    } else if (attempt === 3) {
      nextStrategy = 'email';
      message = 'Could you provide your full email address so I can search using that instead?';
    } else if (attempt === 4) {
      nextStrategy = 'name';
      message = 'Could you please spell out the first three letters of your first name and the first three letters of your surname?';
    } else {
      maxReached = true;
      nextStrategy = null;
      message = 'I have been unable to locate your profile. Would you like me to create a new profile for you, or would you prefer to be transferred to a team member for further assistance?';
    }

    if (!state.strategiesUsed.includes(nextStrategy) && nextStrategy) {
      state.strategiesUsed.push(nextStrategy);
    }
    state.currentStrategy = nextStrategy;

    // Sync to distributed state
    updateConversation(callSid, { searchRetryState: state }).catch(error => {
      console.warn(`[SESSION] Failed to sync searchRetryState for ${callSid}:`, error.message);
    });

    console.log(`🔄 [SESSION] ${callSid}: Search attempt ${attempt}, strategy: ${nextStrategy || 'MAX_REACHED'}`);

    return {
      attempt,
      currentStrategy: nextStrategy,
      nextStrategy,
      maxReached,
      message
    };
  }

  /**
   * Get current search retry state
   * @param {string} callSid - Call SID identifier
   * @returns {Object|null} Search retry state or null
   */
  getSearchRetryState(callSid) {
    return conversations[callSid]?.searchRetryState || null;
  }

  /**
   * Reset search retry state (called on successful client find)
   * @param {string} callSid - Call SID identifier
   */
  resetSearchRetryState(callSid) {
    if (conversations[callSid]?.searchRetryState) {
      conversations[callSid].searchRetryState.found = true;

      // Sync reset to distributed state
      updateConversation(callSid, { searchRetryState: conversations[callSid].searchRetryState }).catch(error => {
        console.warn(`[SESSION] Failed to sync searchRetryState reset for ${callSid}:`, error.message);
      });

      console.log(`✅ [SESSION] ${callSid}: Search retry state - client found`);
    }
  }

  // ========== END CLIENT SEARCH RETRY ESCALATION ==========

  // ========== LOOKUP CONTACT RETRY ESCALATION (Step 8 – same order: mobile → email → name) ==========

  initializeLookupRetryState(callSid) {
    if (!conversations[callSid]) {
      conversations[callSid] = {};
    }
    if (!conversations[callSid].lookupRetryState) {
      conversations[callSid].lookupRetryState = {
        attempt: 0,
        currentStrategy: 'mobile',
        strategiesUsed: [],
        lastSearchValue: null,
        found: false
      };
    }
    return conversations[callSid].lookupRetryState;
  }

  incrementLookupAttempt(callSid) {
    const state = this.initializeLookupRetryState(callSid);
    state.attempt += 1;

    const attempt = state.attempt;
    let nextStrategy = state.currentStrategy;
    let message = '';
    let maxReached = false;

    if (attempt <= 2) {
      nextStrategy = 'mobile';
      message = attempt === 1
        ? 'Could you please repeat your mobile number for me?'
        : 'Do you have an alternative mobile number we could try?';
    } else if (attempt === 3) {
      nextStrategy = 'email';
      message = 'Could you provide your full email address so I can search using that instead?';
    } else if (attempt === 4) {
      nextStrategy = 'name';
      message = 'Could you please spell out the first three letters of your first name and the first three letters of your surname?';
    } else {
      maxReached = true;
      nextStrategy = null;
      message = 'I have been unable to locate your profile. Would you like me to create a new profile for you, or would you prefer to be transferred to a team member for further assistance?';
    }

    if (!state.strategiesUsed.includes(nextStrategy) && nextStrategy) {
      state.strategiesUsed.push(nextStrategy);
    }
    state.currentStrategy = nextStrategy;

    updateConversation(callSid, { lookupRetryState: state }).catch(error => {
      console.warn(`[SESSION] Failed to sync lookupRetryState for ${callSid}:`, error.message);
    });

    console.log(`🔄 [SESSION] ${callSid}: Lookup attempt ${attempt}, strategy: ${nextStrategy || 'MAX_REACHED'}`);

    return {
      attempt,
      currentStrategy: nextStrategy,
      nextStrategy,
      maxReached,
      message
    };
  }

  getLookupRetryState(callSid) {
    return conversations[callSid]?.lookupRetryState || null;
  }

  resetLookupRetryState(callSid) {
    if (conversations[callSid]?.lookupRetryState) {
      conversations[callSid].lookupRetryState.found = true;

      updateConversation(callSid, { lookupRetryState: conversations[callSid].lookupRetryState }).catch(error => {
        console.warn(`[SESSION] Failed to sync lookupRetryState reset for ${callSid}:`, error.message);
      });

      console.log(`✅ [SESSION] ${callSid}: Lookup retry state - contact found`);
    }
  }

  // ========== END LOOKUP CONTACT RETRY ESCALATION ==========

  /**
   * Get step history for debugging
   * @param {string} callSid - Call SID identifier
   * @returns {Array} Step history array
   */
  getStepHistory(callSid) {
    const session = this.getSession(callSid);
    return session ? session.stepHistory : [];
  }
}

// Export singleton instance
export default new SessionStateManager();

