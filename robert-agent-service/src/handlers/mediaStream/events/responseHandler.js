import { WebSocket } from "ws";
import configManager from '../../../agent/configManager.js';
import conversationQualityService from '../../../services/conversationQualityService.js';

/**
 * Response Handler
 * Handles response creation, completion, and audio streaming
 */
export class ResponseHandler {
  constructor(stateManager, ws) {
    this.state = stateManager;
    this.ws = ws;
  }

  /**
   * Handle response.created event
   */
  handleResponseCreated(event) {
    this.state.activeResponseId = event.response?.id;
    const currentTime = Date.now();
    this.state.responseStartTime = currentTime;
    
    // Track response latency
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    if (conversationBehaviorConfig?.qualityMetrics?.trackLatency && this.state.lastProcessedTranscriptionTime > 0) {
      const latency = currentTime - this.state.lastProcessedTranscriptionTime;
      conversationQualityService.trackResponseLatency(this.state.callSid, latency);
    }
    
    console.log(`📝 [${this.state.callSid}] Response created - ID: ${this.state.activeResponseId}, modalities: ${JSON.stringify(event.response?.modalities || [])}, isResponding: ${this.state.isResponding}`);
    
    // Check if response has errors
    if (event.response?.error) {
      console.error(`❌ [${this.state.callSid}] Response created with error:`, JSON.stringify(event.response.error, null, 2));
    }
    
    // Block automatic responses that we didn't explicitly request
    if (!this.state.explicitResponseRequested) {
      const currentTime = Date.now();
      const timeSinceTranscription = this.state.lastTranscriptionReceivedTime > 0 ? currentTime - this.state.lastTranscriptionReceivedTime : Infinity;
      const timeSinceAgentFinished = this.state.agentFinishedSpeakingTime > 0 ? currentTime - this.state.agentFinishedSpeakingTime : Infinity;
      const isRecentTranscription = this.state.lastTranscriptionReceivedTime > 0 && timeSinceTranscription >= 0 && timeSinceTranscription < 3000;
      const isWithinUserSpeakingWindow = this.state.agentFinishedSpeakingTime > 0 && timeSinceAgentFinished >= 0 && timeSinceAgentFinished < this.state.userSpeakingWindowMs;
      const userSpokeBeforeResponse = this.state.userSpeechStartedTime > 0 && this.state.userSpeechStartedTime < this.state.responseStartTime;
      
      const shouldBlock = this.state.isInterrupted || 
                         (this.state.isResponding && this.state.activeResponseId !== event.response?.id) ||
                         (this.state.waitingForUser && !isRecentTranscription && !isWithinUserSpeakingWindow && !userSpokeBeforeResponse);
      
      if (shouldBlock) {
        console.log(`🚫 [${this.state.callSid}] Blocking automatic response (barge-in/ghost) - ID: ${this.state.activeResponseId}`);
        try {
          if (this.state.openaiWs && this.state.openaiWs.readyState === 1) {
            this.state.openaiWs.send(JSON.stringify({
              type: 'response.cancel',
              response_id: this.state.activeResponseId
            }));
          }
          this.state.activeResponseId = null;
          this.state.isResponding = false;
          this.state.waitingForUser = true;
          return false; // Don't process this response
        } catch (err) {
          console.warn(`⚠️ [${this.state.callSid}] Error cancelling automatic response:`, err.message);
        }
      }
    }
    
    // Reset the flag after processing
    this.state.explicitResponseRequested = false;
    this.state.isResponding = true;
    
    return true;
  }

  /**
   * Handle response.audio.delta event
   */
  handleAudioDelta(event) {
    this.state.isResponding = true;
    this.state.lastAudioChunkTime = Date.now();
    this.state.audioChunkCount++;
    const responseTime = Date.now();
    this.state.audioMetrics.responseTimestamps.push(responseTime);
    this.state.audioMetrics.lastResponseTime = responseTime;
    
    // Get response ID from event if available
    const currentResponseId = event.response_id || this.state.activeResponseId;
    
    // Block audio if response was cancelled
    const isCancelledResponse = currentResponseId && this.state.cancelledResponseIds.has(currentResponseId);
    const cancellationTimestamp = currentResponseId ? this.state.cancellationTime.get(currentResponseId) : null;
    const timeSinceCancellation = cancellationTimestamp ? Date.now() - cancellationTimestamp : Infinity;
    const withinGracePeriod = cancellationTimestamp && timeSinceCancellation < this.state.AUDIO_CANCELLATION_GRACE_PERIOD;
    
    if (this.state.isInterrupted || isCancelledResponse || (cancellationTimestamp && withinGracePeriod)) {
      if (this.state.audioChunkCount % 100 === 0 || this.state.audioChunkCount < 5) {
        console.log(`🔇 [${this.state.callSid}] Blocking audio chunk #${this.state.audioChunkCount} - response interrupted/cancelled`);
      }
      return false; // Don't send audio chunks
    }
    
    // Send audio to Twilio
    if (this.ws.readyState === WebSocket.OPEN && this.state.streamSid && !this.state.isClosed) {
      try {
        this.ws.send(JSON.stringify({
          event: 'media',
          streamSid: this.state.streamSid,
          media: { payload: event.delta }
        }));
        return true;
      } catch (err) {
        this.state.incrementErrorCount();
        console.error('❌ Error sending audio to Twilio:', err);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Handle response.done event
   */
  handleResponseDone(event) {
    const status = event.response?.status || 'completed';
    const responseId = event.response?.id;
    const error = event.response?.error;
    
    if (status === 'failed') {
      console.error(`❌ [${this.state.callSid}] Response failed:`, error);
    }
    
    // Only clear response tracking if this is the active response
    if (responseId === this.state.activeResponseId) {
      console.log(`✅ [${this.state.callSid}] Response done - ID: ${responseId}, status: ${status}`);
      
      // Mark that agent finished speaking
      this.state.agentFinishedSpeakingTime = Date.now();
      
      // Clear response tracking
      this.state.activeResponseId = null;
      this.state.responseItemId = null;
      this.state.responseStartTime = null;
      this.state.isResponding = false;
      this.state.waitingForUser = true;
      
      // Mark initial greeting as completed if this was the first response
      if (!this.state.hasInitialGreetingCompleted && this.state.hasInitialGreetingBeenSent) {
        this.state.hasInitialGreetingCompleted = true;
        console.log(`🎯 [${this.state.callSid}] Initial greeting completed`);
      }
      
      // Clear interruption state if response completed successfully
      if (status === 'completed' && this.state.isInterrupted) {
        console.log(`✅ [${this.state.callSid}] Response completed - clearing interruption state`);
        this.state.isInterrupted = false;
        this.state.interruptionStartTime = 0;
        this.state.pendingTranscriptions = [];
      }
    }
  }

  /**
   * Handle conversation.item.created (for response item ID)
   */
  handleItemCreated(event) {
    if (event.item?.role === 'assistant') {
      if (this.state.activeResponseId && !this.state.responseItemId) {
        this.state.responseItemId = event.item?.id;
        console.log(`📝 [${this.state.callSid}] Response item created - Item ID: ${this.state.responseItemId} for response ${this.state.activeResponseId}`);
      }
    }
  }
}

