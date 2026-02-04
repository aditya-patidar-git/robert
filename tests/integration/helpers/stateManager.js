/**
 * Test state manager for integration tests
 */
class StateManager {
  constructor() { this.testStates = new Map(); }
  async initialize(testName) {
    this.testStates.set(testName, { callSids: [], recordings: [], toolCalls: [], transcripts: [], errors: [], startTime: Date.now() });
  }
  getState(testName) { return this.testStates.get(testName) || null; }
  addCallSid(testName, callSid) {
    const state = this.getState(testName);
    if (state) state.callSids.push(callSid);
  }
  addRecording(testName, recording) {
    const state = this.getState(testName);
    if (state) state.recordings.push(recording);
  }
  addToolCall(testName, toolCall) {
    const state = this.getState(testName);
    if (state) state.toolCalls.push(toolCall);
  }
  addTranscript(testName, transcript) {
    const state = this.getState(testName);
    if (state) state.transcripts.push(transcript);
  }
  addError(testName, error) {
    const state = this.getState(testName);
    if (state) state.errors.push({ timestamp: Date.now(), error: error.message || error, stack: error.stack });
  }
  async cleanup(testName) { this.testStates.delete(testName); }
  verifyIsolation() {
    const states = Array.from(this.testStates.values());
    const callSids = new Set();
    for (const state of states) {
      for (const callSid of state.callSids) {
        if (callSids.has(callSid)) return false;
        callSids.add(callSid);
      }
    }
    return true;
  }
}
export const stateManager = new StateManager();
export default stateManager;
