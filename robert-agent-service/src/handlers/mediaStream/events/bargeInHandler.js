import configManager from '../../../agent/configManager.js';
import conversationQualityService from '../../../services/conversationQualityService.js';
import adaptiveTimingService from '../../../services/adaptiveTimingService.js';
import progressIndicatorService from '../../../services/progressIndicatorService.js';
import { conversations } from '../../../shared/state.js';
import { isAgentAudioPlaying } from '../utils/audioPlayingState.js';

/**
 * Barge-in Handler
 * Handles user interruptions during agent responses
 * Production-ready: Supports concurrent calls, immediate Twilio-level audio stopping
 */
export class BargeInHandler {
  constructor(stateManager, openaiWs, responseHandler = null, onBargeInSnapshot = null) {
    this.state = stateManager;
    this.openaiWs = openaiWs;
    this.responseHandler = responseHandler; // Reference to ResponseHandler for immediate audio stopping
    this.onBargeInSnapshot = onBargeInSnapshot; // Optional: (callSid) => { bookingSession, workflowContext, lastAvailabilityCheck, phase }
  }

  /**
   * Handle speech_started event (user speaking detection)
   * INDUSTRY STANDARD: Trigger IMMEDIATE barge-in when audio is playing (<200ms response time)
   * Based on research: OpenAI emits speech_started immediately, transcription arrives 300-800ms later
   * Best practice: Stop audio immediately on speech detection; completed transcripts drive reply (no keyword gate)
   */
  async handleSpeechStarted(event) {
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    
    // Track when user speech started
    const speechStartTime = Date.now();
    this.state.userSpeechStartedTime = speechStartTime;
    
    // Track user speech for adaptive timing
    adaptiveTimingService.trackCallerBehavior(this.state.callSid, 'user_spoke', speechStartTime);
    
    // Check if we're in grace period (speech continuation detection)
    const speechContinuation = conversationBehaviorConfig?.conversationFlow?.speechContinuation;
    
    if (speechContinuation?.enabled && this.state.speechContinuationGraceTimer && this.state.speechStoppedTime > 0) {
      const timeSinceSpeechStopped = Date.now() - this.state.speechStoppedTime;
      const gracePeriodMs = speechContinuation.gracePeriodMs || 1500;

      if (timeSinceSpeechStopped < gracePeriodMs) {
        // If the model is still in an active response, the caller is interrupting agent TTS — not
        // continuing their own pre-agent utterance. Speech continuation must not return early here
        // or barge-in is skipped until grace expires (felt as multiple failed interrupts).
        const agentMidResponse = this.state.isResponding === true || this.state.activeResponseId != null;
        if (agentMidResponse) {
          if (this.state.speechContinuationGraceTimer) {
            clearTimeout(this.state.speechContinuationGraceTimer);
            this.state.speechContinuationGraceTimer = null;
          }
          this.state.speechStoppedTime = 0;
          this.state.speechResumedDuringGrace = false;
          this.state.gracePeriodExtensionCount = 0;
          console.log(`🎯 [${this.state.callSid}] Skipping speech-continuation grace (agent mid-response) — barge-in allowed`);
        } else {
          // Speech resumed during grace period (same user turn; agent not in active OpenAI response)
          this.state.speechResumedDuringGrace = true;
          this.state.gracePeriodExtensionCount++;

          if (this.state.speechContinuationGraceTimer) {
            clearTimeout(this.state.speechContinuationGraceTimer);
            this.state.speechContinuationGraceTimer = null;
          }

          const maxExtensions = speechContinuation.maxGracePeriodExtensions || 2;
          if (this.state.gracePeriodExtensionCount <= maxExtensions) {
            console.log(`🔄 [${this.state.callSid}] Speech resumed during grace period (extension ${this.state.gracePeriodExtensionCount}/${maxExtensions}, ${Math.round(timeSinceSpeechStopped)}ms after speech stopped) - continuing to listen`);
            this.state.speechStoppedTime = 0;
            return; // Exit early, don't process as barge-in
          }
          console.log(`⚠️ [${this.state.callSid}] Max grace period extensions reached (${this.state.gracePeriodExtensionCount}) - processing transcriptions`);
          this.state.speechResumedDuringGrace = false;
          this.state.gracePeriodExtensionCount = 0;
          this.state.speechStoppedTime = 0;
        }
      }
    }
    
    // INDUSTRY STANDARD: Trigger IMMEDIATE barge-in when user speaks during agent response
    // This achieves <200ms interruptible latency (industry best practice)

    const isAudioPlaying = isAgentAudioPlaying(this.state, { forBargeIn: true });

    if (isAudioPlaying) {
      const timeSinceResponseCreated = this.state.responseStartTime > 0 ? Date.now() - this.state.responseStartTime : Infinity;
      const userSpokeBeforeResponse = this.state.responseStartTime > 0 && this.state.userSpeechStartedTime < this.state.responseStartTime;

      if (userSpokeBeforeResponse) {
        console.log(`👤 [${this.state.callSid}] User speech started before response was created (normal input, not barge-in) - response created ${timeSinceResponseCreated}ms ago`);
        return;
      }

      // Speakerphone/echo: suppress barge-in for first T ms of each response to reduce self-interruption.
      // Skip suppress when we only match Twilio playout tail (activeResponseId/isResponding already cleared but audio still in ear).
      const onlyTwilioPlayout =
        !this.state.isResponding &&
        this.state.activeResponseId == null &&
        (this.state.lastOutboundSendTime ?? 0) > 0;
      const bargeInSuppressMs = conversationBehaviorConfig?.conversationFlow?.bargeInSuppressMs ?? 1000;
      if (
        !onlyTwilioPlayout &&
        bargeInSuppressMs > 0 &&
        timeSinceResponseCreated < bargeInSuppressMs
      ) {
        console.log(`🔇 [${this.state.callSid}] Barge-in suppressed (within ${bargeInSuppressMs}ms of response start, ${Math.round(timeSinceResponseCreated)}ms) - reduces speakerphone echo`);
        return;
      }

      // Rapid repeated speech_started (noise) while TTS plays: cooldown so we still pause once but avoid flapping
      const cooldownMs = conversationBehaviorConfig?.conversationFlow?.bargeInFullSequenceCooldownMs ?? 450;
      let conv = conversations[this.state.callSid];
      if (!conv) {
        conversations[this.state.callSid] = {};
        conv = conversations[this.state.callSid];
      }
      const lastFull = typeof conv.lastFullBargeInSequenceAt === 'number' ? conv.lastFullBargeInSequenceAt : 0;
      if (cooldownMs > 0 && lastFull > 0 && Date.now() - lastFull < cooldownMs) {
        console.log(`🔇 [${this.state.callSid}] Barge-in cooldown (${cooldownMs}ms) — skipping duplicate full sequence (${Date.now() - lastFull}ms since last)`);
        return;
      }

      console.log(`🛑 [${this.state.callSid}] IMMEDIATE Barge-in triggered on speech_started (industry standard: <200ms) - response ${this.state.activeResponseId || 'N/A'}`);
      console.log(`   - Time since response created: ${timeSinceResponseCreated}ms`);
      console.log(`   - Audio is playing: ${isAudioPlaying}`);

      this.triggerImmediateBargeIn('speech_started');
      return;
    } else {
      // Normal user input - agent is waiting, not responding
      const lastSend = this.state.lastOutboundSendTime ?? 0;
      const tail = this.state.bargeInTailUntil ?? 0;
      console.log(
        `👤 [${this.state.callSid}] User speech started but no audio playing - normal input (not barge-in) (lastOutboundSendAgeMs=${lastSend ? Date.now() - lastSend : 'n/a'}, bargeInTailUntilInMs=${tail > Date.now() ? tail - Date.now() : 0})`
      );
      return; // Exit early if barge-in conditions not met
    }
  }

  /**
   * Trigger immediate barge-in (industry standard: <200ms response time)
   * Called when speech_started is detected during agent response
   * @param {string} source - Source of barge-in trigger ('speech_started' or 'transcription')
   */
  triggerImmediateBargeIn(source = 'speech_started') {
    const bargeInDetectionTime = Date.now();
    const isMultipleInterruption = this.state.isInterrupted;

    // BARGE-IN WORKFLOW INVARIANT: This function must ONLY update call/response/audio state on
    // this.state (interruption flags, response tracking, etc.). It must NOT clear or overwrite:
    // conversations[callSid], workflow phase (openaiIntegration.currentWorkflowPhase), or tool
    // execution state (pendingToolCalls, recentToolCalls, etc.), so the agent can resume the
    // workflow from the same step and session after the user speaks again.

    // Snapshot workflow-critical state for resume restore (belt-and-suspenders)
    if (typeof this.onBargeInSnapshot === 'function') {
      try {
        this.state.bargeInWorkflowSnapshot = this.onBargeInSnapshot(this.state.callSid) || null;
      } catch (err) {
        console.warn(`⚠️ [${this.state.callSid}] Barge-in snapshot failed:`, err?.message || err);
        this.state.bargeInWorkflowSnapshot = null;
      }
    }
    
    let conv = conversations[this.state.callSid];
    if (!conv) {
      conversations[this.state.callSid] = {};
      conv = conversations[this.state.callSid];
    }
    conv.lastFullBargeInSequenceAt = Date.now();

    console.log(`🛑 [${this.state.callSid}] IMMEDIATE Barge-in triggered from ${source} - stopping audio IMMEDIATELY (<200ms target)`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] BARGE-IN DETECTION START - timestamp: ${bargeInDetectionTime}`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] Source: ${source}, isMultipleInterruption: ${isMultipleInterruption}`);
    
    // Save IDs before clearing
    const responseIdToCancel = this.state.activeResponseId;
    console.log(`🔍 [TEST-2] [${this.state.callSid}] Response ID to cancel: ${responseIdToCancel || 'N/A'}`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] Audio state before barge-in:`);
    console.log(`   - isResponding: ${this.state.isResponding}`);
    console.log(`   - hasAudioPacer: ${this.state.outboundAudioPacer !== null}`);
    console.log(`   - hasBufferedAudio: ${this.state.outboundAudioBuffer !== null && this.state.outboundAudioBuffer?.length > 0}`);
    console.log(`   - lastAudioChunkTime: ${this.state.lastAudioChunkTime || 'N/A'}`);
    console.log(`   - outboundAudioChunkCount: ${this.state.outboundAudioChunkCount || 0}`);
    
    // STEP 1: Cancel response at OpenAI level FIRST (stops future audio generation)
    // This must happen BEFORE clearing Twilio buffer to prevent new audio from being generated
    try {
      if (responseIdToCancel) {
        const sent = this.state.sendToOpenAI({
          type: 'response.cancel',
          response_id: responseIdToCancel
        }, { priority: 'high' });
        
        if (sent) {
          console.log(`🛑 [${this.state.callSid}] STEP 1: Sent response.cancel to OpenAI for ${responseIdToCancel} (stops audio generation)`);
        } else {
          console.warn(`⚠️ [${this.state.callSid}] STEP 1: response.cancel queued or connection not ready`);
        }
      } else if (this.state.isResponding) {
        // No tracked response ID but we believe a response is in-flight (Twilio pacer/buffer race).
        // Send response.cancel without response_id so OpenAI cancels any current generation.
        this.state.sendToOpenAI({ type: 'response.cancel' }, { priority: 'high' });
        console.warn(`⚠️ [${this.state.callSid}] STEP 1: No active response ID — sent blanket response.cancel (isResponding=true)`);
      } else {
        console.log(`ℹ️ [${this.state.callSid}] STEP 1: No active response ID and isResponding=false — skipping response.cancel`);
      }
      
      // Clear the input audio buffer using robust send method
      const bufferCleared = this.state.sendToOpenAI({
        type: 'input_audio_buffer.clear'
      }, { priority: 'high' });
      
      if (bufferCleared) {
        console.log(`🛑 [${this.state.callSid}] STEP 1: Cleared input audio buffer to prevent processing old audio`);
      } else {
        console.warn(`⚠️ [${this.state.callSid}] STEP 1: input_audio_buffer.clear queued or connection not ready`);
      }
    } catch (err) {
      console.warn(`⚠️ [${this.state.callSid}] STEP 1: Error sending response.cancel:`, err.message);
    }
    
    // STEP 2: IMMEDIATELY stop audio at Twilio level using native "clear" message (<50ms response time)
    // This sends Twilio's "clear" WebSocket message to flush all buffered audio instantly
    const step2StartTime = Date.now();
    console.log(`🔍 [TEST-2] [${this.state.callSid}] STEP 2 START - Calling immediatelyStopAudio() at ${step2StartTime}`);
    if (this.responseHandler) {
      this.responseHandler.immediatelyStopAudio();
      const step2Time = Date.now() - step2StartTime;
      console.log(`🔍 [TEST-2] [${this.state.callSid}] STEP 2 COMPLETE - immediatelyStopAudio() took ${step2Time}ms`);
    } else {
      console.warn(`⚠️ [${this.state.callSid}] STEP 2: ResponseHandler not available - falling back to state-based audio blocking`);
      console.log(`🔍 [TEST-2] [${this.state.callSid}] STEP 2 FAILED - ResponseHandler missing`);
    }
    
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    
    // Track interruption for quality metrics
    if (conversationBehaviorConfig?.qualityMetrics?.trackInterruptions) {
      conversationQualityService.trackInterruption(this.state.callSid);
    }
    
    // Track interruption for adaptive timing
    adaptiveTimingService.trackCallerBehavior(this.state.callSid, 'interruption', bargeInDetectionTime);
    
    // STEP 3: Set interruption flags and transition state back to listening
    this.state.isInterrupted = true;
    this.state.interruptionStartTime = bargeInDetectionTime;
    this.state.pendingTranscriptions = [];

    // CRITICAL: Stop periodic updates and cancel queue-driven update timer when user interrupts
    progressIndicatorService.stopPeriodicUpdates(this.state.callSid);
    progressIndicatorService.onBargeIn(this.state.callSid);
    console.log(`🛑 [${this.state.callSid}] STEP 3: Stopped periodic updates due to barge-in`);
    
    // Cancel grace period if active
    if (this.state.speechContinuationGraceTimer) {
      clearTimeout(this.state.speechContinuationGraceTimer);
      this.state.speechContinuationGraceTimer = null;
      console.log(`🛑 [${this.state.callSid}] STEP 3: Cancelled grace period due to interruption`);
    }
    this.state.speechStoppedTime = 0;
    this.state.speechResumedDuringGrace = false;
    this.state.gracePeriodExtensionCount = 0;
    // Preserve grace-merge buffer so barge-in does not drop user words (workflow/tool state unchanged)
    const pendingGrace = this.state.pendingTranscriptionsAfterGrace;
    if (Array.isArray(pendingGrace) && pendingGrace.length > 0) {
      const flushed = pendingGrace.map(t => t?.transcript).filter(Boolean).join(' ').trim();
      if (flushed) {
        let conv = conversations[this.state.callSid];
        if (!conv) {
          conversations[this.state.callSid] = {};
          conv = conversations[this.state.callSid];
        }
        const existing = (conv.bargeInFlushedGraceText || '').trim();
        conv.bargeInFlushedGraceText = existing ? `${existing} ${flushed}`.trim() : flushed;
        conv.bargeInFlushedGraceTextTime = Date.now();
        console.log(
          `📎 [${this.state.callSid}] Preserved ${pendingGrace.length} grace-buffer segment(s) before barge-in clear (${flushed.length} chars)`
        );
      }
    }
    this.state.pendingTranscriptionsAfterGrace = [];
    
    // STEP 4: Mark response as cancelled and clear response tracking
    if (responseIdToCancel) {
      this.state.cancelledResponseIds.add(responseIdToCancel);
      this.state.cancellationTime.set(responseIdToCancel, bargeInDetectionTime);
      console.log(`🚫 [${this.state.callSid}] STEP 4: Marked response ${responseIdToCancel} as cancelled - will block all audio chunks from this response`);
    }
    
    // STEP 5: Transition state back to listening mode
    this.state.activeResponseId = null;
    this.state.responseItemId = null;
    this.state.responseStartTime = null;
    this.state.isResponding = false;
    this.state.waitingForUser = true; // CRITICAL: Return to listening mode
    this.state.lastCancellationTime = bargeInDetectionTime;
    
    // STEP 6: Log barge-in completion - system is now listening for user input
    const totalBargeInTime = Date.now() - bargeInDetectionTime;
    console.log(`✅ [${this.state.callSid}] IMMEDIATE Barge-in complete in ${totalBargeInTime}ms (target: <200ms) - system now listening for user input`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] BARGE-IN COMPLETE - Total time: ${totalBargeInTime}ms (target: <200ms)`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] Final state:`);
    console.log(`   - isInterrupted: ${this.state.isInterrupted}`);
    console.log(`   - waitingForUser: ${this.state.waitingForUser}`);
    console.log(`   - isResponding: ${this.state.isResponding}`);
    console.log(`   - activeResponseId: ${this.state.activeResponseId || 'null'}`);
    
    // Track barge-in response time for metrics
    if (this.state.interruptionStartTime > 0) {
      const bargeInResponseTime = Date.now() - this.state.interruptionStartTime;
      conversationQualityService.trackBargeInResponseTime(this.state.callSid, bargeInResponseTime);
      console.log(`📊 [${this.state.callSid}] Barge-in response time: ${bargeInResponseTime}ms`);
      console.log(`🔍 [TEST-2] [${this.state.callSid}] METRIC - Barge-in response time: ${bargeInResponseTime}ms`);
    }
  }

  /**
   * Fallback barge-in when speech_started was missed but user audio still overlaps agent playback.
   * Primary path is always speech_started; this ensures Twilio clear + cancel when needed.
   * @param {string} transcript - Transcription text (for logging only)
   */
  triggerBargeInFromTranscription(transcript) {
    if (this.state.isInterrupted) {
      console.log(`✅ [${this.state.callSid}] Barge-in already triggered on speech_started - transcription overlap: "${transcript}"`);
      // Ensure audio is stopped (may have been missed)
      if (this.responseHandler) {
        this.responseHandler.immediatelyStopAudio();
      }
      return;
    }
    
    // Fallback: If barge-in wasn't triggered on speech_started (edge case), trigger now
    console.log(`🛑 [${this.state.callSid}] Barge-in triggered from transcription (fallback): "${transcript}" - stopping audio IMMEDIATELY`);
    this.triggerImmediateBargeIn('transcription');
  }
}
