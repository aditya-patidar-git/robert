/**
 * Conversation Service
 * Pure business logic for conversation flow: intent detection, response decisions, response instructions.
 * No WebSocket or I/O - handlers use this service and perform I/O.
 */

import { getIntentFromTranscript } from './intentFromTranscript.js';
import { getPhaseForIntent } from './toolFilterService.js';
import promptService from './promptService.js';
import consentInstructionBuilder from './consentInstructionBuilder.js';
import { getConversationFlowState } from '../handlers/mediaStream/utils/conversationStateHelpers.js';
import { isAgentAudioPlaying } from '../handlers/mediaStream/utils/audioPlayingState.js';

export class ConversationService {
  constructor(options = {}) {
    this.promptService = options.promptService || promptService;
    this.consentInstructionBuilder = options.consentInstructionBuilder || consentInstructionBuilder;
  }

  /**
   * Detect intent from transcript and determine if workflow phase should update.
   * @param {string} transcript - User transcript text
   * @param {Object} context - { callSid, currentPhase, workflowContext, conversations }
   * @returns {{ intent: string|null, phase: string|null, shouldUpdateTools: boolean, newWorkflowContext: string|null }}
   */
  detectIntent(transcript, context = {}) {
    const { currentPhase = null, workflowContext = null } = context;
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return { intent: null, phase: null, shouldUpdateTools: false, newWorkflowContext: null };
    }

    const intent = getIntentFromTranscript(transcript);
    const phase = intent ? getPhaseForIntent(intent) : null;

    if (!phase) {
      return { intent, phase: null, shouldUpdateTools: false, newWorkflowContext: null };
    }

    if (phase === 'cancellation' && currentPhase !== 'cancellation' && workflowContext !== 'cancellation') {
      return {
        intent,
        phase: 'cancellation',
        shouldUpdateTools: true,
        newWorkflowContext: 'cancellation'
      };
    }

    if (phase === 'booking_start' && currentPhase !== 'booking_start' && workflowContext !== 'booking') {
      return {
        intent,
        phase: 'booking_start',
        shouldUpdateTools: true,
        newWorkflowContext: 'booking'
      };
    }

    return { intent, phase, shouldUpdateTools: false, newWorkflowContext: null };
  }

  /**
   * Decide whether to create a response after a transcription.
   * Pure function: no side effects.
   * @param {Object} transcriptionResult - { processed, shouldCreateResponse, qualityScore, isBackgroundNoise }
   * @param {Object} stateSnapshot - { waitingForUser, isResponding, activeResponseId, hasInitialGreetingCompleted, outboundAudioPacer, outboundAudioBuffer, bargeInTailUntil, inConsentOrLanguagePhase }
   * @returns {boolean}
   */
  shouldCreateResponse(transcriptionResult, stateSnapshot = {}) {
    const shouldCreate =
      transcriptionResult?.processed === true &&
      transcriptionResult?.shouldCreateResponse !== false &&
      (transcriptionResult?.qualityScore ?? 1) >= 0.7 &&
      !transcriptionResult?.isBackgroundNoise;

    const inConsentOrLanguagePhase = stateSnapshot.inConsentOrLanguagePhase === true;
    const isAudioPlaying = isAgentAudioPlaying(stateSnapshot, {
      consentPhaseRelaxed: inConsentOrLanguagePhase
    });

    return (
      shouldCreate &&
      stateSnapshot.waitingForUser === true &&
      !isAudioPlaying &&
      stateSnapshot.activeResponseId == null &&
      stateSnapshot.hasInitialGreetingCompleted === true
    );
  }

  /**
   * Get instructions for response.create (initial greeting or subsequent).
   * @param {Object} context - { callSid, state, conversation, hasInitialGreetingBeenSent }
   * @returns {Promise<{ instructions: string|null, isInitialGreeting: boolean }>}
   */
  async getResponseInstructions(context = {}) {
    const { callSid, state, conversation = {}, hasInitialGreetingBeenSent = false } = context;
    const isInitialGreeting = !hasInitialGreetingBeenSent;

    if (isInitialGreeting) {
      const flowState = getConversationFlowState(callSid, state);
      const { waitingForLanguage, languageSelected, consentGiven } = flowState;

      let privacySettings = conversation?._cachedPrivacySettings ?? null;
      if (!privacySettings) {
        try {
          const PrivacyConfig = (await import('../database/models/PrivacyConfig.js')).default;
          privacySettings = await PrivacyConfig.findOne({ isActive: true }).lean().catch(() => null);
          if (conversation && privacySettings) {
            conversation._cachedPrivacySettings = privacySettings;
          }
        } catch {
          privacySettings = null;
        }
      }

      const requireExplicitConsent = privacySettings?.recording?.requireExplicitConsent !== false;
      const consentNotice =
        privacySettings?.consentScript ||
        'For training and quality, this call may be recorded and handled in line with our Privacy Policy.';
      const consentQuestion = 'Do you consent to this call being recorded?';

      if (requireExplicitConsent && !consentGiven) {
        const consentInstructions = consentInstructionBuilder.buildConsentFlowInstructions({
          consentNotice,
          consentQuestion,
          languageSelected,
          consentGiven,
          requireExplicitConsent,
          baseInstructions: ''
        });
        return {
          instructions: consentInstructions || null,
          isInitialGreeting: true
        };
      }

      const instructions = this.promptService.getContextualInstructions({
        isInitialGreeting: !waitingForLanguage,
        requireConsent: false,
        waitingForLanguage: waitingForLanguage && !languageSelected,
        languageSelected
      });
      return { instructions, isInitialGreeting: true };
    }

    const workflowPhase = await this.promptService.determineWorkflowPhase(state, callSid);
    const activeToolName =
      state?.activeToolName || (state?.activeResponseId ? 'processing_response' : null);
    let courseType = null;
    let workflowType = null;
    let currentStep = null;
    if (conversation?.bookingSession) {
      const bs = conversation.bookingSession;
      courseType = bs.courseType;
      workflowType = bs.workflowType;
      currentStep = bs.currentStep;
    }

    const flowState = getConversationFlowState(callSid, state);
    const { waitingForLanguage, languageSelected, consentRequested, consentGiven } = flowState;

    let privacySettings = conversation?._cachedPrivacySettings ?? null;
    if (!privacySettings) {
      try {
        const PrivacyConfig = (await import('../database/models/PrivacyConfig.js')).default;
        privacySettings = await PrivacyConfig.findOne({ isActive: true }).lean().catch(() => null);
        if (conversation && privacySettings) {
          conversation._cachedPrivacySettings = privacySettings;
        }
      } catch {
        privacySettings = null;
      }
    }
    const requireExplicitConsent = privacySettings?.recording?.requireExplicitConsent !== false;
    const consentNotice =
      privacySettings?.consentScript ||
      'For training and quality, this call may be recorded and handled in line with our Privacy Policy.';
    const consentQuestion = 'Do you consent to this call being recorded?';

    if (requireExplicitConsent && !consentGiven && languageSelected) {
      const consentInstructions = this.consentInstructionBuilder.buildConsentFlowInstructions({
        consentNotice,
        consentQuestion,
        languageSelected: true,
        consentGiven: false,
        requireExplicitConsent: true,
        baseInstructions: ''
      });
      if (consentInstructions) {
        return { instructions: consentInstructions, isInitialGreeting: false, isConsentQuestion: true };
      }
    }

    const instructions = this.promptService.getContextualInstructions({
      isInitialGreeting: false,
      workflowPhase,
      courseType,
      workflowType,
      currentStep,
      activeTool: activeToolName,
      waitingForLanguage: waitingForLanguage && !languageSelected,
      languageSelected
    });

    return { instructions, isInitialGreeting: false };
  }
}

const defaultInstance = new ConversationService();
export default defaultInstance;
