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
      // Update last activity
      this._syncBookingSession(callSid, (session) => {
        session.lastActivity = Date.now();
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
      throw new Error(`No booking session found for ${callSid}`);
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
      throw new Error(`No booking session found for ${callSid}`);
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
    // Note: pageRef is not serialized/synced (Playwright page objects can't be serialized)
    // Only update local state for this field
    const session = this.getSession(callSid);
    if (!session) {
      throw new Error(`No booking session found for ${callSid}`);
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
      throw new Error(`No booking session found for ${callSid}`);
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

