import configManager from '../../../agent/configManager.js';
import conversationQualityService from '../../../services/conversationQualityService.js';
import adaptiveTimingService from '../../../services/adaptiveTimingService.js';
import progressIndicatorService from '../../../services/progressIndicatorService.js';

/**
 * Barge-in Handler
 * Handles user interruptions during agent responses
 * Production-ready: Supports concurrent calls, immediate Twilio-level audio stopping
 */
export class BargeInHandler {
  constructor(stateManager, openaiWs, responseHandler = null) {
    this.state = stateManager;
    this.openaiWs = openaiWs;
    this.responseHandler = responseHandler; // Reference to ResponseHandler for immediate audio stopping
  }

  /**
   * Handle speech_started event (user speaking detection)
   * NEW BEHAVIOR: Do NOT trigger barge-in immediately - wait for transcription to check for "stop"
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
        // Speech resumed during grace period
        this.state.speechResumedDuringGrace = true;
        this.state.gracePeriodExtensionCount++;
        
        // Cancel grace period timer
        if (this.state.speechContinuationGraceTimer) {
          clearTimeout(this.state.speechContinuationGraceTimer);
          this.state.speechContinuationGraceTimer = null;
        }
        
        const maxExtensions = speechContinuation.maxGracePeriodExtensions || 2;
        if (this.state.gracePeriodExtensionCount <= maxExtensions) {
          console.log(`🔄 [${this.state.callSid}] Speech resumed during grace period (extension ${this.state.gracePeriodExtensionCount}/${maxExtensions}, ${Math.round(timeSinceSpeechStopped)}ms after speech stopped) - continuing to listen`);
          this.state.speechStoppedTime = 0;
          return; // Exit early, don't process as barge-in
        } else {
          console.log(`⚠️ [${this.state.callSid}] Max grace period extensions reached (${this.state.gracePeriodExtensionCount}) - processing transcriptions`);
          this.state.speechResumedDuringGrace = false;
          this.state.gracePeriodExtensionCount = 0;
          this.state.speechStoppedTime = 0;
        }
      }
    }
    
    // CRITICAL: Only track potential barge-in if agent is actively speaking
    // Do NOT trigger barge-in immediately - wait for transcription to check for "stop"
    if (this.state.activeResponseId && this.state.isResponding) {
      // Check if user speech started before this response was created
      const timeSinceResponseCreated = this.state.responseStartTime > 0 ? Date.now() - this.state.responseStartTime : Infinity;
      const userSpokeBeforeResponse = this.state.userSpeechStartedTime < this.state.responseStartTime || timeSinceResponseCreated > 2000;
      
      if (userSpokeBeforeResponse) {
        console.log(`👤 [${this.state.callSid}] User speech started before response was created (normal input, not barge-in) - response created ${timeSinceResponseCreated}ms ago`);
        return; // Don't treat as barge-in
      }
      
      // User is speaking while agent is responding - mark for potential barge-in check
      // Set flag to indicate we're waiting for transcription to check for "stop"
      this.state.pendingBargeInCheck = true;
      console.log(`👂 [${this.state.callSid}] User speaking during agent response ${this.state.activeResponseId} - waiting for transcription to check for "stop" command`);
      
      // Do NOT stop audio, cancel response, or set isInterrupted flag here
      // Wait for transcription to arrive and check for "stop" keyword
      return;
    } else {
      // Normal user input - agent is waiting, not responding
      return; // Exit early if barge-in conditions not met
    }
  }

  /**
   * Trigger barge-in IMMEDIATELY when "stop" is detected in transcription
   * This method executes synchronously with no delays - audio stops within milliseconds
   * @param {string} transcript - The transcription text that contains "stop"
   */
  triggerBargeInFromTranscription(transcript) {
    const bargeInDetectionTime = Date.now();
    const isMultipleInterruption = this.state.isInterrupted;
    
    console.log(`🛑 [${this.state.callSid}] Barge-in triggered from transcription: "${transcript}" - stopping audio IMMEDIATELY`);
    
    // STEP 1: IMMEDIATELY stop audio at Twilio level (<50ms response time)
    if (this.responseHandler) {
      this.responseHandler.immediatelyStopAudio();
    } else {
      console.warn(`⚠️ [${this.state.callSid}] ResponseHandler not available - falling back to state-based audio blocking`);
    }
    
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    
    // Track interruption for quality metrics
    if (conversationBehaviorConfig?.qualityMetrics?.trackInterruptions) {
      conversationQualityService.trackInterruption(this.state.callSid);
    }
    
    // Track interruption for adaptive timing
    adaptiveTimingService.trackCallerBehavior(this.state.callSid, 'interruption', bargeInDetectionTime);
    
    // STEP 2: Set interruption flags and transition state back to listening
    this.state.isInterrupted = true;
    this.state.interruptionStartTime = bargeInDetectionTime;
    this.state.pendingTranscriptions = [];
    this.state.pendingBargeInCheck = false; // Clear the pending check flag
    
    // CRITICAL: Stop periodic updates immediately when user interrupts
    progressIndicatorService.stopPeriodicUpdates(this.state.callSid);
    console.log(`🛑 [${this.state.callSid}] Stopped periodic updates due to barge-in`);
    
    // Cancel grace period if active
    if (this.state.speechContinuationGraceTimer) {
      clearTimeout(this.state.speechContinuationGraceTimer);
      this.state.speechContinuationGraceTimer = null;
      console.log(`🛑 [${this.state.callSid}] Cancelled grace period due to interruption`);
    }
    this.state.speechStoppedTime = 0;
    this.state.speechResumedDuringGrace = false;
    this.state.gracePeriodExtensionCount = 0;
    this.state.pendingTranscriptionsAfterGrace = [];
    
    // Save IDs before clearing
    const responseIdToCancel = this.state.activeResponseId;
    
    // STEP 3: Mark response as cancelled and clear response tracking
    if (responseIdToCancel) {
      this.state.cancelledResponseIds.add(responseIdToCancel);
      this.state.cancellationTime.set(responseIdToCancel, bargeInDetectionTime);
      console.log(`🚫 [${this.state.callSid}] Marked response ${responseIdToCancel} as cancelled - will block all audio chunks from this response`);
    }
    
    // STEP 4: Transition state back to listening mode
    this.state.activeResponseId = null;
    this.state.responseItemId = null;
    this.state.responseStartTime = null;
    this.state.isResponding = false;
    this.state.waitingForUser = true; // CRITICAL: Return to listening mode
    this.state.lastCancellationTime = bargeInDetectionTime;
    
    // STEP 5: Cancel response at OpenAI level (using robust sendToOpenAI method)
    try {
      // Cancel the active response using robust send method
      if (responseIdToCancel) {
        const sent = this.state.sendToOpenAI({
          type: 'response.cancel',
          response_id: responseIdToCancel
        }, { priority: 'high' });
        
        if (sent) {
          console.log(`🛑 [${this.state.callSid}] Sent response.cancel for ${responseIdToCancel}${isMultipleInterruption ? ' (multiple interruption)' : ''}`);
        } else {
          console.warn(`⚠️ [${this.state.callSid}] response.cancel queued or connection not ready`);
        }
      }
      
      // Clear the input audio buffer using robust send method
      const bufferCleared = this.state.sendToOpenAI({
        type: 'input_audio_buffer.clear'
      }, { priority: 'high' });
      
      if (bufferCleared) {
        console.log(`🛑 [${this.state.callSid}] Cleared input audio buffer to prevent processing old audio${isMultipleInterruption ? ' (multiple interruption)' : ''}`);
      } else {
        console.warn(`⚠️ [${this.state.callSid}] input_audio_buffer.clear queued or connection not ready`);
      }
    } catch (err) {
      console.warn(`⚠️ [${this.state.callSid}] Error sending response.cancel (non-critical):`, err.message);
    }
    
    // STEP 6: Log barge-in completion - system is now listening for user input
    const totalBargeInTime = Date.now() - bargeInDetectionTime;
    console.log(`✅ [${this.state.callSid}] Barge-in complete in ${totalBargeInTime}ms - system now listening for user input`);
  }
}

