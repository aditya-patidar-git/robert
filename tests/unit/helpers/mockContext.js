/**
 * Test context factories for unit tests.
 */

export function createMockCallContext(overrides = {}) {
  return {
    callSid: 'test-call-sid-123',
    currentPhase: 'general_inquiry',
    workflowContext: null,
    conversations: {},
    ...overrides
  };
}

export function createMockStateSnapshot(overrides = {}) {
  return {
    waitingForUser: true,
    isResponding: false,
    activeResponseId: null,
    hasInitialGreetingCompleted: true,
    lastAudioChunkTime: 0,
    outboundAudioPacer: null,
    outboundAudioBuffer: [],
    ...overrides
  };
}

export function createMockTranscriptionResult(overrides = {}) {
  return {
    processed: true,
    shouldCreateResponse: true,
    qualityScore: 0.9,
    isBackgroundNoise: false,
    reason: null,
    ...overrides
  };
}

export function createMockResponseInstructionsContext(overrides = {}) {
  return {
    callSid: 'test-call-sid-123',
    state: {},
    conversation: {},
    hasInitialGreetingBeenSent: false,
    ...overrides
  };
}
