/**
 * Mid-tool epistemic reply gating (conversationService).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import conversationService from './conversationService.js';
import configManager from '../agent/configManager.js';

const baseTranscription = {
  processed: true,
  shouldCreateResponse: true,
  qualityScore: 1,
  isBackgroundNoise: false
};

const idleSnapshot = (overrides = {}) => ({
  waitingForUser: true,
  browserToolExecution: null,
  toolExecutionCompleting: false,
  isResponding: false,
  activeResponseId: null,
  hasInitialGreetingCompleted: true,
  outboundAudioPacer: null,
  outboundAudioBuffer: null,
  bargeInTailUntil: 0,
  inConsentOrLanguagePhase: false,
  ...overrides
});

describe('shouldCreateResponse — mid-tool gap', () => {
  it('allows normal path when waitingForUser and no browser execution', () => {
    assert.strictEqual(
      conversationService.shouldCreateResponse(baseTranscription, idleSnapshot()),
      true
    );
  });

  it('allows reply when not waitingForUser but browser tool execution is active', () => {
    const snap = idleSnapshot({
      waitingForUser: false,
      browserToolExecution: { toolName: 'booking_step_fill_contact_details', startTime: Date.now() }
    });
    assert.strictEqual(conversationService.shouldCreateResponse(baseTranscription, snap), true);
  });

  it('blocks mid-gap reply when toolExecutionCompleting', () => {
    const snap = idleSnapshot({
      waitingForUser: false,
      browserToolExecution: { toolName: 'booking_step_fill_contact_details' },
      toolExecutionCompleting: true
    });
    assert.strictEqual(conversationService.shouldCreateResponse(baseTranscription, snap), false);
  });

  it('blocks when allowMidToolEpistemicReplies is false', () => {
    const orig = configManager.getConversationBehaviorConfig;
    configManager.getConversationBehaviorConfig = () => ({ allowMidToolEpistemicReplies: false });
    try {
      const snap = idleSnapshot({
        waitingForUser: false,
        browserToolExecution: { toolName: 'x' }
      });
      assert.strictEqual(conversationService.shouldCreateResponse(baseTranscription, snap), false);
    } finally {
      configManager.getConversationBehaviorConfig = orig;
    }
  });

  it('blocks when no waiting and no browser execution', () => {
    const snap = idleSnapshot({ waitingForUser: false, browserToolExecution: null });
    assert.strictEqual(conversationService.shouldCreateResponse(baseTranscription, snap), false);
  });
});

describe('buildMidToolEpistemicInstructionSuffix', () => {
  it('includes tool name and no-tools rule', () => {
    const s = conversationService.buildMidToolEpistemicInstructionSuffix('booking_step_x');
    assert.match(s, /booking_step_x/);
    assert.match(s, /MUST NOT call any tools/i);
  });
});
