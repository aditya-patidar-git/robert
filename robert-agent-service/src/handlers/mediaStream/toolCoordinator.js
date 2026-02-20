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
    this.bargeInHandler = new BargeInHandler(stateManager, openaiWs, this.responseHandler);
    
    this.consentHandler = consentHandler;
    this.transcriptionHandler = new TranscriptionHandler(stateManager, languageDetector, consentHandler, openaiWs, this.bargeInHandler, (text) => this.applyIntentFromTranscript(text), () => this.openaiIntegration?.getCurrentWorkflowPhase?.());
    this.toolCallHandler = new ToolCallHandler(stateManager, openaiWs, {
      onBeforeTriggerResponse: (callSid, context) => {
        const conv = conversations[callSid];
        const lastUser = conv?.transcript?.filter(t => t.role === 'user').pop();
        if (lastUser?.text?.trim()) this.applyIntentFromTranscript(lastUser.text);
        // Keep payment phase when process_payment fails so next response (e.g. after user says "read them out") stays in payment context
        if (context?.toolName === 'booking_step_process_payment' && context?.toolResult?.success === false && this.openaiIntegration) {
          this.openaiIntegration.setCurrentWorkflowPhase('booking_payment');
        }
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
    console.log(`🔍 [INTENT] [${callSid}] detectIntent result: shouldUpdateTools=${intentResult?.shouldUpdateTools}, newWorkflowContext=${intentResult?.newWorkflowContext}, phase=${intentResult?.phase}`);
    if (!intentResult.shouldUpdateTools || !intentResult.newWorkflowContext) return false;
    if (!conversations[callSid]) conversations[callSid] = {};
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
    // If the model already called this tool in the response, do not run again (avoid duplicate execution)
    const outputItems = event?.response?.output || [];
    const modelAlreadyCalledTool = outputItems.some(item => item.type === 'function_call' && item.name === pending.toolName);
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
      const executionResult = await toolExecutionService.executeTool({
        callId,
        callSid,
        toolCallId: callId,
        toolName,
        arguments: args,
        phoneNumber: this.state.phoneNumber,
        stateManager: this.state,
        progressCallback: null
      });
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
      console.log(`✅ [${callSid}] Chained tool ${toolName} executed and response triggered`);
    } catch (err) {
      console.error(`❌ [${callSid}] Chained tool ${toolName} failed:`, err);
      this.state.pendingChainedToolCall = null;
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
      const isInitialGreeting = !this.state.hasInitialGreetingBeenSent;
      const overrideWorkflowPhase = this.openaiIntegration?.getCurrentWorkflowPhase?.() ?? undefined;

      const { instructions: responseInstructions, isConsentQuestion } = await conversationService.getResponseInstructions({
        callSid: this.state.callSid,
        state: this.state,
        conversation: conversations[this.state.callSid] || {},
        hasInitialGreetingBeenSent: this.state.hasInitialGreetingBeenSent,
        overrideWorkflowPhase
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

      const { toolChoice, workflowPhase } = await conversationService.getToolChoiceForResponse({
        callSid: this.state.callSid,
        state: this.state,
        conversation: conversations[this.state.callSid] || {},
        hasInitialGreetingBeenSent: this.state.hasInitialGreetingBeenSent,
        overrideWorkflowPhase
      });
      if (toolChoice === 'auto') {
        console.log(`📤 [${this.state.callSid}] Sending session.update - tool_choice: auto for phase ${workflowPhase ?? 'unknown'}`);
      } else {
        console.log(`📤 [${this.state.callSid}] Sending session.update to disable tools...`);
      }
      this.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          tool_choice: toolChoice
        }
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
      
      // Step 4: Re-enable tools after delay
      setTimeout(() => {
        if (this.openaiWs && this.openaiWs.readyState === 1) {
          this.openaiWs.send(JSON.stringify({
            type: 'session.update',
            session: {
              tool_choice: 'auto'
            }
          }));
        }
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
          
          const transcriptText = event.transcript || '';
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
            
            // DO NOT create response - break the loop
            break;
          }
          
          const flowState = getConversationFlowState(this.state.callSid, this.state);
          const consentJustGiven =
            flowState.consentGiven &&
            this.state.agentFinishedSpeakingTime > 0 &&
            Date.now() - this.state.agentFinishedSpeakingTime < 5000;
          const inConsentOrLanguagePhase =
            flowState.waitingForLanguage ||
            (flowState.languageSelected && !flowState.consentGiven) ||
            consentJustGiven;
          const stateSnapshot = {
            waitingForUser: this.state.waitingForUser,
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
            try {
              console.log(`[RESPONSE-SOURCE] [${this.state.callSid}] transcription.completed`);
              this.state.explicitResponseRequested = true;
              await this.createAudioResponse();
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
            if (transcriptions.length > 0) {
              const transcriptText = transcriptions.map(t => t?.transcript).filter(Boolean).join(' ').trim();
              if (transcriptText) this.applyIntentFromTranscript(transcriptText);
            }
            if (transcriptions.length > 0 && this.state.waitingForUser && !this.state.isResponding && this.state.activeResponseId === null && this.state.hasInitialGreetingCompleted && !this.state.isInterrupted && this.state.tryAcquireResponseLock()) {
              try {
                if (this.state.isInterrupted) {
                  console.log(`🛑 [${this.state.callSid}] Skipping response creation - user interrupted after lock acquisition`);
                  this.state.releaseResponseLock();
                  return;
                }
                const transcriptTextFromBatch = transcriptions.map(t => t?.transcript).filter(Boolean).join(' ').trim();
                console.log(`[RESPONSE-SOURCE] [${this.state.callSid}] speech_stopped process_transcriptions`);
                this.state.explicitResponseRequested = true;
                await this.createAudioResponse();
                console.log(`🎯 [${this.state.callSid}] Created response after processing ${transcriptions.length} transcriptions`);
                if (transcriptTextFromBatch && isTransferToHumanRequest(transcriptTextFromBatch)) {
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
          if (speechStoppedResult && speechStoppedResult.type === 'acknowledge_interruption') {
            // CRITICAL: Don't create acknowledgment if interrupted (user said stop)
            if (this.state.waitingForUser && !this.state.isResponding && this.state.activeResponseId === null && !this.state.isInterrupted && this.state.tryAcquireResponseLock()) {
              try {
                // Double-check interruption state after acquiring lock
                if (this.state.isInterrupted) {
                  console.log(`🛑 [${this.state.callSid}] Skipping acknowledgment response - user interrupted after lock acquisition`);
                  this.state.releaseResponseLock();
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
        
        // Set timeout for consent response if needed
        if (this.state.recordingConsentState.requested && this.state.recordingConsentState.given === null) {
          console.log(`⏱️ [${this.state.callSid}] Starting consent timeout (${this.state.CONSENT_TIMEOUT_MS/1000}s) - waiting for caller response`);
          this.state.consentTimeout = setTimeout(() => {
            // FIX: Safely check conversation state - it may have been cleaned up
            if (!conversationExists(this.state.callSid)) {
              console.warn(`⚠️ [${this.state.callSid}] Conversation cleaned up, skipping consent timeout handler`);
              return;
            }
            
            const consent = getRecordingConsent(this.state.callSid);
            if (this.state.recordingConsentState.given === null && consent && consent.given === null) {
              this.state.recordingConsentState.given = true;
              this.state.recordingConsentState.respondedAt = new Date();
              updateRecordingConsent(this.state.callSid, {
                given: true,
                respondedAt: new Date(),
                optOutReason: null
              });
              console.log(`⏰ [${this.state.callSid}] Recording consent timeout expired - defaulting to opt-in`);
            }
          }, this.state.CONSENT_TIMEOUT_MS);
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
