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
import configManager from '../agent/configManager.js';
import { getEffectiveRecordingConsentSettings } from './callRecordPersistenceService.js';
import { getFlowCopy } from './flowCopyByLanguage.js';
import multilingualService from './multilingualService.js';

export class ConversationService {
  constructor(options = {}) {
    this.promptService = options.promptService || promptService;
    this.consentInstructionBuilder = options.consentInstructionBuilder || consentInstructionBuilder;
  }

  /**
   * After mid-call language switch: force the next spoken reply to use the new language.
   */
  _applyOneShotPostLanguageSwitch(state, instructions) {
    const canon = state?.pendingOneShotOutputLanguageCanonical;
    if (!canon || typeof instructions !== 'string' || !instructions.trim()) {
      return instructions;
    }
    state.pendingOneShotOutputLanguageCanonical = null;
    const cfg = multilingualService.getLanguageConfig(canon);
    const label = cfg?.name || canon;
    const prefix = `CRITICAL — THIS SPOKEN RESPONSE ONLY: The caller has just switched to ${label}. Your entire reply must be in ${label} only. Ignore previous-turn languages; match the new session language.`;
    return `${prefix}\n\n${instructions}`;
  }

  /**
   * Detect intent from transcript and determine if workflow phase should update.
   * Mid-workflow: only switch to a different workflow if the caller used a strong start intent (e.g. "I want to book"), not a weak keyword (e.g. "booked" in "it is booked for 26 February").
   * @param {string} transcript - User transcript text
   * @param {Object} context - { callSid, currentPhase, workflowContext, bookingSession }
   * @returns {{ intent: string|null, phase: string|null, shouldUpdateTools: boolean, newWorkflowContext: string|null }}
   */
  detectIntent(transcript, context = {}) {
    const { currentPhase = null, workflowContext = null, bookingSession = null } = context;
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return { intent: null, phase: null, shouldUpdateTools: false, newWorkflowContext: null, resetWorkflow: false };
    }

    const { intent, isStrongStartIntent } = getIntentFromTranscript(transcript);
    const phase = intent ? getPhaseForIntent(intent) : null;

    // Restart workflow: caller said "start over" / "restart" etc. Reset session and go to booking_start.
    if (intent === 'restart_workflow') {
      return {
        intent,
        phase: 'booking_start',
        shouldUpdateTools: true,
        newWorkflowContext: 'booking',
        resetWorkflow: true
      };
    }

    if (!phase) {
      return { intent, phase: null, shouldUpdateTools: false, newWorkflowContext: null, resetWorkflow: false };
    }

    const inMidWorkflow = (workflowContext === 'cancellation' && (bookingSession?.cancellationCurrentStep ?? 0) >= 1) ||
      (workflowContext === 'booking' && (bookingSession?.currentStep ?? 0) >= 1);
    const wouldSwitchWorkflow = (workflowContext === 'cancellation' && phase === 'booking_start') ||
      (workflowContext === 'booking' && phase === 'cancellation');
    if (inMidWorkflow && wouldSwitchWorkflow && !isStrongStartIntent) {
      return { intent, phase, shouldUpdateTools: false, newWorkflowContext: null, resetWorkflow: false };
    }

    if (phase === 'cancellation' && currentPhase !== 'cancellation' && workflowContext !== 'cancellation') {
      return {
        intent,
        phase: 'cancellation',
        shouldUpdateTools: true,
        newWorkflowContext: 'cancellation',
        resetWorkflow: false
      };
    }

    if (phase === 'booking_start' && currentPhase !== 'booking_start' && workflowContext !== 'booking') {
      return {
        intent,
        phase: 'booking_start',
        shouldUpdateTools: true,
        newWorkflowContext: 'booking',
        resetWorkflow: false
      };
    }

    return { intent, phase, shouldUpdateTools: false, newWorkflowContext: null, resetWorkflow: false };
  }

  /**
   * Whether DB/config allows mid-tool epistemic replies (default true if unset).
   * @param {Object|null} conversationBehaviorConfig
   * @returns {boolean}
   */
  _allowMidToolEpistemicReplies(conversationBehaviorConfig) {
    return conversationBehaviorConfig?.allowMidToolEpistemicReplies !== false;
  }

  /**
   * Instruction suffix: brief answers only; no tools; no unverified claims (mid-browser-step).
   * @param {string|null} toolName
   * @returns {string}
   */
  buildMidToolEpistemicInstructionSuffix(toolName) {
    const step = toolName ? ` (${toolName})` : '';
    return (
      `CRITICAL — MID-STEP REPLY${step}: A background booking step is still running. You MUST NOT call any tools in this turn. ` +
      'Answer ONLY from what you are certain of: this transcript, prior conversation, and established session facts. ' +
      'Do NOT state success or failure of the step in progress, do NOT invent dates, times, prices, or policy details. ' +
      'If you are not sure, say so in one short sentence and say you will confirm once processing finishes. ' +
      'Keep the reply brief.'
    );
  }

  /**
   * Decide whether to create a response after a transcription.
   * Pure function: no side effects.
   * @param {Object} transcriptionResult - { processed, shouldCreateResponse, qualityScore, isBackgroundNoise }
   * @param {Object} stateSnapshot - { waitingForUser, browserToolExecution, toolExecutionCompleting, isResponding, activeResponseId, hasInitialGreetingCompleted, outboundAudioPacer, outboundAudioBuffer, bargeInTailUntil, inConsentOrLanguagePhase }
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

    const cfg = configManager.getConversationBehaviorConfig();
    const allowMid = this._allowMidToolEpistemicReplies(cfg);
    const hasBrowserTool = stateSnapshot.browserToolExecution != null;
    const completing = stateSnapshot.toolExecutionCompleting === true;
    const canNormal = stateSnapshot.waitingForUser === true;
    const canMidGap =
      allowMid && hasBrowserTool && !completing && stateSnapshot.waitingForUser === false;

    return (
      shouldCreate &&
      (canNormal || canMidGap) &&
      !isAudioPlaying &&
      stateSnapshot.activeResponseId == null &&
      stateSnapshot.hasInitialGreetingCompleted === true
    );
  }

  /**
   * Detect if transcript indicates user said "yes" to proceed (cancellation Step 1 → Step 2).
   * Used to trigger the dedicated path that runs CRM login without relying on a tool call in that turn.
   * @param {string} transcript - User transcript (single or combined)
   * @returns {boolean}
   */
  isCancellationProceedConfirmation(transcript) {
    if (!transcript || typeof transcript !== 'string') return false;
    const t = transcript.trim().toLowerCase();
    if (!t) return false;
    const proceedPatterns = [
      /yes\s*(,?\s*)?(please\s*)?proceed/i,
      /(yes|yeah|yep|ok|okay|sure)\s*(,?\s*)?(please\s*)?proceed/i,
      /proceed\s*(please)?/i,
      /^yes\s*\.?\s*$/i,
      /go\s*ahead/i,
      /(let'?s?\s+)?proceed/i
    ];
    return proceedPatterns.some((p) => p.test(t));
  }

  /**
   * Decide tool_choice for transcript-driven response (single place for Media Streams and SIP).
   * Use 'none' for greeting, mid-tool epistemic reply, or language edge cases; 'auto' otherwise.
   * @param {Object} context - { callSid, state, conversation, hasInitialGreetingBeenSent, overrideWorkflowPhase, browserToolExecution }
   * @returns {Promise<{ toolChoice: 'none'|'auto'|object, workflowPhase: string|null, midToolEpistemicApplied?: boolean }>}
   */
  async getToolChoiceForResponse(context = {}) {
    const {
      callSid,
      state,
      conversation = {},
      hasInitialGreetingBeenSent = false,
      overrideWorkflowPhase,
      browserToolExecution
    } = context;
    if (!hasInitialGreetingBeenSent) {
      return { toolChoice: 'none', workflowPhase: 'greeting' };
    }
    if (state?.forceToolChoiceNoneOnce === true) {
      state.forceToolChoiceNoneOnce = false;
      const fs = getConversationFlowState(callSid, state);
      const inWorkflow = !!(conversation?.bookingSession || conversation?.workflowContext);
      let workflowPhase;
      if (fs.waitingForLanguage && !fs.languageSelected) {
        workflowPhase = 'language_selection';
      } else if (inWorkflow && overrideWorkflowPhase !== undefined && overrideWorkflowPhase !== null) {
        workflowPhase = overrideWorkflowPhase;
      } else {
        workflowPhase = await this.promptService.determineWorkflowPhase(state, callSid);
      }
      return { toolChoice: 'none', workflowPhase };
    }
    const result = await this.getResponseInstructions({
      callSid,
      state,
      conversation,
      hasInitialGreetingBeenSent,
      overrideWorkflowPhase,
      applyOneShotLanguageHint: false,
      midToolEpistemicMode: false
    });
    if (result.isConsentQuestion === true) {
      return { toolChoice: 'auto', workflowPhase: 'recording_consent' };
    }
    const fs = getConversationFlowState(callSid, state);
    const inWorkflow = !!(conversation?.bookingSession || conversation?.workflowContext);
    let workflowPhase;
    if (fs.waitingForLanguage && !fs.languageSelected) {
      workflowPhase = 'language_selection';
    } else if (inWorkflow && overrideWorkflowPhase !== undefined && overrideWorkflowPhase !== null) {
      workflowPhase = overrideWorkflowPhase;
    } else {
      workflowPhase = await this.promptService.determineWorkflowPhase(state, callSid);
    }
    if (workflowPhase === 'language_selection') {
      return {
        toolChoice: { type: 'function', name: 'set_call_language' },
        workflowPhase: 'language_selection'
      };
    }

    const cfg = configManager.getConversationBehaviorConfig();
    const allowMid = this._allowMidToolEpistemicReplies(cfg);
    const waitingForUser = state?.waitingForUser === true;
    const completing = state?.toolExecutionCompleting === true;
    if (
      allowMid &&
      browserToolExecution &&
      !completing &&
      !waitingForUser
    ) {
      return {
        toolChoice: 'none',
        workflowPhase,
        midToolEpistemicApplied: true
      };
    }

    return { toolChoice: 'auto', workflowPhase };
  }

  /**
   * Get instructions for response.create (initial greeting or subsequent).
   * @param {Object} context - { callSid, state, conversation, hasInitialGreetingBeenSent }
   * @returns {Promise<{ instructions: string|null, isInitialGreeting: boolean }>}
   */
  async getResponseInstructions(context = {}) {
    const {
      callSid,
      state,
      conversation = {},
      hasInitialGreetingBeenSent = false,
      overrideWorkflowPhase,
      applyOneShotLanguageHint = true,
      midToolEpistemicMode = false,
      browserToolExecution = null
    } = context;
    const isInitialGreeting = !hasInitialGreetingBeenSent;

    const withOneShot = (instructions) =>
      applyOneShotLanguageHint
        ? this._applyOneShotPostLanguageSwitch(state, instructions)
        : instructions;

    // Unsupported language requested (e.g. Sinhala): say one clear line then continue in English
    if (state?.unsupportedLanguageRequested) {
      const instructions = 'Say exactly: "That language isn\'t available at the moment. I can help you in English. Would you like to continue in English?" Then continue the conversation in English.';
      state.unsupportedLanguageRequested = null;
      if (conversation) conversation.unsupportedLanguageRequested = null;
      return { instructions: withOneShot(instructions), isInitialGreeting: !hasInitialGreetingBeenSent };
    }

    if (isInitialGreeting) {
      const flowState = getConversationFlowState(callSid, state);
      const { waitingForLanguage, languageSelected, consentGiven, consentResponded } = flowState;

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
      const telephonyConfig = configManager.getTelephonyConfig();
      const { consentRequired: requireExplicitConsent, consentMessage: consentNotice } = getEffectiveRecordingConsentSettings(telephonyConfig, privacySettings);
      const flowLang = languageSelected
        ? (conversation?.language || state?.languagePreferenceState?.language || 'en')
        : 'en';
      const flow = getFlowCopy(flowLang);

      // Consent only AFTER language is chosen (order: language Q → answer → consent → main question)
      if (requireExplicitConsent && !consentResponded && languageSelected) {
        const consentInstructions = consentInstructionBuilder.buildConsentFlowInstructions({
          consentNotice,
          consentQuestion: flow.consentQuestion,
          mainFollowUpQuestion: flow.mainFollowUpQuestion,
          languageSelected,
          consentGiven,
          consentResponded,
          requireExplicitConsent,
          baseInstructions: ''
        });
        return {
          instructions: withOneShot(consentInstructions || null),
          isInitialGreeting: true
        };
      }

      const instructions = this.promptService.getContextualInstructions({
        isInitialGreeting: !waitingForLanguage,
        requireConsent: false,
        waitingForLanguage: waitingForLanguage && !languageSelected,
        languageSelected,
        language: flowLang,
        consentQuestion: flow.consentQuestion,
        mainFollowUpQuestion: flow.mainFollowUpQuestion
      });
      return { instructions: withOneShot(instructions), isInitialGreeting: true };
    }

    const inWorkflow = !!(conversation?.bookingSession || conversation?.workflowContext);
    let workflowPhase =
      inWorkflow && overrideWorkflowPhase !== undefined && overrideWorkflowPhase !== null
        ? overrideWorkflowPhase
        : await this.promptService.determineWorkflowPhase(state, callSid);
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
    const { waitingForLanguage, languageSelected, consentRequested, consentGiven, consentResponded } = flowState;

    if (waitingForLanguage && !languageSelected) {
      workflowPhase = 'language_selection';
    }

    if (workflowPhase === 'language_selection' && waitingForLanguage && !languageSelected) {
      return {
        instructions:
          'CRITICAL — FUNCTION TOOL ONLY: Invoke the set_call_language tool exactly once via OpenAI function calling. Do NOT output JSON, do NOT print {"language_code":...} as text—that breaks the call (caller hears silence). Do NOT speak. Infer language_code (ISO 639-1) from the caller\'s LAST utterance in ANY script. Examples: Hindi/हिंदी/hindi→hi; English→en; Urdu→ur; Français→fr; Deutsch→de; Español→es; Italiano→it; Português→pt; Nederlands→nl; Polski→pl; Tamil→ta; Bengali→bn; Punjabi→pa; Gujarati→gu; Marathi→mr; Sinhala→si. If ambiguous, use en.',
        isInitialGreeting: false,
        isConsentQuestion: false
      };
    }

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
    const telephonyConfig = configManager.getTelephonyConfig();
    const { consentRequired: requireExplicitConsent, consentMessage: consentNotice } = getEffectiveRecordingConsentSettings(telephonyConfig, privacySettings);
    const flowLang = languageSelected
      ? (conversation?.language || state?.languagePreferenceState?.language || 'en')
      : 'en';
    const flow = getFlowCopy(flowLang);

    if (requireExplicitConsent && !consentResponded && languageSelected) {
      const consentInstructions = this.consentInstructionBuilder.buildConsentFlowInstructions({
        consentNotice,
        consentQuestion: flow.consentQuestion,
        mainFollowUpQuestion: flow.mainFollowUpQuestion,
        languageSelected: true,
        consentGiven,
        consentResponded,
        requireExplicitConsent: true,
        baseInstructions: ''
      });
      if (consentInstructions) {
        return {
          instructions: withOneShot(consentInstructions),
          isInitialGreeting: false,
          isConsentQuestion: true
        };
      }
    }

    let instructions = this.promptService.getContextualInstructions({
      isInitialGreeting: false,
      workflowPhase,
      courseType,
      workflowType,
      currentStep,
      activeTool: activeToolName,
      waitingForLanguage: waitingForLanguage && !languageSelected,
      languageSelected,
      language: flowLang,
      consentQuestion: flow.consentQuestion,
      mainFollowUpQuestion: flow.mainFollowUpQuestion
    });

    // When caller declined recording: explicitly tell the model to acknowledge and continue (do not say call cannot proceed)
    if (consentResponded && !consentGiven) {
      const postDeclineInstruction = `CRITICAL: The caller has just declined recording. You MUST acknowledge briefly (e.g. that the call will not be recorded) and then say exactly: "${flow.mainFollowUpQuestion}" Do NOT say the call cannot continue, that you need consent to proceed, or that they should contact by other means—continue the call as normal.`;
      instructions = instructions ? `${postDeclineInstruction}\n\n${instructions}` : postDeclineInstruction;
    }

    // Verification pending: transcript-driven responses must also get "call client_verification only" so the model doesn't call booking_step_search_client again
    const verificationPending = conversation?.clientDetails && !conversation?.clientVerified &&
      (workflowPhase === 'booking_existing_client' || currentStep === 5);
    if (verificationPending) {
      const verificationInstruction = `CRITICAL: You are in client verification. Do NOT call booking_step_search_client again. Call client_verification with ONLY what the caller has just said—one field at a time. Ask for full name first and call with fullName only when they provide it. Then ask for postcode and call with fullName (from previous result) and postcode only when the caller says their postcode. Then ask for telephone number and call with fullName, postcode, and telephoneNumber only when the caller says their number. Do NOT pass postcode or telephoneNumber from the conversation or stored clientDetails—only use what the caller actually says. After client_verification returns verified: true, call booking_step_select_session.`;
      instructions = instructions ? `${verificationInstruction}\n\n${instructions}` : verificationInstruction;
    }

    if (midToolEpistemicMode === true) {
      const suffix = this.buildMidToolEpistemicInstructionSuffix(browserToolExecution?.toolName);
      instructions = instructions ? `${instructions}\n\n${suffix}` : suffix;
    }

    if (state?.pendingInterruptionInstructionSuffix) {
      const extra = state.pendingInterruptionInstructionSuffix;
      state.pendingInterruptionInstructionSuffix = null;
      instructions = instructions ? `${extra}\n\n${instructions}` : extra;
    }

    return { instructions: withOneShot(instructions), isInitialGreeting: false };
  }
}

const defaultInstance = new ConversationService();
export default defaultInstance;
