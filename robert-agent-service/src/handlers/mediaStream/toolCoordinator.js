import crypto from 'crypto';
import { BargeInHandler, ConsentHandler, ResponseHandler, TranscriptionHandler, ToolCallHandler } from './events/index.js';
import { MemoryManager, LanguageDetector } from './utils/index.js';
import { getConversationFlowState } from './utils/conversationStateHelpers.js';
import { conversations } from '../../shared/state.js';
import { getRecordingConsent, updateRecordingConsent, conversationExists } from '../../shared/conversationStateAccessor.js';
import promptService from '../../services/promptService.js';
import consentInstructionBuilder from '../../services/consentInstructionBuilder.js';
import conversationService from '../../services/conversationService.js';
import { isTransferToHumanRequest } from '../../services/intentFromTranscript.js';
import transferCallTool from '../../tools/transferCall.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { AFTER_LOGIN_MESSAGE } from '../../config/cancellationPhrases.js';
import toolExecutionService from '../../services/toolExecutionService.js';
import progressIndicatorService from '../../services/progressIndicatorService.js';
import configManager from '../../agent/configManager.js';
import toolExecutor from '../../tools/index.js';
import {
  inferLanguageCodeFromCallerUtterance,
  parseLanguageCodeFromModelOutput,
  collectAssistantTextFromResponseOutput,
  transcriptSupportsLanguageCode
} from '../../services/languageSelectionInference.js';
import multilingualService from '../../services/multilingualService.js';
import { mergeWithBargeInFlushedGrace } from './utils/graceBufferMerge.js';

/**
 * Tool Coordinator
 * Coordinates event routing to appropriate handlers
 */
export class ToolCoordinator {
  constructor(stateManager, openaiWs, ws) {
    this.state = stateManager;
    this.openaiWs = openaiWs;
    this.ws = ws;
    this.openaiIntegration = null;
    
    // Initialize handlers
    const memoryManager = new MemoryManager(stateManager);
    const languageDetector = new LanguageDetector(stateManager);
    const consentHandler = new ConsentHandler(stateManager, memoryManager);
    
    this.responseHandler = new ResponseHandler(stateManager, ws);
    this.responseHandler.setOnCreateConsentResponseNeeded(async () => {
      this.state.explicitResponseRequested = true;
      await this.createAudioResponse();
    });
    this.responseHandler.setOnResponseDone((event) => {
      this.runPendingChainedToolIfAny(event).catch(err => {
        console.error(`❌ [${this.state.callSid}] runPendingChainedToolIfAny error:`, err);
      });
    });

    // Initialize BargeInHandler with ResponseHandler reference for immediate Twilio-level audio stopping
    // and optional snapshot callback for workflow resume after barge-in
    const onBargeInSnapshot = (callSid) => {
      const conv = conversations[callSid];
      // Prefer phase from conversation (authoritative) when in workflow; fallback to in-memory phase
      let phase = promptService.getWorkflowPhaseFromConversation(conv, this.state);
      if (phase == null) {
        phase = this.openaiIntegration?.getCurrentWorkflowPhase?.() ?? null;
        // If phase is wrong (booking_start) but we are in payment steps, use booking_payment so restore gives correct instructions
        const cs = conv?.bookingSession?.currentStep;
        const wt = conv?.bookingSession?.workflowType;
        if (
          phase === 'booking_start' &&
          ((wt === 'existing' && (cs === 9 || cs === 10)) || (wt === 'new' && cs === 8))
        ) {
          phase = 'booking_payment';
        }
      }
      return {
        bookingSession: conv?.bookingSession ?? null,
        workflowContext: conv?.workflowContext ?? null,
        lastAvailabilityCheck: conv?.lastAvailabilityCheck ?? null,
        phase
      };
    };
    this.bargeInHandler = new BargeInHandler(stateManager, openaiWs, this.responseHandler, onBargeInSnapshot);
    
    this.consentHandler = consentHandler;
    this.transcriptionHandler = new TranscriptionHandler(
      stateManager,
      languageDetector,
      consentHandler,
      openaiWs,
      this.bargeInHandler,
      (text) => this.applyIntentFromTranscript(text),
      () => this.openaiIntegration?.getCurrentWorkflowPhase?.(),
      (utterance) => this.queueLanguageSelectionBackup(utterance),
      () => this.createAudioResponse(),
      () => this.nudgeSlotChoiceAfterInterruptionTimeout()
    );
    this.toolCallHandler = new ToolCallHandler(stateManager, openaiWs, {
      onBeforeTriggerResponse: (callSid, context) => {
        const conv = conversations[callSid];
        const lastUser = conv?.transcript?.filter(t => t.role === 'user').pop();
        if (lastUser?.text?.trim()) this.applyIntentFromTranscript(lastUser.text);
        // Keep payment phase when process_payment fails so next response (e.g. after user says "read them out") stays in payment context
        if (context?.toolName === 'booking_step_process_payment' && context?.toolResult?.success === false && this.openaiIntegration) {
          this.openaiIntegration.setCurrentWorkflowPhase('booking_payment');
        }
        // Keep payment phase when send_payment_request fails or awaits confirmation/terms so barge-in snapshot matches tool list
        if (context?.toolName === 'booking_step_send_payment_request' &&
            (context?.toolResult?.success === false ||
              context?.toolResult?.requiresConfirmation === true ||
              context?.toolResult?.requiresTermsBeforeSend === true ||
              context?.toolResult?.requiresClientEmail === true ||
              context?.toolResult?.requiresClientMobile === true) &&
            this.openaiIntegration) {
          this.openaiIntegration.setCurrentWorkflowPhase('booking_payment');
        }
      },
      onAfterToolComplete: (callSid, context, phase) => {
        if (!phase || !this.openaiIntegration) return;
        const name = context?.toolName;
        if (!name || (!name.startsWith('booking_step_') && !name.startsWith('cancellation_step_'))) return;
        this.openaiIntegration.setCurrentWorkflowPhase(phase);
      },
      onWorkflowSwitch: (callSid, phase) => {
        if (this.openaiIntegration) {
          this.openaiIntegration.updateToolsForPhase(phase);
        }
      }
    });
  }

  /**
   * Run intent detection on transcript and update workflow phase/tools when needed.
   * Used by both transcription.completed and speech_stopped (process_transcriptions) paths.
   * @param {string} transcriptText - User transcript to analyze
   * @returns {boolean} True if tools/phase were updated
   */
  applyIntentFromTranscript(transcriptText) {
    const callSid = this.state.callSid;
    console.log(`🔍 [INTENT] [${callSid}] applyIntentFromTranscript called, transcript: "${(transcriptText || '').trim().slice(0, 120)}"`);
    if (!transcriptText?.trim()) {
      console.log(`🔍 [INTENT] [${callSid}] early exit: empty transcript`);
      return false;
    }
    if (!this.openaiIntegration) {
      console.log(`🔍 [INTENT] [${callSid}] early exit: openaiIntegration is null`);
      return false;
    }
    const currentPhase = this.openaiIntegration.getCurrentWorkflowPhase?.();
    const workflowContext = conversations[callSid]?.workflowContext;
    const bookingSession = conversations[callSid]?.bookingSession;
    const intentResult = conversationService.detectIntent(transcriptText, {
      callSid,
      currentPhase,
      workflowContext,
      bookingSession
    });
    console.log(`🔍 [INTENT] [${callSid}] detectIntent result: shouldUpdateTools=${intentResult?.shouldUpdateTools}, newWorkflowContext=${intentResult?.newWorkflowContext}, phase=${intentResult?.phase}, resetWorkflow=${intentResult?.resetWorkflow}`);
    if (!intentResult.shouldUpdateTools || !intentResult.newWorkflowContext) return false;
    if (intentResult.resetWorkflow && sessionStateManager.getSession(callSid)) {
      sessionStateManager.clearSession(callSid);
      console.log(`🔄 [${callSid}] Workflow reset: cleared booking session so caller can start over from the beginning`);
    }
    if (!conversations[callSid]) conversations[callSid] = { prematureResponses: {} };
    conversations[callSid].workflowContext = intentResult.newWorkflowContext;
    console.log(`🎯 [${callSid}] Intent detected: "${transcriptText.trim()}" - updating tools and workflow phase to ${intentResult.phase}`);
    const toolsUpdated = this.openaiIntegration.updateToolsForPhase(intentResult.phase);
    console.log(`🔍 [INTENT] [${callSid}] updateToolsForPhase(${intentResult.phase}) returned: ${toolsUpdated}`);
    if (toolsUpdated) console.log(`✅ [${callSid}] Tools updated for phase: ${intentResult.phase}`);
    return !!toolsUpdated;
  }

  /**
   * Inject text content into conversation to ensure audio generation
   * OpenAI only generates audio for natural language text, not tool calls
   */
  injectTextContent(text) {
    if (!this.openaiWs || this.openaiWs.readyState !== 1 || !text) {
      return;
    }
    
    try {
      this.openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: text
            }
          ]
        }
      }));
    } catch (err) {
      console.error(`❌ [${this.state.callSid}] Error injecting text content:`, err);
    }
  }

  /**
   * Queue server-side backup for forced set_call_language turn (runs if model omits tool call).
   * @param {string} utterance - caller text that triggered the language-selection response
   */
  async queueLanguageSelectionBackup(utterance) {
    let backupCode = 'en';
    try {
      backupCode = await inferLanguageCodeFromCallerUtterance(utterance || '');
    } catch (e) {
      console.warn(`⚠️ [${this.state.callSid}] Language inference failed, using en:`, e?.message || e);
    }
    this.state.pendingChainedToolCall = {
      toolName: 'set_call_language',
      args: { language_code: backupCode },
      callerUtteranceForLanguageBackup: utterance || ''
    };
    const prev = (utterance || '').slice(0, 80);
    console.log(
      `🌐 [${this.state.callSid}] Language selection backup queued: ${backupCode} (caller: "${prev}${(utterance || '').length > 80 ? '…' : ''}")`
    );
  }

  /**
   * After a "say-only" or forced-tool response completes, run any pending chained/recovery tool (inject function_call, execute, submit, trigger).
   * If the response output already contained a function_call for the pending tool, skip (model already called it).
   * @param {Object} [event] - response.done event (optional) to check if model already invoked the pending tool
   */
  async runPendingChainedToolIfAny(event) {
    const pending = this.state.pendingChainedToolCall;
    if (!pending || !this.openaiWs || this.openaiWs.readyState !== 1 || this.state.isClosed) {
      if (pending && (!this.openaiWs || this.openaiWs.readyState !== 1)) {
        console.warn(`⚠️ [${this.state.callSid}] Pending chained tool ${pending.toolName} skipped - ws not ready`);
      }
      return;
    }
    const outputItems = event?.response?.output || [];

    if (pending.toolName === 'set_call_language') {
      const flow = getConversationFlowState(this.state.callSid, this.state);
      if (flow.languageSelected) {
        this.state.pendingChainedToolCall = null;
        console.log(`📢 [${this.state.callSid}] Language already selected — skipping set_call_language backup`);
        return;
      }
      const modelInvokedSetLang = outputItems.some(
        item => item.type === 'function_call' && item.name === 'set_call_language'
      );
      if (modelInvokedSetLang) {
        this.state.pendingChainedToolCall = null;
        console.log(
          `📢 [${this.state.callSid}] set_call_language in model response — backup not needed`
        );
        return;
      }
      const assistantText = collectAssistantTextFromResponseOutput(outputItems);
      const fromModelJson = parseLanguageCodeFromModelOutput(assistantText);
      await multilingualService.loadLanguageMappings();
      const inferred = pending.args?.language_code || 'en';
      const callerText = pending.callerUtteranceForLanguageBackup || '';
      let code = inferred;

      if (fromModelJson && multilingualService.isValidLanguage(fromModelJson)) {
        if (fromModelJson === inferred) {
          code = fromModelJson;
          console.log(
            `🌐 [${this.state.callSid}] Language backup: assistant JSON matches inference → ${code}`
          );
        } else if (inferred !== 'en') {
          console.log(
            `🌐 [${this.state.callSid}] Language backup: ignoring assistant JSON "${fromModelJson}" (caller inference ${inferred})`
          );
        } else if (transcriptSupportsLanguageCode(callerText, fromModelJson)) {
          code = fromModelJson;
          console.log(
            `🌐 [${this.state.callSid}] Language backup: assistant JSON corroborated by transcript → ${code}`
          );
        } else {
          console.log(
            `🌐 [${this.state.callSid}] Language backup: ignoring assistant JSON "${fromModelJson}" (transcript does not support it; using ${inferred})`
          );
        }
      } else {
        console.log(`🌐 [${this.state.callSid}] Language backup: using caller inference → ${code}`);
      }
      pending.args = { language_code: code };
    }

    const modelAlreadyCalledTool = outputItems.some(
      item => item.type === 'function_call' && item.name === pending.toolName
    );
    if (modelAlreadyCalledTool) {
      this.state.pendingChainedToolCall = null;
      console.log(`📢 [${this.state.callSid}] Pending tool ${pending.toolName} already called in response - skipping auto-run`);
      return;
    }
    this.state.pendingChainedToolCall = null;
    const callSid = this.state.callSid;
    const callId = `ch_${crypto.randomBytes(4).toString('hex')}`;
    const { toolName, args } = pending;
    const argsStr = typeof args === 'string' ? args : JSON.stringify(args || {});
    try {
      this.openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call', call_id: callId, name: toolName, arguments: argsStr }
      }));
      // Register with progress indicator so periodic updates (e.g. for booking_step_lookup_contact) are scheduled and heard
      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      const getWsRef = () => (this.state.isClosed ? null : this.openaiWs);
      progressIndicatorService.scheduleAcknowledgmentAndPeriodicUpdates(
        callSid,
        toolName,
        this.openaiWs,
        conversationBehaviorConfig,
        this.state,
        getWsRef
      );
      const chainedProgressCallback = ({ message }) => {
        if (!message || this.state.toolExecutionCompleting || this.state.isInterrupted || this.state.isClosed) return;
        if (this.state.progressQueue.length >= 10) return;
        this.state.progressQueue.push({ message, queuedAt: Date.now() });
        console.log(`📥 [${callSid}] Progress queued (chained): "${message}" (queue depth: ${this.state.progressQueue.length})`);
        progressIndicatorService.scheduleQueuedProgressUpdate(callSid);
      };
      const executionResult = await toolExecutionService.executeTool({
        callId,
        callSid,
        toolCallId: callId,
        toolName,
        arguments: args,
        phoneNumber: this.state.phoneNumber,
        stateManager: this.state,
        progressCallback: chainedProgressCallback
      });
      if (executionResult?.callEnded === true) {
        this.state.pendingChainedToolCall = null;
        progressIndicatorService.endToolExecution(callSid);
        return;
      }
      await this.toolCallHandler.resultSubmitter.submitResult(callSid, callId, executionResult);
      const result = executionResult.result || executionResult;
      // Always trigger response so the caller hears the bike-type question once when requiresPreferences.
      // (Avoiding double-ask is handled by toolResultSubmitter instruction: "ask once only".)
      if (typeof this.toolCallHandler.onBeforeTriggerResponse === 'function') {
        this.toolCallHandler.onBeforeTriggerResponse(callSid);
      }
      await this.toolCallHandler.resultSubmitter.triggerResponse(callSid, {
        toolName,
        toolResult: result
      });
      progressIndicatorService.endToolExecution(callSid);
      console.log(`✅ [${callSid}] Chained tool ${toolName} executed and response triggered`);
    } catch (err) {
      console.error(`❌ [${callSid}] Chained tool ${toolName} failed:`, err);
      this.state.pendingChainedToolCall = null;
      progressIndicatorService.endToolExecution(callSid);
      throw err;
    }
  }

  /**
   * Wait for session.updated event with timeout
   * @param {number} timeoutMs - Timeout in milliseconds (default: 5000ms)
   * @returns {Promise<void>}
   */
  async waitForSessionUpdate(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.state.pendingSessionUpdatePromise = null;
        reject(new Error(`Session update timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Store the resolver so routeEvent can call it
      this.state.pendingSessionUpdatePromise = () => {
        clearTimeout(timeout);
        this.state.pendingSessionUpdatePromise = null;
        resolve();
      };
    });
  }

  /**
   * Wait for conversation.item.created event with timeout
   * @param {number} timeoutMs - Timeout in milliseconds (default: 5000ms)
   * @returns {Promise<void>}
   */
  async waitForItemCreated(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.state.pendingItemCreatePromise = null;
        reject(new Error(`Item creation timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Store the resolver so routeEvent can call it
      this.state.pendingItemCreatePromise = () => {
        clearTimeout(timeout);
        this.state.pendingItemCreatePromise = null;
        resolve();
      };
    });
  }

  /**
   * Create audio response by temporarily disabling tools
   * This ensures OpenAI generates natural language instead of tool calls
   * 
   * IMPROVED FLOW:
   * - For initial greeting: Rely on instructions (no dummy user message), disable tools, then create response
   * - For subsequent responses: Disable tools, create response, then re-enable tools
   * 
   * CRITICAL: 
   * - Always disable tools before creating response (tools are set to 'auto' in session setup)
   * - Without disabling tools, OpenAI may call tools and generate JSON/URL output instead of speech
   * - For initial greeting, we rely on instructions rather than dummy conversation items to avoid confusion
   */
  /**
   * When interrupt timeout fires with no usable transcript (e.g. noise filtered), reprompt slot choice in booking_availability.
   */
  nudgeSlotChoiceAfterInterruptionTimeout() {
    const callSid = this.state.callSid;
    const conv = conversations[callSid];
    const phase =
      this.openaiIntegration?.getCurrentWorkflowPhase?.() ??
      promptService.getWorkflowPhaseFromConversation(conv, this.state);
    const lac = conv?.lastAvailabilityCheck;
    const needsSlot =
      phase === 'booking_availability' &&
      lac?.requiresExplicitSlotChoice === true &&
      (lac?.slotCount ?? 0) > 0;
    if (!needsSlot) return;
    this.state.pendingInterruptionInstructionSuffix =
      'The caller may have been interrupted while you were listing slots. Briefly acknowledge, then ask which of the listed slots they want (by date, time, or location). If you are unsure what they said, ask one short clarifying question. Do NOT open with generic "what is your question?" or generic chit-chat.';
    this.state.forceToolChoiceNoneOnce = true;
    this.state.explicitResponseRequested = true;
    this.createAudioResponse().catch(() => {});
  }

  async createAudioResponse() {
    if (!this.openaiWs || this.openaiWs.readyState !== 1) {
      console.error(`❌ [${this.state.callSid}] WebSocket not ready: ${this.openaiWs?.readyState}`);
      return;
    }
    
    // 🚨 CRITICAL: Use atomic lock to prevent concurrent calls
    if (!this.state.tryAcquireResponseLock()) {
      console.warn(`⚠️ [${this.state.callSid}] Already responding (responseId: ${this.state.activeResponseId}), skipping duplicate createAudioResponse call`);
      return;
    }
    
    try {
      // Restore workflow state from barge-in snapshot if set (belt-and-suspenders for resume after interruption)
      const snapshot = this.state.bargeInWorkflowSnapshot;
      if (snapshot && typeof snapshot === 'object') {
        const callSid = this.state.callSid;
        if (!conversations[callSid]) conversations[callSid] = {};
        const conv = conversations[callSid];
        if ((conv.bookingSession == null) && (snapshot.bookingSession != null)) {
          conv.bookingSession = snapshot.bookingSession;
          console.log(`📋 [${callSid}] Restored bookingSession from barge-in snapshot`);
        }
        if ((conv.workflowContext == null) && (snapshot.workflowContext != null)) {
          conv.workflowContext = snapshot.workflowContext;
          console.log(`📋 [${callSid}] Restored workflowContext from barge-in snapshot`);
        }
        if ((conv.lastAvailabilityCheck == null) && (snapshot.lastAvailabilityCheck != null)) {
          conv.lastAvailabilityCheck = snapshot.lastAvailabilityCheck;
          console.log(`📋 [${callSid}] Restored lastAvailabilityCheck from barge-in snapshot`);
        }
        // Only restore phase when it wouldn't roll back an already-advanced phase (e.g. booking_start
        // set by start_workflow after the snapshot was taken with phase=greeting)
        if (snapshot.phase != null && this.openaiIntegration) {
          const currentPhase = this.openaiIntegration.getCurrentWorkflowPhase?.() ?? null;
          const wouldRollBack = snapshot.phase === 'greeting' && currentPhase != null && currentPhase !== 'greeting';
          if (!wouldRollBack) {
            this.openaiIntegration.setCurrentWorkflowPhase(snapshot.phase);
            console.log(`📋 [${callSid}] Restored workflow phase from barge-in snapshot: ${snapshot.phase}`);
          } else {
            console.log(`📋 [${callSid}] Skipped restoring phase from barge-in snapshot (current: ${currentPhase}, snapshot: ${snapshot.phase}) - phase already advanced`);
          }
        }
        this.state.bargeInWorkflowSnapshot = null;
      }

      const isInitialGreeting = !this.state.hasInitialGreetingBeenSent;
      const overrideWorkflowPhase = this.openaiIntegration?.getCurrentWorkflowPhase?.() ?? undefined;

      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      const allowMidToolEpistemic = conversationBehaviorConfig?.allowMidToolEpistemicReplies !== false;
      const browserToolExecution = progressIndicatorService.getExecutionInfo(this.state.callSid);
      const midToolEpistemicMode = Boolean(
        allowMidToolEpistemic &&
          browserToolExecution &&
          !this.state.toolExecutionCompleting &&
          this.state.waitingForUser === false
      );

      const { instructions: responseInstructions, isConsentQuestion } = await conversationService.getResponseInstructions({
        callSid: this.state.callSid,
        state: this.state,
        conversation: conversations[this.state.callSid] || {},
        hasInitialGreetingBeenSent: this.state.hasInitialGreetingBeenSent,
        overrideWorkflowPhase,
        midToolEpistemicMode,
        browserToolExecution
      });

      if (isConsentQuestion) {
        this.state.recordingConsentState.requested = true;
        this.state.recordingConsentState.requestedAt = new Date();
        const conv = conversations[this.state.callSid];
        if (conv) {
          if (!conv.recordingConsent) conv.recordingConsent = {};
          conv.recordingConsent.requested = true;
          conv.recordingConsent.requestedAt = new Date();
        }
        console.log(`📋 [${this.state.callSid}] Recording consent question being sent - marked requested`);
      }

      if (isInitialGreeting && (!this.openaiWs || this.openaiWs.readyState !== 1)) {
        console.error(`❌ [${this.state.callSid}] WebSocket closed during preparation`);
        this.state.isResponding = false;
        this.state.explicitResponseRequested = false;
        this.state.releaseResponseLock();
        return;
      }

      const { toolChoice, workflowPhase, midToolEpistemicApplied } = await conversationService.getToolChoiceForResponse({
        callSid: this.state.callSid,
        state: this.state,
        conversation: conversations[this.state.callSid] || {},
        hasInitialGreetingBeenSent: this.state.hasInitialGreetingBeenSent,
        overrideWorkflowPhase,
        browserToolExecution
      });
      const forcedSetLang =
        toolChoice &&
        typeof toolChoice === 'object' &&
        toolChoice.type === 'function' &&
        toolChoice.name === 'set_call_language';
      const sessionUpdate = forcedSetLang
        ? {
            tool_choice: toolChoice,
            tools: toolExecutor.getFilteredToolDefinitions({
              workflowPhase: 'language_selection',
              clientVerified: conversations[this.state.callSid]?.kba?.verified || false
            })
          }
        : { tool_choice: toolChoice };
      if (!forcedSetLang && toolChoice === 'auto' && workflowPhase) {
        const langSel =
          conversations[this.state.callSid]?.languagePreferenceState?.selected ||
          this.state.languagePreferenceState?.selected;
        const stillWaitingLang =
          (conversations[this.state.callSid]?.waitingForLanguage ||
            this.state.waitingForLanguage) &&
          !langSel;
        const toolContext = {
          workflowPhase,
          clientVerified: conversations[this.state.callSid]?.kba?.verified || false,
          postVerificationWaitingConfirmation: this.state.postVerificationWaitingConfirmation || false,
          allowMidCallLanguageSwitch: !!(langSel && !stillWaitingLang)
        };
        sessionUpdate.tools = toolExecutor.getFilteredToolDefinitions(toolContext);
        if (this.state.postVerificationWaitingConfirmation) {
          console.log(`📤 [${this.state.callSid}] Sending session.update - tool_choice: auto, tools exclude search_client (postVerificationWaitingConfirmation)`);
        }
      }
      if (!forcedSetLang && toolChoice === 'auto' && !sessionUpdate.tools) {
        console.log(`📤 [${this.state.callSid}] Sending session.update - tool_choice: auto for phase ${workflowPhase ?? 'unknown'}`);
      } else if (!forcedSetLang && toolChoice !== 'auto') {
        console.log(
          `📤 [${this.state.callSid}] Sending session.update to disable tools...${midToolEpistemicApplied ? ' (mid-tool epistemic)' : ''}`
        );
      } else if (forcedSetLang) {
        console.log(`📤 [${this.state.callSid}] Sending session.update - forced set_call_language`);
        await this.queueLanguageSelectionBackup(this.state.lastUtteranceForLanguageSelection || '');
      }
      this.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: sessionUpdate
      }));

      if (isInitialGreeting) {
        await new Promise(resolve => setTimeout(resolve, 150));
      } else {
        try {
          await this.waitForSessionUpdate(10000);
          console.log(`✅ [${this.state.callSid}] Session update confirmed${toolChoice === 'none' ? ' - tools disabled' : ''}`);
        } catch (err) {
          console.error(`❌ [${this.state.callSid}] Session update timeout:`, err.message);
          console.warn(`⚠️ [${this.state.callSid}] Continuing without session update confirmation`);
        }
      }

      if (!this.openaiWs || this.openaiWs.readyState !== 1) {
        console.error(`❌ [${this.state.callSid}] WebSocket closed after session.update`);
        this.state.releaseResponseLock();
        return;
      }

      // Step 3: Create response - PHASE 1: Include contextual instructions in response.create
      // Contextual instructions prevent model from falling back to full prompt (which causes code generation)
      const responseCreatePayload = {
        type: 'response.create',
        response: {
          modalities: ['audio', 'text']
        }
      };
      
      // PHASE 1: Include contextual instructions in response.create for both initial greeting and subsequent responses
      // This prevents the model from using the full prompt and generating code/JSON instead of speech
      if (responseInstructions) {
        responseCreatePayload.response.instructions = responseInstructions;
        if (isInitialGreeting) {
          console.log(`📋 [${this.state.callSid}] Including contextual instructions in response.create for initial greeting`);
        } else {
          console.log(`📋 [${this.state.callSid}] Including contextual instructions in response.create for subsequent response`);
        }
      }
      
      console.log(`📤 [${this.state.callSid}] Sending response.create, WebSocket state: ${this.openaiWs.readyState}`);
      
      // Lock already acquired by tryAcquireResponseLock()
      this.openaiWs.send(JSON.stringify(responseCreatePayload));
      
      // Step 4: Re-enable tools after delay (skip unconditional auto if browser step still running — toolResultSubmitter restores later)
      const callSidForReenable = this.state.callSid;
      const useConditionalReenable = midToolEpistemicMode === true && midToolEpistemicApplied === true;
      const openaiWsRef = this.openaiWs;
      const MID_TOOL_REENABLE_POLL_MS = 800;
      const MID_TOOL_REENABLE_FORCE_MS = 20000;
      setTimeout(() => {
        if (!openaiWsRef || openaiWsRef.readyState !== 1) return;
        if (useConditionalReenable) {
          if (!progressIndicatorService.getExecutionInfo(callSidForReenable)) {
            openaiWsRef.send(JSON.stringify({
              type: 'session.update',
              session: {
                tool_choice: 'auto'
              }
            }));
            console.log(`📤 [${callSidForReenable}] Re-enabled tool_choice auto after mid-tool epistemic (execution finished)`);
          } else {
            console.log(
              `⏭️ [${callSidForReenable}] Skipped tool_choice auto re-enable — browser tool still active (polling until clear or safety timeout)`
            );
            let done = false;
            let poll = null;
            let forceTimer = null;
            const finish = (reason) => {
              if (done || !openaiWsRef || openaiWsRef.readyState !== 1) return;
              done = true;
              if (poll) clearInterval(poll);
              if (forceTimer) clearTimeout(forceTimer);
              openaiWsRef.send(JSON.stringify({
                type: 'session.update',
                session: { tool_choice: 'auto' }
              }));
              console.log(`📤 [${callSidForReenable}] Re-enabled tool_choice auto after mid-tool epistemic (${reason})`);
            };
            poll = setInterval(() => {
              if (!openaiWsRef || openaiWsRef.readyState !== 1) {
                if (poll) clearInterval(poll);
                if (forceTimer) clearTimeout(forceTimer);
                return;
              }
              if (!progressIndicatorService.getExecutionInfo(callSidForReenable)) {
                finish('browser execution cleared');
              }
            }, MID_TOOL_REENABLE_POLL_MS);
            forceTimer = setTimeout(() => finish('safety timeout while execution still marked active'), MID_TOOL_REENABLE_FORCE_MS);
          }
          return;
        }
        openaiWsRef.send(JSON.stringify({
          type: 'session.update',
          session: {
            tool_choice: 'auto'
          }
        }));
      }, 3000);
      
    } catch (err) {
      console.error(`❌ [${this.state.callSid}] Error creating audio response:`, err);
      // Reset state on error
      this.state.hasInitialGreetingBeenSent = false;
      this.state.releaseResponseLock();
      this.state.pendingSessionUpdatePromise = null;
      this.state.pendingItemCreatePromise = null;
    }
  }

  /**
   * Dedicated path: user said "yes proceed" in cancellation phase → force CRM login step
   * without relying on a tool call in that turn (tools are normally disabled for transcription responses).
   * @param {{ alreadyHaveLock?: boolean }} options - Set alreadyHaveLock true when caller already holds response lock (e.g. speech_stopped path).
   */
  async handleCancellationProceedToLogin(options = {}) {
    const callSid = this.state.callSid;
    if (!this.openaiWs || this.openaiWs.readyState !== 1) return;
    if (!options.alreadyHaveLock && !this.state.tryAcquireResponseLock()) {
      console.warn(`⚠️ [${callSid}] Skipping cancellation proceed - response lock busy`);
      return;
    }
    try {
      const session = sessionStateManager.getSession(callSid);
      const courseType = session?.courseType || conversations[callSid]?.bookingSession?.courseType || 'CBT';
      sessionStateManager.initializeSession(callSid, courseType);
      sessionStateManager.setCancellationCurrentStep(callSid, 1, { verified: true });
      const instructions = `CRITICAL: Say exactly: "${AFTER_LOGIN_MESSAGE}" Then you MUST call the tool cancellation_step_authenticate with courseType: "${courseType}". No other text. Do not wait for the caller. Call the tool in the same response.`;
      this.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: { tool_choice: { type: 'function', name: 'cancellation_step_authenticate' } }
      }));
      try {
        await this.waitForSessionUpdate(5000);
      } catch (err) {
        console.warn(`⚠️ [${callSid}] Session update wait timeout, continuing with response.create:`, err.message);
      }
      if (this.openaiWs.readyState !== 1) {
        if (!options.alreadyHaveLock) this.state.releaseResponseLock();
        return;
      }
      this.openaiWs.send(JSON.stringify({
        type: 'response.create',
        response: { modalities: ['audio', 'text'], instructions }
      }));
      console.log(`🎯 [${callSid}] Cancellation proceed: forced cancellation_step_authenticate (courseType: ${courseType})`);
      setTimeout(() => {
        if (this.openaiWs && this.openaiWs.readyState === 1) {
          this.openaiWs.send(JSON.stringify({ type: 'session.update', session: { tool_choice: 'auto' } }));
        }
      }, 3000);
    } catch (err) {
      console.error(`❌ [${callSid}] handleCancellationProceedToLogin error:`, err);
      if (!options.alreadyHaveLock) this.state.releaseResponseLock();
    }
  }

  /**
   * Set OpenAI integration reference (for phase/tool updates)
   */
  setOpenAIIntegration(openaiIntegration) {
    this.openaiIntegration = openaiIntegration;
  }

  /**
   * Update OpenAI WebSocket reference (called after connection is established)
   */
  setOpenAIWebSocket(openaiWs) {
    this.openaiWs = openaiWs;
    // Update transcription handler with openaiWs
    if (this.transcriptionHandler) {
      this.transcriptionHandler.openaiWs = openaiWs;
    }
    // Update tool call handler with openaiWs
    if (this.toolCallHandler) {
      this.toolCallHandler.setOpenAIWebSocket(openaiWs);
    }
    // Update barge-in handler with openaiWs
    if (this.bargeInHandler) {
      this.bargeInHandler.openaiWs = openaiWs;
    }
  }

  /**
   * Route OpenAI events to appropriate handlers
   */
  async routeEvent(event) {
    if (!event || !event.type) {
      return;
    }
    
    // Periodic cleanup of old audio segments (prevent memory leaks)
    // Clean up every 10th event to avoid overhead
    if (Math.random() < 0.1) {
      this.state.cleanupOldSegments();
    }
    
    // Remove verbose logging - not needed for format testing
    
    try {
      // Route based on event type
      switch (event.type) {
        case 'session.updated':
          // Only log format info
          console.log(`📋 [${this.state.callSid}] Session updated - output_audio_format: ${event.session?.output_audio_format || 'N/A'}`);
          
          // Resolve pending session update promise if waiting
          if (this.state.pendingSessionUpdatePromise) {
            this.state.pendingSessionUpdatePromise();
          }
          if (typeof this.state.flushSessionUpdatedWaiters === 'function') {
            this.state.flushSessionUpdatedWaiters();
          }

          await this.handleSessionUpdated(event);
          break;
          
        case 'response.created':
          this.responseHandler.handleResponseCreated(event);
          break;
          
        case 'conversation.item.created':
          // Resolve pending item create promise if waiting (for any role, not just assistant)
          if (this.state.pendingItemCreatePromise) {
            console.log(`✅ [${this.state.callSid}] Resolving pending item create promise (role: ${event.item?.role})`);
            this.state.pendingItemCreatePromise();
          }
          
          if (event.item?.role === 'assistant') {
            this.responseHandler.handleItemCreated(event);
          }
          break;
          
        case 'response.audio.delta':
        case 'response.output_audio.delta':
          this.responseHandler.handleAudioDelta(event);
          break;
          
        case 'response.text.done':
          break;
        case 'response.output_audio_transcript.done':
          if (this.state.activeResponseId && (event.transcript != null || this.state.currentResponseOutputTranscript)) {
            this.state.currentResponseOutputTranscript = (event.transcript != null && event.transcript !== '') ? event.transcript : (this.state.currentResponseOutputTranscript || '');
            const t = this.state.currentResponseOutputTranscript || '';
            const preview = t.length > 80 ? t.slice(0, 80) + '...' : t;
            console.log(`[AGENT-DEBUG] [${this.state.callSid}] response.output_audio_transcript.done: len=${t.length}, activeResponseId=${this.state.activeResponseId}, preview="${preview}"`);
          }
          break;
        case 'response.output_audio_transcript.delta':
          if (event.delta != null && this.state.activeResponseId) {
            const prevLen = (this.state.currentResponseOutputTranscript || '').length;
            this.state.currentResponseOutputTranscript = (this.state.currentResponseOutputTranscript || '') + (event.delta || '');
            if (prevLen === 0) {
              console.log(`[AGENT-DEBUG] [${this.state.callSid}] response.output_audio_transcript.delta: first chunk for response ${this.state.activeResponseId}`);
            }
          }
          break;

        case 'response.done':
          this.responseHandler.handleResponseDone(event);
          break;
          
        case 'input_audio_buffer.speech_started':
          await this.bargeInHandler.handleSpeechStarted(event);
          break;
          
        case 'conversation.item.input_audio_transcription.delta':
          // INDUSTRY STANDARD: Handle partial transcription deltas for faster "stop" detection
          // This enables barge-in detection in 150-300ms vs 300-800ms for completed events
          await this.transcriptionHandler.handleTranscriptionDelta(event);
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          // CRITICAL DIAGNOSTIC: Log ALL transcription events to diagnose why "stop" isn't detected
          console.log(`📝 [${this.state.callSid}] Transcription.completed event received:`);
          console.log(`   - item_id: ${event.item_id || 'N/A'}`);
          console.log(`   - transcript: "${event.transcript || 'N/A'}"`);
          console.log(`   - confidence: ${event.confidence || 'N/A'}`);
          console.log(`   - Barge-in already triggered: ${this.state.isInterrupted}`);
          console.log(`   - Audio playing: isResponding=${this.state.isResponding}, activeResponseId=${this.state.activeResponseId}`);
          
          const transcriptionResult = await this.transcriptionHandler.handleTranscriptionCompleted(event);
          const transcriptionItemId = event.item_id; // Link to committed segment
          
          const transcriptText = mergeWithBargeInFlushedGrace(this.state.callSid, event.transcript || '');
          this.applyIntentFromTranscript(transcriptText);

          // CRITICAL DIAGNOSTIC: Log transcription processing result
          console.log(`📝 [${this.state.callSid}] Transcription processing result:`);
          console.log(`   - processed: ${transcriptionResult?.processed}`);
          console.log(`   - shouldCreateResponse: ${transcriptionResult?.shouldCreateResponse}`);
          console.log(`   - isBackgroundNoise: ${transcriptionResult?.isBackgroundNoise}`);
          console.log(`   - qualityScore: ${transcriptionResult?.qualityScore}`);
          console.log(`   - reason: ${transcriptionResult?.reason || 'N/A'}`);
          
          // CRITICAL: Check if this is background noise - if so, DO NOT create response
          // This breaks the feedback loop where agent keeps responding to noise
          if (transcriptionResult?.isBackgroundNoise) {
            console.log(`🔇 [${this.state.callSid}] BLOCKED response - background noise detected (reason: ${transcriptionResult.reason}, quality: ${transcriptionResult.qualityScore})`);
            
            // CRITICAL: Ensure agent stays in listening mode when noise is detected
            // This prevents the feedback loop
            this.state.waitingForUser = true;
            
            // Clean up segment tracking
            if (transcriptionItemId && this.state.pendingAudioSegments.has(transcriptionItemId)) {
              // Keep segment data for potential future reference, but mark as noise
              const segment = this.state.pendingAudioSegments.get(transcriptionItemId);
              segment.isBackgroundNoise = true;
            }
            
            // no_alpha fallback: if the caller's speech was blocked because it contained no Latin
            // letters (non-English script, pure punctuation), they're probably a real speaker whose
            // language wasn't recognised. After 2 consecutive no_alpha blocks, send ONE clarification
            // so the caller isn't left in silence. Other noise reasons (too_short, low_confidence, etc.)
            // reset the counter — they indicate different acoustic conditions.
            if (transcriptionResult.reason === 'no_alpha') {
              this.state._consecutiveNoAlphaCount = (this.state._consecutiveNoAlphaCount || 0) + 1;
              const cooldownActive = this.state._lastNoAlphaClarificationTime &&
                (Date.now() - this.state._lastNoAlphaClarificationTime) < 30000;
              if (this.state._consecutiveNoAlphaCount >= 2 && !cooldownActive) {
                console.log(`🗣️ [${this.state.callSid}] no_alpha fallback: ${this.state._consecutiveNoAlphaCount} consecutive blocks — sending clarification`);
                this.state._consecutiveNoAlphaCount = 0;
                this.state._lastNoAlphaClarificationTime = Date.now();
                this.state.pendingInterruptionInstructionSuffix =
                  'The caller spoke but the system could not understand the words. Say a brief, friendly clarification such as "I\'m sorry, I didn\'t quite catch that. Could you please repeat that for me?" Do NOT mention technical reasons. Do not call any tools.';
                this.state.forceToolChoiceNoneOnce = true;
                this.state.explicitResponseRequested = true;
                this.createAudioResponse().catch(() => {});
              }
            } else {
              this.state._consecutiveNoAlphaCount = 0;
            }
            
            // DO NOT create response - break the loop
            break;
          }
          
          const flowState = getConversationFlowState(this.state.callSid, this.state);
          const consentJustResponded =
            flowState.consentResponded &&
            this.state.agentFinishedSpeakingTime > 0 &&
            Date.now() - this.state.agentFinishedSpeakingTime < 5000;
          const inConsentOrLanguagePhase =
            flowState.waitingForLanguage ||
            (flowState.languageSelected && !flowState.consentResponded) ||
            consentJustResponded;
          const stateSnapshot = {
            waitingForUser: this.state.waitingForUser,
            browserToolExecution: progressIndicatorService.getExecutionInfo(this.state.callSid),
            toolExecutionCompleting: this.state.toolExecutionCompleting === true,
            isResponding: this.state.isResponding,
            activeResponseId: this.state.activeResponseId,
            hasInitialGreetingCompleted: this.state.hasInitialGreetingCompleted,
            outboundAudioPacer: this.state.outboundAudioPacer,
            outboundAudioBuffer: this.state.outboundAudioBuffer,
            bargeInTailUntil: this.state.bargeInTailUntil,
            inConsentOrLanguagePhase
          };
          const shouldCreateResponse = conversationService.shouldCreateResponse(transcriptionResult, stateSnapshot);

          if (shouldCreateResponse) {
            this.state._consecutiveNoAlphaCount = 0;
            try {
              console.log(`[RESPONSE-SOURCE] [${this.state.callSid}] transcription.completed`);
              this.state.explicitResponseRequested = true;
              await this.createAudioResponse();
              // Prevent grace period from using stale transcripts: drop this utterance and anything older
              if (this.state.pendingTranscriptionsAfterGrace?.length) {
                const cut = transcriptionResult?.transcriptionTime;
                if (typeof cut === 'number') {
                  const before = this.state.pendingTranscriptionsAfterGrace.length;
                  this.state.pendingTranscriptionsAfterGrace = this.state.pendingTranscriptionsAfterGrace.filter(
                    t => (t?.time ?? 0) > cut
                  );
                  const dropped = before - this.state.pendingTranscriptionsAfterGrace.length;
                  if (dropped > 0) {
                    console.log(
                      `🧹 [${this.state.callSid}] Grace queue: removed ${dropped} transcript(s) with time<=${cut} after immediate response`
                    );
                  }
                } else {
                  this.state.pendingTranscriptionsAfterGrace = this.state.pendingTranscriptionsAfterGrace.filter(
                    t => (t?.transcript || '').trim() !== (transcriptText || '').trim()
                  );
                }
              }
              console.log(`🎯 [${this.state.callSid}] Created response after high-quality transcription (quality: ${transcriptionResult.qualityScore?.toFixed(2)})`);
              if (isTransferToHumanRequest(transcriptText)) {
                try {
                  const callContext = { callSid: this.state.callSid, phoneNumber: this.state.phoneNumber };
                  const result = await transferCallTool.execute({ reason: 'user_request' }, callContext);
                  if (result?.transferInitiated) {
                    console.log(`✅ [${this.state.callSid}] App-invoked transfer_call after user request (Option B)`);
                  } else if (result?.allTransferNumbersFailed) {
                    console.warn(`⚠️ [${this.state.callSid}] Transfer requested but all numbers failed: ${result?.messageForCaller || 'agents busy'}`);
                  }
                } catch (transferErr) {
                  console.error(`❌ [${this.state.callSid}] Error invoking transfer_call after user request:`, transferErr?.message || transferErr);
                }
              }
            } catch (err) {
              console.error(`❌ [${this.state.callSid}] Error creating response after transcription:`, err);
            }
          } else if (!shouldCreateResponse && transcriptionResult?.processed === false) {
            console.log(`🔇 [${this.state.callSid}] Blocked response - transcription filtered (reason: ${transcriptionResult.reason}, quality: ${transcriptionResult.qualityScore?.toFixed(2)})`);
          } else if (!shouldCreateResponse && (transcriptionResult?.qualityScore ?? 1) < 0.7) {
            console.log(`🔇 [${this.state.callSid}] Blocked response - quality score too low (${transcriptionResult.qualityScore?.toFixed(2)} < 0.7)`);
          }
          break;
          
        case 'input_audio_buffer.speech_stopped':
          console.log(`🔍 [TEST-3] [${this.state.callSid}] SPEECH_STOPPED EVENT RECEIVED - routing to handler`);
          const speechStoppedResult = await this.transcriptionHandler.handleSpeechStopped(event);
          console.log(`🔍 [TEST-3] [${this.state.callSid}] SPEECH_STOPPED HANDLED - result type: ${speechStoppedResult?.type || 'null'}`);
          // Handle process_transcriptions return value
          if (speechStoppedResult && speechStoppedResult.type === 'process_transcriptions') {
            const transcriptions = speechStoppedResult.transcriptions || [];
            const joinedBatch = transcriptions.map(t => t?.transcript).filter(Boolean).join(' ').trim();
            const mergedBatch = mergeWithBargeInFlushedGrace(this.state.callSid, joinedBatch);
            if (mergedBatch) {
              this.applyIntentFromTranscript(mergedBatch);
            }
            const flowStateSt = getConversationFlowState(this.state.callSid, this.state);
            const consentJustSt =
              flowStateSt.consentResponded &&
              this.state.agentFinishedSpeakingTime > 0 &&
              Date.now() - this.state.agentFinishedSpeakingTime < 5000;
            const inConsentOrLanguagePhaseSt =
              flowStateSt.waitingForLanguage ||
              (flowStateSt.languageSelected && !flowStateSt.consentResponded) ||
              consentJustSt;
            const syntheticSpeechStopped = {
              processed: true,
              shouldCreateResponse: true,
              qualityScore: 1,
              isBackgroundNoise: false
            };
            const snapshotSpeechStopped = {
              waitingForUser: this.state.waitingForUser,
              browserToolExecution: progressIndicatorService.getExecutionInfo(this.state.callSid),
              toolExecutionCompleting: this.state.toolExecutionCompleting === true,
              isResponding: this.state.isResponding,
              activeResponseId: this.state.activeResponseId,
              hasInitialGreetingCompleted: this.state.hasInitialGreetingCompleted,
              outboundAudioPacer: this.state.outboundAudioPacer,
              outboundAudioBuffer: this.state.outboundAudioBuffer,
              bargeInTailUntil: this.state.bargeInTailUntil,
              inConsentOrLanguagePhase: inConsentOrLanguagePhaseSt
            };
            const shouldCreateFromSpeechStopped = conversationService.shouldCreateResponse(
              syntheticSpeechStopped,
              snapshotSpeechStopped
            );
            if (mergedBatch && shouldCreateFromSpeechStopped && !this.state.isInterrupted) {
              if (this.state.isResponding && this.state.activeResponseId === null) {
                console.warn(
                  `⚠️ [${this.state.callSid}] Releasing stuck response lock before speech_stopped process_transcriptions`
                );
                this.state.forceReleaseResponseLock();
              }
              try {
                if (this.state.isInterrupted) {
                  console.log(`🛑 [${this.state.callSid}] Skipping response creation - user interrupted before create`);
                  return;
                }
                console.log(`[RESPONSE-SOURCE] [${this.state.callSid}] speech_stopped process_transcriptions`);
                this.state.explicitResponseRequested = true;
                await this.createAudioResponse();
                console.log(`🎯 [${this.state.callSid}] Created response after processing ${transcriptions.length} transcriptions`);
                if (mergedBatch && isTransferToHumanRequest(mergedBatch)) {
                  try {
                    const callContext = { callSid: this.state.callSid, phoneNumber: this.state.phoneNumber };
                    const result = await transferCallTool.execute({ reason: 'user_request' }, callContext);
                    if (result?.transferInitiated) {
                      console.log(`✅ [${this.state.callSid}] App-invoked transfer_call after user request (Option B, grace-period path)`);
                    } else if (result?.allTransferNumbersFailed) {
                      console.warn(`⚠️ [${this.state.callSid}] Transfer requested but all numbers failed: ${result?.messageForCaller || 'agents busy'}`);
                    }
                  } catch (transferErr) {
                    console.error(`❌ [${this.state.callSid}] Error invoking transfer_call after user request:`, transferErr?.message || transferErr);
                  }
                }
              } catch (err) {
                console.error(`❌ [${this.state.callSid}] Error creating response after processing transcriptions:`, err);
                this.state.releaseResponseLock();
              }
            }
          }
          // Handle acknowledge_interruption return value
          // Do not call tryAcquireResponseLock here — createAudioResponse() acquires the lock. Pre-acquiring would
          // always fail the inner tryAcquire (double-acquire bug).
          if (speechStoppedResult && speechStoppedResult.type === 'acknowledge_interruption') {
            if (this.state.waitingForUser && !this.state.isInterrupted) {
              if (this.state.isResponding && this.state.activeResponseId === null) {
                console.warn(
                  `⚠️ [${this.state.callSid}] Releasing stuck response lock (isResponding with null activeResponseId) before acknowledge_interruption`
                );
                this.state.forceReleaseResponseLock();
              }
              try {
                if (this.state.isInterrupted) {
                  console.log(`🛑 [${this.state.callSid}] Skipping acknowledgment response - user interrupted before create`);
                  return;
                }
                console.log(`[RESPONSE-SOURCE] [${this.state.callSid}] acknowledge_interruption`);
                this.state.explicitResponseRequested = true;
                await this.createAudioResponse();
                console.log(`🎯 [${this.state.callSid}] Created response to acknowledge interruption`);
              } catch (err) {
                console.error(`❌ [${this.state.callSid}] Error creating response for interruption:`, err);
                this.state.releaseResponseLock();
              }
            }
          }
          break;
          
        case 'response.output_item.done':
          if (event.item?.type === 'function_call') {
            await this.toolCallHandler.handleToolCall(event);
          }
          break;
          
        case 'input_audio_buffer.committed':
          // CRITICAL: Track committed audio segments to prevent automatic responses from background noise
          // OpenAI may auto-create responses when buffer is committed, but we need to verify transcription quality first
          const itemId = event.item_id;
          const committedAt = Date.now();
          
          if (itemId) {
            // Track this segment - transcription will arrive later via transcription.completed event
            this.state.pendingAudioSegments.set(itemId, {
              timestamp: committedAt,
              committedAt,
              transcriptionReceived: false,
              transcriptionQuality: null,
              isBackgroundNoise: null
            });
            
            console.log(`📦 [${this.state.callSid}] Audio buffer committed (item: ${itemId}) - waiting for transcription to verify quality`);
            
            // CRITICAL: DO NOT create response here - wait for transcription.completed event
            // This prevents responses from being created for background noise
            // Response will only be created if transcription passes quality checks
          }
          break;
          
        default:
          // Unhandled event type - log for debugging
          if (event.type && !event.type.startsWith('response.function_call_arguments')) {
            // Don't log verbose events that are handled elsewhere
            const verboseEvents = [
              'response.text.delta',
              'response.content_part.done',
              'response.output_item.added',
              'response.content_part.added',
              'rate_limits.updated',
              'response.audio_transcript.delta',
              'response.audio_transcript.done'
            ];
            
            if (!verboseEvents.includes(event.type)) {
            console.log(`📋 [${this.state.callSid}] Unhandled event type: ${event.type}`);
              // Only log full event for critical errors
              if (event.type.includes('error')) {
                console.log(`   Full Unhandled Event: ${JSON.stringify(event, null, 2)}`);
              }
            }
          }
          break;
      }
    } catch (error) {
      console.error(`❌ [${this.state.callSid}] Error routing event ${event.type}:`, error);
      this.state.incrementErrorCount();
      
      if (this.state.hasMaxErrors()) {
        return { error: 'max_errors_reached' };
      }
    }
    
    return null;
  }

  /**
   * Handle session.updated event
   */
  async handleSessionUpdated(event) {
    console.log(`✅ Session updated for call: ${this.state.callSid}`);
    this.state.resetErrorCount();
    
    // Send initial greeting if not already sent
    if (this.state.isClosed || !this.openaiWs || this.openaiWs.readyState !== 1) {
      return;
    }
    
    if (!this.state.hasInitialGreetingBeenSent && !this.state.isResponding && this.state.activeResponseId === null) {
      try {
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Double-check WebSocket is still open after delay
        if (this.state.isClosed || !this.openaiWs || this.openaiWs.readyState !== 1) {
          console.warn(`⚠️ [${this.state.callSid}] WebSocket closed during delay, skipping initial greeting`);
          return;
        }
        
        this.state.explicitResponseRequested = true;
        
        // CRITICAL FIX: Use createAudioResponse to disable tools and ensure natural language
        // Instructions already include the greeting text, so no need to pass it
        await this.createAudioResponse();
        
        this.state.hasInitialGreetingBeenSent = true;
        this.state.isResponding = true;
        console.log(`✅ [${this.state.callSid}] Initial greeting sent`);
        
        // Consent: we do NOT set a timeout that defaults to opt-in. We only proceed after a clear yes/no.
        if (this.state.recordingConsentState.requested && this.state.recordingConsentState.given === null) {
          console.log(`⏱️ [${this.state.callSid}] Waiting for clear consent response (yes/no) - no timeout default`);
        }
      } catch (err) {
        this.state.explicitResponseRequested = false;
        this.state.isResponding = false;
        this.state.hasInitialGreetingBeenSent = false;
        this.state.incrementErrorCount();
        console.error(`❌ [${this.state.callSid}] Error sending initial greeting:`, err);
      }
    }
  }

  /**
   * Cleanup all handlers
   */
  cleanup() {
    if (this.responseHandler && typeof this.responseHandler.cleanup === 'function') {
      this.responseHandler.cleanup();
    }
  }
}
