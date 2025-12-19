import configManager from '../../../agent/configManager.js';
import conversationQualityService from '../../../services/conversationQualityService.js';
import adaptiveTimingService from '../../../services/adaptiveTimingService.js';

/**
 * Barge-in Handler
 * Handles user interruptions during agent responses
 */
export class BargeInHandler {
  constructor(stateManager, openaiWs) {
    this.state = stateManager;
    this.openaiWs = openaiWs;
  }

  /**
   * Handle speech_started event (barge-in detection)
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
    
    // CRITICAL: Barge-in ONLY occurs when agent is actively speaking (isResponding = true)
    if (this.state.activeResponseId && this.state.isResponding) {
      // Check if user speech started before this response was created
      const timeSinceResponseCreated = this.state.responseStartTime > 0 ? Date.now() - this.state.responseStartTime : Infinity;
      const userSpokeBeforeResponse = this.state.userSpeechStartedTime < this.state.responseStartTime || timeSinceResponseCreated > 2000;
      
      if (userSpokeBeforeResponse) {
        console.log(`👤 [${this.state.callSid}] User speech started before response was created (normal input, not barge-in) - response created ${timeSinceResponseCreated}ms ago`);
        return; // Don't treat as barge-in
      }
    } else {
      // Normal user input - agent is waiting, not responding
      return; // Exit early if barge-in conditions not met
    }
    
    // CRITICAL: User is interrupting an active response
    const isMultipleInterruption = this.state.isInterrupted;
    console.log(`🛑 [${this.state.callSid}] Barge-in detected! User is interrupting agent response ${this.state.activeResponseId} (agent was actively speaking)${isMultipleInterruption ? ' - multiple interruption' : ''}`);
    
    // Track interruption for quality metrics
    if (conversationBehaviorConfig?.qualityMetrics?.trackInterruptions) {
      conversationQualityService.trackInterruption(this.state.callSid);
    }
    
    // Track interruption for adaptive timing
    adaptiveTimingService.trackCallerBehavior(this.state.callSid, 'interruption', Date.now());
    
    // Set interruption flags
    this.state.isInterrupted = true;
    this.state.interruptionStartTime = Date.now();
    this.state.pendingTranscriptions = [];
    
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
    
    // Mark this response as cancelled
    if (responseIdToCancel) {
      this.state.cancelledResponseIds.add(responseIdToCancel);
      this.state.cancellationTime.set(responseIdToCancel, Date.now());
      console.log(`🚫 [${this.state.callSid}] Marked response ${responseIdToCancel} as cancelled - will block all audio chunks from this response`);
    }
    
    // Clear response tracking immediately
    this.state.activeResponseId = null;
    this.state.responseItemId = null;
    this.state.responseStartTime = null;
    this.state.isResponding = false;
    this.state.waitingForUser = true;
    this.state.lastCancellationTime = Date.now();
    
    try {
      // Cancel the active response
      if (responseIdToCancel) {
        this.openaiWs.send(JSON.stringify({
          type: 'response.cancel',
          response_id: responseIdToCancel
        }));
        console.log(`🛑 [${this.state.callSid}] Sent response.cancel for ${responseIdToCancel}${isMultipleInterruption ? ' (multiple interruption)' : ''}`);
      }
      
      // Clear the input audio buffer
      this.openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.clear'
      }));
      console.log(`🛑 [${this.state.callSid}] Cleared input audio buffer to prevent processing old audio${isMultipleInterruption ? ' (multiple interruption)' : ''}`);
    } catch (err) {
      console.warn(`⚠️ [${this.state.callSid}] Error sending response.cancel (non-critical):`, err.message);
    }
  }
}

