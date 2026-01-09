/**
 * Test State Manager
 * Manages isolated state for each test
 * Single responsibility: state isolation per test
 */

class StateManager {
  constructor() {
    this.testStates = new Map();
  }

  /**
   * Initialize state for a test
   */
  async initialize(testName) {
    this.testStates.set(testName, {
      callSids: [],
      recordings: [],
      toolCalls: [],
      transcripts: [],
      errors: [],
      startTime: Date.now()
    });
  }

  /**
   * Get state for a test
   */
  getState(testName) {
    return this.testStates.get(testName) || null;
  }

  /**
   * Add call SID to test state
   */
  addCallSid(testName, callSid) {
    const state = this.getState(testName);
    if (state) {
      state.callSids.push(callSid);
    }
  }

  /**
   * Add recording to test state
   */
  addRecording(testName, recording) {
    const state = this.getState(testName);
    if (state) {
      state.recordings.push(recording);
    }
  }

  /**
   * Add tool call to test state
   */
  addToolCall(testName, toolCall) {
    const state = this.getState(testName);
    if (state) {
      state.toolCalls.push(toolCall);
    }
  }

  /**
   * Add transcript to test state
   */
  addTranscript(testName, transcript) {
    const state = this.getState(testName);
    if (state) {
      state.transcripts.push(transcript);
    }
  }

  /**
   * Add error to test state
   */
  addError(testName, error) {
    const state = this.getState(testName);
    if (state) {
      state.errors.push({
        timestamp: Date.now(),
        error: error.message || error,
        stack: error.stack
      });
    }
  }

  /**
   * Cleanup state for a test
   */
  async cleanup(testName) {
    this.testStates.delete(testName);
  }

  /**
   * Verify state isolation (for concurrency test)
   */
  verifyIsolation() {
    const states = Array.from(this.testStates.values());
    const callSids = new Set();
    
    for (const state of states) {
      for (const callSid of state.callSids) {
        if (callSids.has(callSid)) {
          return false; // Duplicate callSid found - state leakage
        }
        callSids.add(callSid);
      }
    }
    
    return true; // No state leakage detected
  }
}

export const stateManager = new StateManager();
export default stateManager;

