import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

const mockGetConversationBehaviorConfig = jest.fn().mockReturnValue({
  conversationFlow: { speechContinuation: { enabled: false } },
  qualityMetrics: { trackInterruptions: true }
});

const root = '../../../robert-agent-service/src';
jest.unstable_mockModule(`${root}/agent/configManager.js`, () => ({
  default: { getConversationBehaviorConfig: mockGetConversationBehaviorConfig }
}));
jest.unstable_mockModule(`${root}/services/conversationQualityService.js`, () => ({ default: { trackInterruption: jest.fn(), trackBargeInResponseTime: jest.fn() } }));
jest.unstable_mockModule(`${root}/services/adaptiveTimingService.js`, () => ({ default: { trackCallerBehavior: jest.fn() } }));
jest.unstable_mockModule(`${root}/services/progressIndicatorService.js`, () => ({ default: { stopPeriodicUpdates: jest.fn() } }));

let BargeInHandler;
beforeAll(async () => {
  const mod = await import('../../../robert-agent-service/src/handlers/mediaStream/events/bargeInHandler.js');
  BargeInHandler = mod.BargeInHandler;
});

describe('Barge-in Logic', () => {
  let mockState;
  let mockOpenaiWs;
  let mockResponseHandler;

  beforeEach(() => {
    mockState = {
      callSid: 'test-call-123',
      isInterrupted: false,
      activeResponseId: 'resp_abc',
      responseStartTime: Date.now() - 5000,
      userSpeechStartedTime: 0,
      isResponding: true,
      outboundAudioPacer: {},
      outboundAudioBuffer: [Buffer.alloc(1)],
      lastAudioChunkTime: Date.now() - 500,
      agentFinishedSpeakingTime: 0,
      sendToOpenAI: jest.fn().mockReturnValue(true),
      cancelledResponseIds: new Set(),
      cancellationTime: new Map(),
      pendingTranscriptions: [],
      pendingBargeInCheck: false,
      speechContinuationGraceTimer: null,
      speechStoppedTime: 0,
      speechResumedDuringGrace: false,
      gracePeriodExtensionCount: 0,
      pendingTranscriptionsAfterGrace: [],
      interruptionStartTime: 0,
      outboundAudioChunkCount: 0
    };
    mockOpenaiWs = {};
    mockResponseHandler = { immediatelyStopAudio: jest.fn() };
  });

  it('sets interrupted flag when triggerImmediateBargeIn is called', async () => {
    const handler = new BargeInHandler(mockState, mockOpenaiWs, mockResponseHandler);
    handler.triggerImmediateBargeIn('speech_started');
    expect(mockState.isInterrupted).toBe(true);
    expect(mockState.interruptionStartTime).toBeGreaterThan(0);
  });

  it('cancels OpenAI response on interruption when activeResponseId is set', async () => {
    const handler = new BargeInHandler(mockState, mockOpenaiWs, mockResponseHandler);
    handler.triggerImmediateBargeIn('speech_started');
    expect(mockState.sendToOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'response.cancel', response_id: 'resp_abc' }),
      expect.any(Object)
    );
  });

  it('calls responseHandler.immediatelyStopAudio on barge-in', async () => {
    const handler = new BargeInHandler(mockState, mockOpenaiWs, mockResponseHandler);
    handler.triggerImmediateBargeIn('speech_started');
    expect(mockResponseHandler.immediatelyStopAudio).toHaveBeenCalled();
  });

  it('transitions state to waiting for user after barge-in', async () => {
    const handler = new BargeInHandler(mockState, mockOpenaiWs, mockResponseHandler);
    handler.triggerImmediateBargeIn('speech_started');
    expect(mockState.waitingForUser).toBe(true);
    expect(mockState.isResponding).toBe(false);
    expect(mockState.activeResponseId).toBeNull();
  });

  it('triggerBargeInFromTranscription when already interrupted only calls immediatelyStopAudio', async () => {
    mockState.isInterrupted = true;
    const handler = new BargeInHandler(mockState, mockOpenaiWs, mockResponseHandler);
    handler.triggerBargeInFromTranscription('stop');
    expect(mockResponseHandler.immediatelyStopAudio).toHaveBeenCalled();
    expect(mockState.sendToOpenAI).not.toHaveBeenCalled();
  });

  it('handleSpeechStarted does not trigger barge-in when no audio playing', async () => {
    mockState.isResponding = false;
    mockState.activeResponseId = null;
    mockState.outboundAudioPacer = null;
    mockState.outboundAudioBuffer = null;
    mockState.lastAudioChunkTime = 0;
    mockState.agentFinishedSpeakingTime = 0;
    const handler = new BargeInHandler(mockState, mockOpenaiWs, mockResponseHandler);
    const spy = jest.spyOn(handler, 'triggerImmediateBargeIn');
    await handler.handleSpeechStarted({});
    expect(spy).not.toHaveBeenCalled();
  });
});
