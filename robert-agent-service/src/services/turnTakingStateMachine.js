/**
 * Turn-Taking State Machine
 * Manages conversation state transitions for cleaner turn-taking logic
 */

import { conversations } from "../shared/state.js";

// State definitions
export const STATES = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED',
  TOOL_EXECUTING: 'TOOL_EXECUTING'
};

// Valid state transitions
const VALID_TRANSITIONS = {
  [STATES.IDLE]: [STATES.LISTENING, STATES.TOOL_EXECUTING], // Allow direct transition to tool execution
  [STATES.LISTENING]: [STATES.PROCESSING, STATES.TOOL_EXECUTING],
  [STATES.PROCESSING]: [STATES.SPEAKING],
  [STATES.SPEAKING]: [STATES.LISTENING, STATES.INTERRUPTED],
  [STATES.INTERRUPTED]: [STATES.LISTENING, STATES.PROCESSING],
  [STATES.TOOL_EXECUTING]: [STATES.LISTENING, STATES.SPEAKING]
};

class TurnTakingStateMachine {
  constructor() {
    // State is stored in conversation state
  }

  /**
   * Initialize state machine for a call
   * @param {string} callSid - Call SID
   */
  initialize(callSid) {
    if (!conversations[callSid]) {
      conversations[callSid] = {};
    }
    
    conversations[callSid].turnTakingState = {
      currentState: STATES.IDLE,
      previousState: null,
      stateHistory: [],
      metadata: {}
    };
    
    console.log(`🔄 [${callSid}] State machine initialized: ${STATES.IDLE}`);
  }

  /**
   * Transition to a new state
   * @param {string} callSid - Call SID
   * @param {string} newState - New state to transition to
   * @param {Object} context - Additional context (responseId, toolName, etc.)
   * @returns {boolean} - True if transition was successful
   */
  transition(callSid, newState, context = {}) {
    if (!conversations[callSid]?.turnTakingState) {
      this.initialize(callSid);
    }

    const stateMachine = conversations[callSid].turnTakingState;
    const currentState = stateMachine.currentState;

    // Validate transition
    if (!this.canTransition(callSid, currentState, newState)) {
      console.warn(`⚠️ [${callSid}] Invalid transition: ${currentState} → ${newState}`);
      return false;
    }

    // Perform transition
    stateMachine.previousState = currentState;
    stateMachine.currentState = newState;
    stateMachine.stateHistory.push({
      from: currentState,
      to: newState,
      timestamp: Date.now(),
      context
    });

    // Keep only last 50 transitions
    if (stateMachine.stateHistory.length > 50) {
      stateMachine.stateHistory.shift();
    }

    // Update metadata
    stateMachine.metadata = { ...stateMachine.metadata, ...context };

    console.log(`🔄 [${callSid}] State transition: ${currentState} → ${newState}`, context);
    
    return true;
  }

  /**
   * Check if a transition is valid
   * @param {string} callSid - Call SID
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {boolean} - True if transition is valid
   */
  canTransition(callSid, fromState, toState) {
    const validNextStates = VALID_TRANSITIONS[fromState];
    if (!validNextStates) {
      return false;
    }
    return validNextStates.includes(toState);
  }

  /**
   * Get current state
   * @param {string} callSid - Call SID
   * @returns {string|null} - Current state or null
   */
  getCurrentState(callSid) {
    return conversations[callSid]?.turnTakingState?.currentState || null;
  }

  /**
   * Get state metadata
   * @param {string} callSid - Call SID
   * @returns {Object} - State metadata
   */
  getStateMetadata(callSid) {
    return conversations[callSid]?.turnTakingState?.metadata || {};
  }

  /**
   * Check if in a specific state
   * @param {string} callSid - Call SID
   * @param {string} state - State to check
   * @returns {boolean} - True if in the specified state
   */
  isInState(callSid, state) {
    return this.getCurrentState(callSid) === state;
  }

  /**
   * Get state history
   * @param {string} callSid - Call SID
   * @returns {Array} - State transition history
   */
  getStateHistory(callSid) {
    return conversations[callSid]?.turnTakingState?.stateHistory || [];
  }

  /**
   * Reset state machine for a call
   * @param {string} callSid - Call SID
   */
  reset(callSid) {
    if (conversations[callSid]?.turnTakingState) {
      conversations[callSid].turnTakingState = {
        currentState: STATES.IDLE,
        previousState: null,
        stateHistory: [],
        metadata: {}
      };
      console.log(`🔄 [${callSid}] State machine reset to ${STATES.IDLE}`);
    }
  }

  /**
   * Get state machine info for debugging
   * @param {string} callSid - Call SID
   * @returns {Object|null} - State machine info or null
   */
  getStateInfo(callSid) {
    return conversations[callSid]?.turnTakingState || null;
  }
}

export default new TurnTakingStateMachine();

