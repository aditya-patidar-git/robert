import configManager from '../../../agent/configManager.js';
import adaptiveTimingService from '../../../services/adaptiveTimingService.js';
import silenceDetectionService from '../../../services/silenceDetectionService.js';
import complaintDetectionService from '../../../services/complaintDetectionService.js';
import promptService from '../../../services/promptService.js';
import conversationService from '../../../services/conversationService.js';
import noiseFilterService from '../../../services/noiseFilterService.js';
import { appendTranscriptEntry } from '../../../services/transcriptPersistenceService.js';
import { resolveTranscriptionLanguage } from '../../../services/multilingualService.js';
import { getConversationFlowState } from '../utils/conversationStateHelpers.js';
import { storePrematureResponse } from '../../../services/toolResultSubmitter.js';
import { conversations } from '../../../shared/state.js';
import { LanguageDetector } from '../utils/languageDetector.js';
import { isAgentAudioPlaying } from '../utils/audioPlayingState.js';
import { mergeWithBargeInFlushedGrace } from '../utils/graceBufferMerge.js';
import progressIndicatorService from '../../../services/progressIndicatorService.js';
import toolExecutor from '../../../tools/index.js';

/** Snapshot for conversationService.shouldCreateResponse (Media Streams). */
function buildResponseDecisionSnapshot(state, callSid, inConsentOrLanguagePhase) {
  return {
    waitingForUser: state.waitingForUser,
    browserToolExecution: progressIndicatorService.getExecutionInfo(callSid),
    toolExecutionCompleting: state.toolExecutionCompleting === true,
    isResponding: state.isResponding,
    activeResponseId: state.activeResponseId,
    hasInitialGreetingCompleted: state.hasInitialGreetingCompleted,
    outboundAudioPacer: state.outboundAudioPacer,
    outboundAudioBuffer: state.outboundAudioBuffer,
    bargeInTailUntil: state.bargeInTailUntil,
    inConsentOrLanguagePhase
  };
}

/**
 * Transcription Handler
 * Handles user transcriptions and speech stopped events
 * Barge-in / audio halt is driven by speech_started; completed transcripts drive pause-and-reply
 */
const POST_BARGE_IN_GRACE_MS = 5000;

export class TranscriptionHandler {
  constructor(
    stateManager,
    languageDetector,
    consentHandler,
    openaiWs,
    bargeInHandler = null,
    onApplyIntentFromTranscript = null,
    onGetWorkflowPhase = null,
    queueLanguageSelectionBackup = null,
    createAudioResponseFn = null,
    onInterruptionTimeoutNudge = null
  ) {
    this.state = stateManager;
    this.languageDetector = languageDetector;
    this.consentHandler = consentHandler;
    this.openaiWs = openaiWs;
    this.bargeInHandler = bargeInHandler;
    this.onApplyIntentFromTranscript = onApplyIntentFromTranscript;
    this.onGetWorkflowPhase = onGetWorkflowPhase;
    this.queueLanguageSelectionBackup = queueLanguageSelectionBackup;
    /** When set, grace-period completion delegates to ToolCoordinator.createAudioResponse (mid-tool gating + conditional re-enable). */
    this.createAudioResponseFn = createAudioResponseFn;
    /** Optional: e.g. slot-choice reprompt when interrupt timeout fires with no usable transcript */
    this.onInterruptionTimeoutNudge = onInterruptionTimeoutNudge;
  }

  appendUserTurnToTranscript(transcript, transcriptionTime, qualityAssessment, conversations) {
    if (!transcript || !this.state.callSid || !conversations) return;
    const conv = conversations[this.state.callSid];
    if (!conv) return;
    if (!conv.transcript) conv.transcript = [];
    conv.transcript.push({
      role: 'user',
      text: transcript,
      timestamp: new Date(transcriptionTime),
      confidence: qualityAssessment?.confidenceScore ?? 0.8
    });
  }

  /**
   * Handle transcription.delta event (partial transcription)
   * Does not trigger barge-in — speech_started handles instant halt; deltas are not used for keyword gating
   */
  async handleTranscriptionDelta(_event) {
    return null;
  }

  /**
   * Handle transcription.completed event
   */
  async handleTranscriptionCompleted(event) {
    const transcript = event.transcript || '';
    const confidence = event.confidence || 1.0;
    const itemId = event.item_id || null; // Link to committed audio segment
    const transcriptionTime = Date.now();

    console.log(`[CALLER] [${this.state.callSid}] "${transcript}"`);

    const msSinceCancellation =
      this.state.lastCancellationTime > 0
        ? Date.now() - this.state.lastCancellationTime
        : Infinity;
    const postBargeInGrace =
      this.state.isInterrupted === true ||
      (this.state.lastCancellationTime > 0 && msSinceCancellation < POST_BARGE_IN_GRACE_MS);
    const isRecentCancellation = this.state.lastCancellationTime > 0 && msSinceCancellation < 3000;

    // CRITICAL: Industry-standard multi-factor background noise filtering
    // Uses confidence, pattern matching, length, and character composition
    const qualityAssessment = noiseFilterService.assessTranscriptionQuality(
      transcript,
      confidence,
      itemId,
      { postBargeInGrace }
    );
    
    // Check for response loop prevention (recent response + noise = prevent loop)
    const timeSinceLastResponse = this.state.agentFinishedSpeakingTime > 0 
      ? Date.now() - this.state.agentFinishedSpeakingTime 
      : Infinity;
    const shouldPreventLoop = noiseFilterService.shouldPreventResponseLoop(transcript, timeSinceLastResponse, {
      postBargeInGrace
    });
    
    // Log ALL transcriptions (even filtered ones) for debugging
    if (!qualityAssessment.isHighQuality || shouldPreventLoop) {
      const reason = shouldPreventLoop ? 'response_loop_prevention' : qualityAssessment.reason;
      console.log(`🔇 [${this.state.callSid}] Filtered background noise: "${transcript}" (confidence: ${qualityAssessment.confidenceScore}, quality: ${qualityAssessment.qualityScore}, reason: ${reason})`);
      
      if (this.state.isInterrupted && isAgentAudioPlaying(this.state) && this.bargeInHandler?.responseHandler) {
        this.bargeInHandler.responseHandler.immediatelyStopAudio();
      }
      
      // Mark segment as having received transcription (even if filtered)
      if (itemId && this.state.pendingAudioSegments.has(itemId)) {
        const segment = this.state.pendingAudioSegments.get(itemId);
        segment.transcriptionReceived = true;
        segment.transcriptionQuality = qualityAssessment.qualityScore;
        segment.isBackgroundNoise = true;
      }
      
      // CRITICAL: Ensure agent stays in listening mode when noise is detected
      // This prevents the feedback loop where agent keeps responding to noise
      this.state.waitingForUser = true;
      
      return { 
        processed: false, 
        shouldCreateResponse: false,
        isBackgroundNoise: true,
        reason,
        qualityScore: qualityAssessment.qualityScore
      };
    }

    // High-quality transcription - proceed normally
    // Mark segment as having received high-quality transcription
    if (itemId && this.state.pendingAudioSegments.has(itemId)) {
      const segment = this.state.pendingAudioSegments.get(itemId);
      segment.transcriptionReceived = true;
      segment.transcriptionQuality = qualityAssessment.qualityScore;
      segment.isBackgroundNoise = false;
      
      // Store transcription result for response creation checks
      this.state.segmentTranscriptionMap.set(itemId, {
        transcript,
        confidence,
        quality: qualityAssessment.qualityScore,
        timestamp: transcriptionTime,
        isHighQuality: true
      });
    }
    
    // Store response to pending premature question if applicable
    const conv = conversations[this.state.callSid];
    if (conv?.pendingPrematureQuestion && transcript?.trim()) {
      storePrematureResponse(this.state.callSid, transcript, conv.pendingPrematureQuestion);
      delete conv.pendingPrematureQuestion;
    }

    this.appendUserTurnToTranscript(transcript, transcriptionTime, qualityAssessment, conversations);
    appendTranscriptEntry(this.state.callSid, {
      role: 'user',
      text: transcript,
      timestamp: new Date(transcriptionTime),
      confidence: qualityAssessment?.confidenceScore ?? 0.8,
      language: resolveTranscriptionLanguage(conv?.language || this.state.languagePreferenceState?.language || 'en')
    }, { consentGiven: conv?.recordingConsent?.given === true }).catch(() => {});

    // Handle memory consent
    await this.consentHandler.handleMemoryConsent(transcript);
    
    // Handle recording consent
    await this.consentHandler.handleRecordingConsent(transcript);
    
    // Track when we received this transcription
    this.state.lastTranscriptionReceivedTime = Date.now();

    const isAudioPlaying = isAgentAudioPlaying(this.state);
    const flowState = getConversationFlowState(this.state.callSid, this.state);
    const inConsentOrLanguagePhase = flowState.waitingForLanguage || (flowState.languageSelected && !flowState.consentResponded);
    const consentJustResponded =
      flowState.consentResponded &&
      this.state.agentFinishedSpeakingTime > 0 &&
      Date.now() - this.state.agentFinishedSpeakingTime < 5000;
    const useRelaxedBlocking = inConsentOrLanguagePhase || consentJustResponded;
    const isAudioPlayingForBlocking = useRelaxedBlocking
      ? isAgentAudioPlaying(this.state, { consentPhaseRelaxed: true })
      : isAudioPlaying;

    // Cancelled response IDs must not count as a "genuine" agent turn for blocking — audio is dropped server-side.
    const activeResponseCancelled =
      Boolean(this.state.activeResponseId && this.state.cancelledResponseIds?.has?.(this.state.activeResponseId));
    const genuinelyNewAgentTurn =
      this.state.isResponding &&
      this.state.activeResponseId &&
      !activeResponseCancelled;
    // While interrupted, always bypass "agent playing" blocking so we do not drop the caller's post-barge-in transcript
    // when isResponding/activeResponseId are still set (race before barge-in clears state).
    const postInterruptBypass =
      this.state.isInterrupted ||
      activeResponseCancelled ||
      (!genuinelyNewAgentTurn &&
        this.state.lastCancellationTime > 0 &&
        msSinceCancellation < POST_BARGE_IN_GRACE_MS);
    const effectiveAudioPlayingForBlocking =
      isAudioPlayingForBlocking && !postInterruptBypass;

    if (this.state.isInterrupted && isAudioPlaying && this.bargeInHandler?.responseHandler) {
      this.bargeInHandler.responseHandler.immediatelyStopAudio();
    }

    // Handle transcriptions after barge-in
    // After barge-in, transcriptions may arrive after speech_stopped fires
    // We need to clear isInterrupted flag to resume normal conversation flow
    if (this.state.isInterrupted) {
      const speechHasStopped =
        this.state.speechStoppedTime > 0 && this.state.speechStoppedTime <= transcriptionTime;

      if (speechHasStopped) {
        console.log(
          `✅ [${this.state.callSid}] Transcription received after barge-in and speech_stopped - clearing interruption flag and resuming normal flow: "${transcript}"`
        );

        if (this.state.interruptionTimeout) {
          clearTimeout(this.state.interruptionTimeout);
          this.state.interruptionTimeout = null;
          console.log(`⏱️ [${this.state.callSid}] Cleared interruption timeout - transcriptions arrived`);
        }

        this.state.isInterrupted = false;
        this.state.interruptionStartTime = 0;
        progressIndicatorService.maybeResumeQueuedUpdates(this.state.callSid, this.state);
      } else {
        console.log(
          `⏸️ [${this.state.callSid}] Transcription received during interruption (speech ongoing) - queuing: "${transcript}"`
        );
        this.state.pendingTranscriptions.push({
          transcript,
          confidence,
          time: transcriptionTime
        });
        return { processed: true, shouldCreateResponse: false };
      }
    }
    
    // Check if this transcription is stale (from before interruption)
    if (transcriptionTime < this.state.interruptionStartTime && this.state.interruptionStartTime > 0) {
      console.log(`🗑️ [${this.state.callSid}] Ignoring stale transcription from before interruption: "${transcript}"`);
      return { processed: false, shouldCreateResponse: false, reason: 'stale' };
    }
    
    // Prevent user responses until initial greeting completes
    if (!this.state.hasInitialGreetingCompleted && !isRecentCancellation) {
      console.log(`⏳ [${this.state.callSid}] Waiting for initial greeting to complete before responding to: "${transcript}"`);
      return { processed: true, shouldCreateResponse: false };
    }

    if (transcript && conversations[this.state.callSid]) {
      // Reset silence detection
      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      if (conversationBehaviorConfig?.silenceDetection?.enabled) {
        silenceDetectionService.userSpoke(this.state.callSid);
      }
      
      // Track user transcription for adaptive timing
      if (this.state.userSpeechStartedTime === 0 || Math.abs(transcriptionTime - this.state.userSpeechStartedTime) > 1000) {
        adaptiveTimingService.trackCallerBehavior(this.state.callSid, 'user_spoke', transcriptionTime);
      }
      
      // Detect and switch language if waiting for language preference OR if language detection is enabled
      const waitingForLanguage = this.state.waitingForLanguage || conversations[this.state.callSid]?.waitingForLanguage || false;
      const languageSelected = this.state.languagePreferenceState?.selected || conversations[this.state.callSid]?.languagePreferenceState?.selected || false;
      
      if (waitingForLanguage && !languageSelected) {
        if (transcript?.trim()) {
          this.state.lastUtteranceForLanguageSelection = transcript.trim();
        }
      } else if (
        languageSelected &&
        this.state.hasInitialGreetingCompleted &&
        !waitingForLanguage &&
        transcript?.trim()
      ) {
        await this.languageDetector.detectAndSwitchLanguage(transcript);
      }
      
      // Monitor for complaint keywords
      const complaintDetection = complaintDetectionService.monitorCall(this.state.callSid);
      if (complaintDetection && complaintDetection.detected) {
        console.log(`⚠️ [${this.state.callSid}] Complaint detected: ${complaintDetection.riskLevel} risk, type: ${complaintDetection.complaintType}`);
        
        if (!conversations[this.state.callSid].complaintDetected) {
          conversations[this.state.callSid].complaintDetected = {
            detected: true,
            riskLevel: complaintDetection.riskLevel,
            complaintType: complaintDetection.complaintType,
            keywords: complaintDetection.keywords,
            detectedAt: new Date()
          };
        }
      }
    }
    
    // Store transcription for processing after grace period
    if (transcript && transcript !== this.state.lastUserTranscript) {
      if (!this.state.pendingTranscriptionsAfterGrace.find(t => t.transcript === transcript)) {
        this.state.pendingTranscriptionsAfterGrace.push({
          transcript,
          confidence,
          time: transcriptionTime
        });
        console.log(`📝 [${this.state.callSid}] Stored transcription for processing after grace period: "${transcript}"`);
      }
    }
    
    // Update last processed transcription time
    this.state.lastProcessedTranscriptionTime = transcriptionTime;
    
    // After agent finished and we're waiting for an answer, do not drop the user's turn because
    // residual buffer/pacer still marks "audio playing" (long think-time before speaking).
    const msSinceAgentFinished =
      this.state.agentFinishedSpeakingTime > 0 ? Date.now() - this.state.agentFinishedSpeakingTime : Infinity;
    const waitingForAnswerAfterAgent =
      this.state.waitingForUser && msSinceAgentFinished > 1200 && msSinceAgentFinished < 600000;
    const allowResponse = !effectiveAudioPlayingForBlocking || waitingForAnswerAfterAgent;
    return { 
      processed: true, 
      shouldCreateResponse: allowResponse,
      qualityScore: qualityAssessment.qualityScore,
      isBackgroundNoise: false,
      isHighQuality: true
    };
  }

  /**
   * Handle speech_stopped event
   */
  async handleSpeechStopped(event) {
    const speechStoppedTimestamp = Date.now();
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    const speechContinuation = conversationBehaviorConfig?.conversationFlow?.speechContinuation;
    
    console.log(`🔍 [TEST-3] [${this.state.callSid}] SPEECH_STOPPED EVENT - timestamp: ${speechStoppedTimestamp}`);
    console.log(`🔍 [TEST-3] [${this.state.callSid}] VAD silence detection triggered`);
    
    // Track when speech stopped
    this.state.speechStoppedTime = speechStoppedTimestamp;
    
    // Calculate silence duration if we have speech start time
    if (this.state.userSpeechStartedTime > 0) {
      const speechDuration = speechStoppedTimestamp - this.state.userSpeechStartedTime;
      console.log(`🔍 [TEST-3] [${this.state.callSid}] Speech duration: ${speechDuration}ms`);
    }
    
    // Handle interruption case
    if (this.state.isInterrupted) {
      if (this.state.pendingTranscriptions.length > 0) {
        console.log(`✅ [${this.state.callSid}] Speech ended after interruption - acknowledging interruption first`);
        
        // Clear the interruption timeout since transcriptions are available
        if (this.state.interruptionTimeout) {
          clearTimeout(this.state.interruptionTimeout);
          this.state.interruptionTimeout = null;
          console.log(`⏱️ [${this.state.callSid}] Cleared interruption timeout - transcriptions available`);
        }
        
        // Clear interruption flag
        this.state.isInterrupted = false;
        this.state.interruptionStartTime = 0;
        progressIndicatorService.maybeResumeQueuedUpdates(this.state.callSid, this.state);

        this.state.pendingTranscriptions = [];
        
        // Acknowledge interruption (will be handled by tool coordinator)
        return { type: 'acknowledge_interruption' };
      } else {
        // Barge-in detected via speech_started but no transcriptions yet
        // CRITICAL FIX: Set a timeout to clear interruption flag if transcriptions don't arrive
        // This prevents the system from getting stuck forever if transcriptions are filtered/lost
        console.log(`⏸️ [${this.state.callSid}] Speech ended after interruption (no transcriptions yet) - KEEPING interruption flag set, waiting for transcriptions to arrive`);
        
        // Clear any existing timeout
        if (this.state.interruptionTimeout) {
          clearTimeout(this.state.interruptionTimeout);
        }
        
        // Set timeout to clear interruption flag after 2.5 seconds if transcriptions don't arrive
        // This ensures the system doesn't get stuck forever
        const INTERRUPTION_TIMEOUT_MS = 2500; // 2.5 seconds - enough time for transcriptions to arrive
        this.state.interruptionTimeout = setTimeout(() => {
          // Timeout expired - transcriptions didn't arrive, clear interruption flag to resume conversation
          if (this.state.isInterrupted && this.state.pendingTranscriptions.length === 0) {
            try {
              this.onInterruptionTimeoutNudge?.();
            } catch (_) {
              /* non-fatal */
            }
            console.log(`⏰ [${this.state.callSid}] Interruption timeout expired (${INTERRUPTION_TIMEOUT_MS}ms) - no transcriptions arrived, clearing interruption flag to resume conversation`);
            this.state.isInterrupted = false;
            this.state.interruptionStartTime = 0;
            this.state.interruptionTimeout = null;
            progressIndicatorService.maybeResumeQueuedUpdates(this.state.callSid, this.state);
          }
        }, INTERRUPTION_TIMEOUT_MS);
        
        console.log(`⏱️ [${this.state.callSid}] Set interruption timeout (${INTERRUPTION_TIMEOUT_MS}ms) - will clear flag if transcriptions don't arrive`);
        
        // DON'T clear interruption flag - keep it set to prevent new responses
        // Return early to prevent normal flow from creating responses
        return null; // Wait for transcriptions to arrive
      }
    }
    
    // CRITICAL: Don't process pending transcriptions if interrupted
    if (this.state.isInterrupted) {
      console.log(`🛑 [${this.state.callSid}] Skipping transcription processing - user has interrupted`);
      return null;
    }
    
    // Handle normal speech continuation grace period
    if (speechContinuation?.enabled && this.state.pendingTranscriptionsAfterGrace.length > 0) {
      const gracePeriodMs = speechContinuation.gracePeriodMs || 1500;
      
      // Start grace period timer
      this.state.speechContinuationGraceTimer = setTimeout(async () => {
        if (!this.state.speechResumedDuringGrace && this.state.pendingTranscriptionsAfterGrace.length > 0) {
          // Process transcriptions after grace period
          const transcriptionsToProcess = [...this.state.pendingTranscriptionsAfterGrace];
          this.state.pendingTranscriptionsAfterGrace = [];
          this.state.speechResumedDuringGrace = false;
          this.state.gracePeriodExtensionCount = 0;
          
          console.log(`[RESPONSE-SOURCE] [${this.state.callSid}] grace_period - will create response after intent check`);
          console.log(`✅ [${this.state.callSid}] Grace period expired - processing ${transcriptionsToProcess.length} transcriptions`);
          const joined = transcriptionsToProcess.map(t => t?.transcript).filter(Boolean).join(' ').trim();
          const transcriptText = mergeWithBargeInFlushedGrace(this.state.callSid, joined);
          console.log(`🔍 [INTENT] [${this.state.callSid}] grace_period transcriptText: "${(transcriptText || '').slice(0, 120)}"`);
          if (transcriptText && typeof this.onApplyIntentFromTranscript === 'function') {
            this.onApplyIntentFromTranscript(transcriptText);
          }
          const { conversations } = await import('../../../shared/state.js');
          const conv = conversations[this.state.callSid] || {};
          const flowState = getConversationFlowState(this.state.callSid, this.state);
          const consentJustResponded =
            flowState.consentResponded &&
            this.state.agentFinishedSpeakingTime > 0 &&
            Date.now() - this.state.agentFinishedSpeakingTime < 5000;
          const inConsentOrLanguagePhase =
            flowState.waitingForLanguage ||
            (flowState.languageSelected && !flowState.consentResponded) ||
            consentJustResponded;
          const syntheticTranscription = {
            processed: true,
            shouldCreateResponse: true,
            qualityScore: 1,
            isBackgroundNoise: false
          };
          const decisionSnapshot = buildResponseDecisionSnapshot(
            this.state,
            this.state.callSid,
            inConsentOrLanguagePhase
          );
          const allowGraceResponse =
            this.state.hasInitialGreetingCompleted &&
            !this.state.isInterrupted &&
            conversationService.shouldCreateResponse(syntheticTranscription, decisionSnapshot);
          if (allowGraceResponse && this.state.tryAcquireResponseLock()) {
            try {
              if (this.state.isInterrupted) {
                console.log(`🛑 [${this.state.callSid}] Skipping response creation after grace period - user interrupted`);
                this.state.releaseResponseLock();
                return;
              }
              if (typeof this.createAudioResponseFn === 'function') {
                this.state.explicitResponseRequested = true;
                await this.createAudioResponseFn();
                console.log(
                  `🎯 [${this.state.callSid}] Created response after grace period via createAudioResponse (${transcriptionsToProcess.length} transcriptions)`
                );
              } else if (this.openaiWs && this.openaiWs.readyState === 1) {
                const overrideWorkflowPhase = this.onGetWorkflowPhase?.() ?? undefined;
                const { toolChoice } = await conversationService.getToolChoiceForResponse({
                  callSid: this.state.callSid,
                  state: this.state,
                  conversation: conv,
                  hasInitialGreetingBeenSent: true,
                  overrideWorkflowPhase,
                  browserToolExecution: progressIndicatorService.getExecutionInfo(this.state.callSid)
                });
                const forcedSetLang =
                  toolChoice &&
                  typeof toolChoice === 'object' &&
                  toolChoice.type === 'function' &&
                  toolChoice.name === 'set_call_language';
                if (forcedSetLang && typeof this.queueLanguageSelectionBackup === 'function') {
                  this.state.lastUtteranceForLanguageSelection = transcriptText.trim();
                  await this.queueLanguageSelectionBackup(transcriptText);
                }
                const sessionPatch = forcedSetLang
                  ? {
                      tool_choice: toolChoice,
                      tools: toolExecutor.getFilteredToolDefinitions({
                        workflowPhase: 'language_selection',
                        clientVerified: conv?.kba?.verified || false
                      })
                    }
                  : { tool_choice: toolChoice };
                this.openaiWs.send(JSON.stringify({
                  type: 'session.update',
                  session: sessionPatch
                }));
                await new Promise(resolve => setTimeout(resolve, 150));
                const allowMid = configManager.getConversationBehaviorConfig()?.allowMidToolEpistemicReplies !== false;
                const browserToolExecution = progressIndicatorService.getExecutionInfo(this.state.callSid);
                const midToolEpistemicMode = Boolean(
                  allowMid &&
                    browserToolExecution &&
                    !this.state.toolExecutionCompleting &&
                    this.state.waitingForUser === false
                );
                const { instructions: responseInstructions } = await conversationService.getResponseInstructions({
                  callSid: this.state.callSid,
                  state: this.state,
                  conversation: conv,
                  hasInitialGreetingBeenSent: true,
                  overrideWorkflowPhase,
                  midToolEpistemicMode,
                  browserToolExecution
                });
                const responseCreatePayload = {
                  type: 'response.create',
                  response: {
                    modalities: ['audio', 'text']
                  }
                };
                if (responseInstructions) {
                  responseCreatePayload.response.instructions = responseInstructions;
                  console.log(`📋 [${this.state.callSid}] Including contextual instructions in response.create after grace period`);
                }
                this.openaiWs.send(JSON.stringify(responseCreatePayload));
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
                console.log(
                  `🎯 [${this.state.callSid}] Created response after grace period (${transcriptionsToProcess.length} transcriptions) [fallback path]`
                );
              }
            } catch (err) {
              console.error(`❌ [${this.state.callSid}] Error creating response after grace period:`, err);
              this.state.releaseResponseLock();
            }
          }
        }
      }, gracePeriodMs);
      
      console.log(`⏱️ [${this.state.callSid}] Started grace period timer (${gracePeriodMs}ms) for speech continuation`);
    } else if (this.state.pendingTranscriptionsAfterGrace.length > 0) {
      // CRITICAL: Don't process if interrupted
      if (this.state.isInterrupted) {
        console.log(`🛑 [${this.state.callSid}] Skipping immediate transcription processing - user has interrupted`);
        return null;
      }
      // No grace period - process immediately
      const transcriptionsToProcess = [...this.state.pendingTranscriptionsAfterGrace];
      this.state.pendingTranscriptionsAfterGrace = [];
      
      return { type: 'process_transcriptions', transcriptions: transcriptionsToProcess };
    }
    
    return null;
  }
}
