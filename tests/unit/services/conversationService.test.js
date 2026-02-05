/**
 * Unit tests for ConversationService (Category A: KB, Web Search, Error handling).
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ConversationService } from '../../../robert-agent-service/src/services/conversationService.js';
import { createMockCallContext, createMockStateSnapshot, createMockTranscriptionResult } from '../helpers/mockContext.js';
import { createMockPromptService } from '../helpers/mockServices.js';

describe('ConversationService', () => {
  let service;
  let mockPromptService;

  beforeEach(() => {
    mockPromptService = createMockPromptService();
    service = new ConversationService({ promptService: mockPromptService });
  });

  describe('detectIntent', () => {
    it('returns null intent for empty transcript', () => {
      const result = service.detectIntent('', createMockCallContext());
      expect(result.intent).toBeNull();
      expect(result.shouldUpdateTools).toBe(false);
    });

    it('returns null for whitespace-only transcript', () => {
      const result = service.detectIntent('   ', createMockCallContext());
      expect(result.intent).toBeNull();
      expect(result.shouldUpdateTools).toBe(false);
    });

    it('detects cancellation intent and suggests phase update', () => {
      const context = createMockCallContext({ currentPhase: 'general_inquiry', workflowContext: null });
      const result = service.detectIntent('I want to cancel my booking', context);
      expect(result.intent).toBeDefined();
      expect(result.phase).toBe('cancellation');
      expect(result.shouldUpdateTools).toBe(true);
      expect(result.newWorkflowContext).toBe('cancellation');
    });

    it('detects booking intent and suggests phase update', () => {
      const context = createMockCallContext({ currentPhase: null, workflowContext: null });
      const result = service.detectIntent('I want to book a CBT', context);
      expect(result.phase).toBe('booking_start');
      expect(result.shouldUpdateTools).toBe(true);
      expect(result.newWorkflowContext).toBe('booking');
    });

    it('does not suggest update when already in cancellation phase', () => {
      const context = createMockCallContext({ currentPhase: 'cancellation', workflowContext: 'cancellation' });
      const result = service.detectIntent('cancel my booking', context);
      expect(result.shouldUpdateTools).toBe(false);
    });
  });

  describe('shouldCreateResponse', () => {
    it('returns true when transcription is processed and quality is high', () => {
      const result = service.shouldCreateResponse(
        createMockTranscriptionResult({ processed: true, qualityScore: 0.9 }),
        createMockStateSnapshot()
      );
      expect(result).toBe(true);
    });

    it('returns false when transcription is background noise', () => {
      const result = service.shouldCreateResponse(
        createMockTranscriptionResult({ isBackgroundNoise: true }),
        createMockStateSnapshot()
      );
      expect(result).toBe(false);
    });

    it('returns false when quality score is below 0.7', () => {
      const result = service.shouldCreateResponse(
        createMockTranscriptionResult({ qualityScore: 0.5 }),
        createMockStateSnapshot()
      );
      expect(result).toBe(false);
    });

    it('withholds response when confidence is low (uncertainty gate)', () => {
      const result = service.shouldCreateResponse(
        createMockTranscriptionResult({ qualityScore: 0.5, processed: true }),
        createMockStateSnapshot()
      );
      expect(result).toBe(false);
    });

    it('returns false when audio is playing', () => {
      const result = service.shouldCreateResponse(
        createMockTranscriptionResult(),
        createMockStateSnapshot({ isResponding: true })
      );
      expect(result).toBe(false);
    });

    it('returns false when initial greeting has not completed', () => {
      const result = service.shouldCreateResponse(
        createMockTranscriptionResult(),
        createMockStateSnapshot({ hasInitialGreetingCompleted: false })
      );
      expect(result).toBe(false);
    });

    it('returns false when agent is not waiting for user', () => {
      const result = service.shouldCreateResponse(
        createMockTranscriptionResult(),
        createMockStateSnapshot({ waitingForUser: false })
      );
      expect(result).toBe(false);
    });
  });

  describe('getResponseInstructions', () => {
    it('returns instructions for initial greeting when consent not given', async () => {
      mockPromptService.getContextualInstructions.mockReturnValue('Ask for language preference.');
      const context = {
        callSid: 'test-123',
        state: { waitingForLanguage: true, languagePreferenceState: {} },
        conversation: { _cachedPrivacySettings: { recording: { requireExplicitConsent: false } } },
        hasInitialGreetingBeenSent: false
      };
      const result = await service.getResponseInstructions(context);
      expect(result).toHaveProperty('instructions');
      expect(result.isInitialGreeting).toBe(true);
    });

    it('returns instructions for subsequent response', async () => {
      mockPromptService.determineWorkflowPhase.mockResolvedValue('general_inquiry');
      mockPromptService.getContextualInstructions.mockReturnValue('Answer the question.');
      const context = {
        callSid: 'test-123',
        state: { activeToolName: null, activeResponseId: null },
        conversation: {},
        hasInitialGreetingBeenSent: true
      };
      const result = await service.getResponseInstructions(context);
      expect(result).toHaveProperty('instructions');
      expect(result.isInitialGreeting).toBe(false);
    });
  });
});
