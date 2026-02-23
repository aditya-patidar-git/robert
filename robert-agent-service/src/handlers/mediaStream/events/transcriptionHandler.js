import configManager from '../../../agent/configManager.js';
import adaptiveTimingService from '../../../services/adaptiveTimingService.js';
import silenceDetectionService from '../../../services/silenceDetectionService.js';
import complaintDetectionService from '../../../services/complaintDetectionService.js';
import promptService from '../../../services/promptService.js';
import conversationService from '../../../services/conversationService.js';
import noiseFilterService from '../../../services/noiseFilterService.js';
import { appendTranscriptEntry } from '../../../services/transcriptPersistenceService.js';
import { getConversationFlowState } from '../utils/conversationStateHelpers.js';
import { LanguageDetector } from '../utils/languageDetector.js';
import { isAgentAudioPlaying } from '../utils/audioPlayingState.js';

/**
 * Transcription Handler
 * Handles user transcriptions and speech stopped events
 * Supports partial transcription deltas for faster "stop" detection
 */
export class TranscriptionHandler {
  constructor(stateManager, languageDetector, consentHandler, openaiWs, bargeInHandler = null, onApplyIntentFromTranscript = null, onGetWorkflowPhase = null) {
    this.state = stateManager;
    this.languageDetector = languageDetector;
    this.consentHandler = consentHandler;
    this.openaiWs = openaiWs;
    this.bargeInHandler = bargeInHandler;
    this.onApplyIntentFromTranscript = onApplyIntentFromTranscript;
    this.onGetWorkflowPhase = onGetWorkflowPhase;
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
   * INDUSTRY STANDARD: Check for "stop" in partial transcripts for faster detection
   * This provides incremental transcripts before completion, enabling faster barge-in
   */
  async handleTranscriptionDelta(event) {
    const partialTranscript = event.delta || '';
    const itemId = event.item_id || null;
    
    // CRITICAL: Check for "stop" in partial transcript immediately
    // This enables faster barge-in detection (150-300ms vs 300-800ms for completed)
    const stopPattern = /\bstop\b/i;
    const containsStop = stopPattern.test(partialTranscript);
    
    if (containsStop) {
      console.log(`🚨 [${this.state.callSid}] "stop" detected in PARTIAL transcription: "${partialTranscript}"`);
      const mightHaveAudioPlaying = isAgentAudioPlaying(this.state);
      console.log(`   - Audio might be playing: ${mightHaveAudioPlaying}`);
      console.log(`   - isResponding: ${this.state.isResponding}, activeResponseId: ${this.state.activeResponseId}`);
      console.log(`   - Barge-in already triggered: ${this.state.isInterrupted}`);

      if (this.state.isInterrupted) {
        console.log(`✅ [${this.state.callSid}] Barge-in already triggered - partial transcription confirms "stop" command`);
        if (this.bargeInHandler && this.bargeInHandler.responseHandler) {
          this.bargeInHandler.responseHandler.immediatelyStopAudio();
        }
      } else if (mightHaveAudioPlaying && this.bargeInHandler) {
        // Barge-in not yet triggered - trigger now (fallback case)
        console.log(`🛑 [${this.state.callSid}] Triggering barge-in from partial transcription (fallback)`);
        this.bargeInHandler.triggerBargeInFromTranscription(partialTranscript);
      }
    }
    
    // Return null - delta events don't trigger response creation
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

    // CRITICAL: Industry-standard multi-factor background noise filtering
    // Uses confidence, pattern matching, length, and character composition
    const qualityAssessment = noiseFilterService.assessTranscriptionQuality(
      transcript,
      confidence,
      itemId
    );
    
    // CRITICAL: Check for "stop" command BEFORE filtering - even filtered transcriptions might contain "stop"
    // Use word boundary regex to match "stop" as a word (not substring like "stopped")
    const stopPattern = /\bstop\b/i;
    const containsStop = stopPattern.test(transcript);
    
    // Check for response loop prevention (recent response + noise = prevent loop)
    const timeSinceLastResponse = this.state.agentFinishedSpeakingTime > 0 
      ? Date.now() - this.state.agentFinishedSpeakingTime 
      : Infinity;
    const shouldPreventLoop = noiseFilterService.shouldPreventResponseLoop(transcript, timeSinceLastResponse);
    
    // CRITICAL FIX: Log ALL transcriptions containing "stop" (even filtered ones) for debugging
    // This helps diagnose why barge-in isn't triggering
    if (containsStop) {
      console.log(`🚨 [${this.state.callSid}] "stop" detected in transcription (BEFORE filtering): "${transcript}"`);
      console.log(`   - Confidence: ${confidence}, Quality: ${qualityAssessment.qualityScore}`);
      console.log(`   - Will be filtered: ${!qualityAssessment.isHighQuality || shouldPreventLoop}`);
      console.log(`   - Filter reason: ${shouldPreventLoop ? 'response_loop_prevention' : qualityAssessment.reason || 'none'}`);
    }
    
    // Log ALL transcriptions (even filtered ones) for debugging
    if (!qualityAssessment.isHighQuality || shouldPreventLoop) {
      const reason = shouldPreventLoop ? 'response_loop_prevention' : qualityAssessment.reason;
      console.log(`🔇 [${this.state.callSid}] Filtered background noise: "${transcript}" (confidence: ${qualityAssessment.confidenceScore}, quality: ${qualityAssessment.qualityScore}, reason: ${reason})`);
      
      // CRITICAL FIX: Even if transcription is filtered, check if it contains "stop" and audio might be playing
      // This prevents "stop" commands from being ignored due to quality filtering
      if (containsStop) {
        const mightHaveAudioPlaying = isAgentAudioPlaying(this.state);
        console.log(`⚠️ [${this.state.callSid}] "stop" detected in FILTERED transcription - checking if audio might be playing`);
        console.log(`   - mightHaveAudioPlaying: ${mightHaveAudioPlaying}`);

        if (mightHaveAudioPlaying && this.bargeInHandler) {
          console.log(`🛑 [${this.state.callSid}] SAFETY TRIGGER: Barge-in triggered for "stop" in filtered transcription (audio might be playing)`);
          this.bargeInHandler.triggerBargeInFromTranscription(transcript);
          // Don't return here - continue to mark as filtered but barge-in is already triggered
        }
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
    
    const { conversations } = await import('../../../shared/state.js');
    this.appendUserTurnToTranscript(transcript, transcriptionTime, qualityAssessment, conversations);
    const conv = conversations[this.state.callSid];
    appendTranscriptEntry(this.state.callSid, {
      role: 'user',
      text: transcript,
      timestamp: new Date(transcriptionTime),
      confidence: qualityAssessment?.confidenceScore ?? 0.8
    }, { consentGiven: conv?.recordingConsent?.given === true }).catch(() => {});

    // Handle memory consent
    await this.consentHandler.handleMemoryConsent(transcript);
    
    // Handle recording consent
    await this.consentHandler.handleRecordingConsent(transcript);
    
    // Track when we received this transcription
    this.state.lastTranscriptionReceivedTime = Date.now();
    
    // CRITICAL: Check for "stop" command FIRST - if audio is playing and transcript contains "stop", trigger barge-in IMMEDIATELY
    // Note: containsStop was already checked above (before filtering) - reuse that value
    // stopPattern and containsStop are already declared at the top of the function
    
    const isAudioPlaying = isAgentAudioPlaying(this.state);
    const flowState = getConversationFlowState(this.state.callSid, this.state);
    const inConsentOrLanguagePhase = flowState.waitingForLanguage || (flowState.languageSelected && !flowState.consentGiven);
    const consentJustGiven =
      flowState.consentGiven &&
      this.state.agentFinishedSpeakingTime > 0 &&
      Date.now() - this.state.agentFinishedSpeakingTime < 5000;
    const useRelaxedBlocking = inConsentOrLanguagePhase || consentJustGiven;
    const isAudioPlayingForBlocking = useRelaxedBlocking
      ? isAgentAudioPlaying(this.state, { consentPhaseRelaxed: true })
      : isAudioPlaying;

    if (containsStop) {
      console.log(`🔍 [${this.state.callSid}] "stop" detected in completed transcript: "${transcript}"`);
      console.log(`   - isAudioPlaying: ${isAudioPlaying}, Barge-in already triggered: ${this.state.isInterrupted}`);
    }
    
    // EDGE CASE 1: Handle transcription that arrives while audio is playing and contains "stop"
    // Note: Barge-in should already be triggered on speech_started, but verify here
    if (isAudioPlaying && containsStop) {
      console.log(`🛑 [${this.state.callSid}] "stop" detected in completed transcription while audio is playing`);
      console.log(`   - Barge-in already triggered: ${this.state.isInterrupted}`);
      
      // If barge-in already triggered on speech_started, just verify
      if (this.state.isInterrupted) {
        console.log(`✅ [${this.state.callSid}] Barge-in already triggered on speech_started - transcription confirms "stop" command`);
        // Ensure audio is fully stopped
        if (this.bargeInHandler && this.bargeInHandler.responseHandler) {
          this.bargeInHandler.responseHandler.immediatelyStopAudio();
        }
      } else {
        // Fallback: Trigger barge-in if it wasn't triggered on speech_started
        console.log(`🛑 [${this.state.callSid}] Triggering barge-in from completed transcription (fallback - should have triggered on speech_started)`);
        if (this.bargeInHandler) {
          this.bargeInHandler.triggerBargeInFromTranscription(transcript);
        } else {
          console.warn(`⚠️ [${this.state.callSid}] BargeInHandler not available - cannot trigger barge-in for "stop" command`);
        }
      }
      
      // Queue transcription for processing after speech ends
      this.state.pendingTranscriptions.push({
        transcript,
        confidence,
        time: transcriptionTime
      });
      return { processed: true, shouldCreateResponse: false }; // Don't process yet - wait for speech_stopped
    }
    
    // EDGE CASE 2: Transcription arrives but audio is playing and transcript does NOT contain "stop"
    // Let audio continue normally - this is a normal interruption, not a stop command
    // In consent/language phase we use strict "playing" only (no recent windows) so we don't block the consent question after "Let's go with English"
    if (isAudioPlayingForBlocking && !containsStop) {
      if (this.state.pendingBargeInCheck) {
        this.state.pendingBargeInCheck = false;
        console.log(`👂 [${this.state.callSid}] Transcription received during audio playback but does not contain "stop" - audio continues, NO response created: "${transcript}"`);
      }
      return { processed: true, shouldCreateResponse: false };
    }
    
    // EDGE CASE 3: Transcription arrives but audio is NOT playing
    // SAFETY FIX: Even if audio detection says it's not playing, send "clear" as a safety measure
    // This handles edge cases where Twilio might still have buffered audio
    if (!isAudioPlaying && containsStop) {
      console.log(`📝 [${this.state.callSid}] Transcription contains "stop" but audio detection says not playing`);
      console.log(`   - Sending "clear" as safety measure to ensure any buffered audio is stopped`);
      
      // SAFETY: Send clear message anyway - better to be safe than miss a "stop" command
      if (this.bargeInHandler && this.bargeInHandler.responseHandler) {
        console.log(`🛑 [${this.state.callSid}] SAFETY CLEAR: Sending Twilio "clear" message even though audio detection says not playing`);
        this.bargeInHandler.responseHandler.immediatelyStopAudio();
      }
      
      // Do not create a response for "stop" - user intended to interrupt / end, not get a reply
      return { processed: true, shouldCreateResponse: false };
    }
    
    // CRITICAL FIX: Handle transcriptions after barge-in
    // After barge-in, transcriptions may arrive after speech_stopped fires
    // We need to clear isInterrupted flag to resume normal conversation flow
    if (this.state.isInterrupted) {
      // Check if speech has already stopped (transcription arrived after speech_stopped event)
      const speechHasStopped = this.state.speechStoppedTime > 0 && 
                               this.state.speechStoppedTime <= transcriptionTime;
      
      // Check if this is a stop command
      const isStopCommand = stopPattern.test(transcript);
      
      if (isStopCommand) {
        // Stop command: queue it and keep interruption flag set
        console.log(`🛑 [${this.state.callSid}] Stop command transcription received during interruption - queuing: "${transcript}"`);
        this.state.pendingTranscriptions.push({
          transcript,
          confidence,
          time: transcriptionTime
        });
        return { processed: true, shouldCreateResponse: false };
      } else if (speechHasStopped) {
        // CRITICAL FIX: Transcription arrived AFTER speech_stopped fired
        // Clear interruption flag and process transcription normally to resume conversation
        console.log(`✅ [${this.state.callSid}] Transcription received after barge-in and speech_stopped - clearing interruption flag and resuming normal flow: "${transcript}"`);
        
        // Clear the interruption timeout since transcriptions arrived
        if (this.state.interruptionTimeout) {
          clearTimeout(this.state.interruptionTimeout);
          this.state.interruptionTimeout = null;
          console.log(`⏱️ [${this.state.callSid}] Cleared interruption timeout - transcriptions arrived`);
        }
        
        this.state.isInterrupted = false;
        this.state.interruptionStartTime = 0;
        this.state.pendingBargeInCheck = false;
        // Continue with normal processing below (don't return early)
      } else {
        // Speech still ongoing: queue transcription and wait for speech_stopped
        console.log(`⏸️ [${this.state.callSid}] Transcription received during interruption (speech ongoing) - queuing: "${transcript}"`);
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
    
    // Check for stop commands
    const timeSinceCancellation = Date.now() - this.state.lastCancellationTime;
    const isRecentCancellation = this.state.lastCancellationTime > 0 && timeSinceCancellation < 3000;
    const stopCommands = /\b(stop|wait|hold on|pause|shut up|be quiet|enough|that's enough)\b/i;
    const isStopCommand = stopCommands.test(transcript);
    
    if (isRecentCancellation && isStopCommand) {
      console.log(`🛑 [${this.state.callSid}] Stop command detected: "${transcript}" - entering listening mode`);
      
      // Clear interruption timeout if set
      if (this.state.interruptionTimeout) {
        clearTimeout(this.state.interruptionTimeout);
        this.state.interruptionTimeout = null;
      }
      
      this.state.waitingForUser = true;
      this.state.lastCancellationTime = 0;
      this.state.isInterrupted = false;
      this.state.interruptionStartTime = 0;
      return { processed: true, shouldCreateResponse: false };
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
        // CRITICAL: Handle language preference selection
        await this.languageDetector.detectAndSwitchLanguage(transcript);
      } else if (conversations[this.state.callSid].languageDetectionEnabled && this.state.hasInitialGreetingCompleted) {
        // Mid-call language switching (after initial greeting)
        await this.languageDetector.detectAndSwitchLanguage(transcript);
        conversations[this.state.callSid].languageDetectionEnabled = false;
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
    
    const allowResponse = !isAudioPlayingForBlocking;
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
        // We have transcriptions - process them
        const latestTranscription = this.state.pendingTranscriptions[this.state.pendingTranscriptions.length - 1];
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
        
        // Check if it's a stop command (only "stop" word)
        const transcript = latestTranscription.transcript;
        const stopPattern = /\bstop\b/i; // Only match "stop" as a word (not substring like "stopped")
        const isStopCommand = stopPattern.test(transcript);
        
        if (isStopCommand) {
          console.log(`🛑 [${this.state.callSid}] Stop command detected: "${transcript}" - entering listening mode`);
          this.state.waitingForUser = true;
          this.state.lastCancellationTime = 0;
          this.state.pendingTranscriptions = [];
          return;
        }
        
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
            console.log(`⏰ [${this.state.callSid}] Interruption timeout expired (${INTERRUPTION_TIMEOUT_MS}ms) - no transcriptions arrived, clearing interruption flag to resume conversation`);
            this.state.isInterrupted = false;
            this.state.interruptionStartTime = 0;
            this.state.pendingBargeInCheck = false;
            this.state.interruptionTimeout = null;
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
          const transcriptText = transcriptionsToProcess.map(t => t?.transcript).filter(Boolean).join(' ').trim();
          console.log(`🔍 [INTENT] [${this.state.callSid}] grace_period transcriptText: "${(transcriptText || '').slice(0, 120)}"`);
          if (transcriptText && typeof this.onApplyIntentFromTranscript === 'function') {
            this.onApplyIntentFromTranscript(transcriptText);
          }
          if (this.state.waitingForUser && this.state.hasInitialGreetingCompleted && !this.state.isInterrupted && this.state.tryAcquireResponseLock()) {
            try {
              if (this.state.isInterrupted) {
                console.log(`🛑 [${this.state.callSid}] Skipping response creation after grace period - user interrupted`);
                this.state.releaseResponseLock();
                return;
              }
              if (this.openaiWs && this.openaiWs.readyState === 1) {
                const { conversations } = await import('../../../shared/state.js');
                const overrideWorkflowPhase = this.onGetWorkflowPhase?.() ?? undefined;
                const { toolChoice } = await conversationService.getToolChoiceForResponse({
                  callSid: this.state.callSid,
                  state: this.state,
                  conversation: conversations[this.state.callSid] || {},
                  hasInitialGreetingBeenSent: true,
                  overrideWorkflowPhase
                });
                this.openaiWs.send(JSON.stringify({
                  type: 'session.update',
                  session: {
                    tool_choice: toolChoice
                  }
                }));
                await new Promise(resolve => setTimeout(resolve, 150));
                const { instructions: responseInstructions } = await conversationService.getResponseInstructions({
                  callSid: this.state.callSid,
                  state: this.state,
                  conversation: conversations[this.state.callSid] || {},
                  hasInitialGreetingBeenSent: true,
                  overrideWorkflowPhase
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
                
                // Step 3: Re-enable tools after delay
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
                
                console.log(`🎯 [${this.state.callSid}] Created response after grace period (${transcriptionsToProcess.length} transcriptions)`);
              }
            } catch (err) {
              console.error(`❌ [${this.state.callSid}] Error creating response after grace period:`, err);
              // Release lock on error
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
