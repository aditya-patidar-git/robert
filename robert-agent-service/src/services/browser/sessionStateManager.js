import { conversations } from '../../shared/state.js';

/**
 * Session State Manager
 * Manages browser session state per callSid for step-based booking tools
 * Stores state in conversations[callSid].bookingSession
 */
class SessionStateManager {
  constructor() {
    // State structure stored in conversations[callSid].bookingSession:
    // {
    //   browserSessionId: string,        // Unique ID for browser session
    //   currentStep: number | null,      // Current step number (null = not started)
    //   workflowType: 'existing' | 'new' | null,  // Determined workflow type
    //   courseType: string | null,       // Course type (ITM, CBT, etc.)
    //   knownPreferences: object,        // Collected preferences (bikeType, etc.)
    //   sessionDetails: object | null,   // Selected slot/session details
    //   pageRef: Page | null,            // Playwright page reference (not serialized)
    //   lastActivity: number,            // Timestamp of last activity
    //   stepHistory: Array<{step, timestamp, result}> // Audit trail
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
      conversations[callSid].bookingSession = {
        browserSessionId: `browser_${callSid}_${Date.now()}`,
        currentStep: null,
        workflowType: null,
        workflowTypeAsked: false, // Track if Step 3 (workflow type question) has been asked
        courseType: courseType || null,
        knownPreferences: {},
        sessionDetails: null,
        pageRef: null, // Will be set when browser page is available
        lastActivity: Date.now(),
        stepHistory: []
      };
      
      console.log(`✅ [SESSION] Initialized booking session for ${callSid} (course: ${courseType})`);
    } else {
      // Update last activity
      conversations[callSid].bookingSession.lastActivity = Date.now();
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
    session.currentStep = step;
    session.lastActivity = Date.now();

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

    console.log(`📊 [SESSION] ${callSid}: Step ${previousStep} → ${step}`);
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
    const session = this.getSession(callSid);
    if (!session) {
      throw new Error(`No booking session found for ${callSid}`);
    }

    session.knownPreferences = {
      ...session.knownPreferences,
      ...preferences
    };
    session.lastActivity = Date.now();

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
    const session = this.getSession(callSid);
    if (!session) {
      throw new Error(`No booking session found for ${callSid}`);
    }

    if (workflowType !== 'existing' && workflowType !== 'new') {
      throw new Error(`Invalid workflow type: ${workflowType}. Must be 'existing' or 'new'`);
    }

    session.workflowType = workflowType;
    session.workflowTypeAsked = true; // Mark that Step 3 (workflow type question) has been asked
    session.lastActivity = Date.now();

    console.log(`🔄 [SESSION] ${callSid}: Workflow type set to ${workflowType} (Step 3 completed)`);
  }

  /**
   * Mark that Step 3 (workflow type question) has been asked
   * This is called when the agent asks the workflow type question conversationally
   * @param {string} callSid - Call SID identifier
   */
  markWorkflowTypeAsked(callSid) {
    const session = this.getSession(callSid);
    if (!session) {
      throw new Error(`No booking session found for ${callSid}`);
    }

    session.workflowTypeAsked = true;
    session.lastActivity = Date.now();

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
    const session = this.getSession(callSid);
    if (!session) {
      throw new Error(`No booking session found for ${callSid}`);
    }

    session.sessionDetails = sessionDetails;
    session.lastActivity = Date.now();
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
      throw new Error(`No booking session found for ${callSid}`);
    }

    session.pageRef = pageRef;
    session.lastActivity = Date.now();
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

