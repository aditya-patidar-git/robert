import { WebSocket } from "ws";
import configManager from '../../../agent/configManager.js';
import conversationQualityService from '../../../services/conversationQualityService.js';
import audioDiagnosticService from '../../../services/audioDiagnosticService.js';
import { MemoryManager } from '../utils/index.js';
import { conversations } from '../../../shared/state.js';
// Audio conversion removed - OpenAI is configured for g711_ulaw, we trust the configuration

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
    
    // CRITICAL DEBUG: Log detailed response information to diagnose audio issues
    const responseModalities = event.response?.modalities || [];
    const hasAudioModality = responseModalities.includes('audio');
    console.log(`🔍 [${this.state.callSid}] Response creation details:`);
    console.log(`   - Response ID: ${this.state.activeResponseId}`);
    console.log(`   - Modalities: ${JSON.stringify(responseModalities)}`);
    console.log(`   - Has audio modality: ${hasAudioModality}`);
    console.log(`   - Explicit response requested: ${this.state.explicitResponseRequested}`);
    if (!hasAudioModality) {
      console.warn(`⚠️ [${this.state.callSid}] WARNING: Response created WITHOUT audio modality! This will prevent audio generation.`);
    }
    
    // Check if response has errors
    if (event.response?.error) {
      console.error(`❌ [${this.state.callSid}] Response created with error:`, JSON.stringify(event.response.error, null, 2));
    }
    
    // Track in diagnostic service (non-intrusive, optional)
    audioDiagnosticService.trackResponseCreated(this.state.callSid, event);
    
    // Block automatic responses that we didn't explicitly request
    if (!this.state.explicitResponseRequested) {
      const currentTime = Date.now();
      const timeSinceTranscription = this.state.lastTranscriptionReceivedTime > 0 ? currentTime - this.state.lastTranscriptionReceivedTime : Infinity;
      const timeSinceAgentFinished = this.state.agentFinishedSpeakingTime > 0 ? currentTime - this.state.agentFinishedSpeakingTime : Infinity;
      const isRecentTranscription = this.state.lastTranscriptionReceivedTime > 0 && timeSinceTranscription >= 0 && timeSinceTranscription < 3000;
      const isWithinUserSpeakingWindow = this.state.agentFinishedSpeakingTime > 0 && timeSinceAgentFinished >= 0 && timeSinceAgentFinished < this.state.userSpeakingWindowMs;
      const userSpokeBeforeResponse = this.state.userSpeechStartedTime > 0 && this.state.userSpeechStartedTime < this.state.responseStartTime;
      
      const isInterrupted = this.state.isInterrupted;
      const isRespondingToDifferentResponse = this.state.isResponding && this.state.activeResponseId !== event.response?.id;
      const shouldBlockWaiting = this.state.waitingForUser && !isRecentTranscription && !isWithinUserSpeakingWindow && !userSpokeBeforeResponse;
      
      const shouldBlock = isInterrupted || isRespondingToDifferentResponse || shouldBlockWaiting;
      
      if (shouldBlock) {
        // Detailed logging for why response is being blocked
        console.log(`🚫 [${this.state.callSid}] Blocking automatic response - ID: ${this.state.activeResponseId}`);
        console.log(`   📊 Blocking reasons:`);
        console.log(`      - explicitResponseRequested: ${this.state.explicitResponseRequested}`);
        console.log(`      - isInterrupted: ${isInterrupted}`);
        console.log(`      - isResponding: ${this.state.isResponding}, activeResponseId: ${this.state.activeResponseId}, newResponseId: ${event.response?.id}`);
        console.log(`      - isRespondingToDifferentResponse: ${isRespondingToDifferentResponse}`);
        console.log(`      - waitingForUser: ${this.state.waitingForUser}`);
        console.log(`      - timeSinceTranscription: ${timeSinceTranscription}ms (recent: ${isRecentTranscription})`);
        console.log(`      - timeSinceAgentFinished: ${timeSinceAgentFinished}ms (within window: ${isWithinUserSpeakingWindow})`);
        console.log(`      - userSpokeBeforeResponse: ${userSpokeBeforeResponse}`);
        console.log(`      - shouldBlockWaiting: ${shouldBlockWaiting}`);
        
        try {
          if (this.state.openaiWs && this.state.openaiWs.readyState === 1) {
            this.state.openaiWs.send(JSON.stringify({
              type: 'response.cancel',
              response_id: this.state.activeResponseId
            }));
            console.log(`   ✅ Sent response.cancel to OpenAI for response ${this.state.activeResponseId}`);
          } else {
            console.warn(`   ⚠️ Cannot cancel response - OpenAI WS readyState: ${this.state.openaiWs?.readyState}`);
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
    // Track outbound audio separately
    this.state.outboundAudioChunkCount++;
    
    // Track in diagnostic service (non-intrusive, optional)
    audioDiagnosticService.trackAudioDelta(this.state.callSid, event);
    
    this.state.isResponding = true;
    this.state.lastAudioChunkTime = Date.now();
    this.state.audioChunkCount++;  // Keep for backward compatibility
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
      return false; // Don't send audio chunks
    }
    
    // Verify audio payload format
    if (!event.delta) {
      console.error(`❌ [${this.state.callSid}] Audio delta event missing payload for chunk #${this.state.outboundAudioChunkCount}`);
      return false;
    }
    
    // Validate payload is a string (base64-encoded audio)
    const audioPayload = event.delta;
    if (typeof audioPayload !== 'string') {
      console.error(`❌ [${this.state.callSid}] Audio payload is not a string - type: ${typeof audioPayload}`);
      return false;
    }
    
    // Validate it looks like base64 (basic check)
    if (audioPayload.length === 0) {
      console.error(`❌ [${this.state.callSid}] Audio payload is empty for chunk #${this.state.outboundAudioChunkCount}`);
      return false;
    }
    
    // CRITICAL: Buffer and pace audio chunks to prevent noise
    // OpenAI sends variable-sized chunks, but Twilio needs consistent 20ms frames
    // Buffer the audio and send at proper rate (160 bytes per 20ms for g711_ulaw at 8kHz)
    if (!this.state.outboundAudioBuffer) {
      this.state.outboundAudioBuffer = Buffer.alloc(0);
      this.state.lastOutboundSendTime = Date.now();
    }
    
    try {
      // Decode base64 audio payload
      const audioChunk = Buffer.from(audioPayload, 'base64');
      
      // OpenAI is configured to send g711_ulaw - trust the configuration
      // Buffer the audio directly without conversion
      this.state.outboundAudioBuffer = Buffer.concat([this.state.outboundAudioBuffer, audioChunk]);
      
      // Constants for g711_ulaw at 8kHz: 160 bytes = 20ms of audio
      const FRAME_SIZE = 160; // 20ms of g711_ulaw at 8kHz
      const FRAME_INTERVAL_MS = 20;
      
      // Try to send a frame immediately if enough time has passed
      const now = Date.now();
      const timeSinceLastSend = now - this.state.lastOutboundSendTime;
      
      if (timeSinceLastSend >= FRAME_INTERVAL_MS && this.state.outboundAudioBuffer.length >= FRAME_SIZE) {
        this.sendAudioFrame(FRAME_SIZE, false);
      }
      
      // Start pacer if not already running and we have buffered data
      if (this.state.outboundAudioBuffer.length >= FRAME_SIZE && !this.state.outboundAudioPacer) {
        this.startAudioPacer(FRAME_SIZE, FRAME_INTERVAL_MS, false);
      }
      
      return true;
    } catch (err) {
      this.state.incrementErrorCount();
      console.error(`❌ [${this.state.callSid}] ERROR processing audio chunk #${this.state.outboundAudioChunkCount}:`, err.message);
      return false;
    }
  }

  /**
   * Send a single audio frame to Twilio
   */
  sendAudioFrame(frameSize, shouldLog = false) {
    if (!this.state.outboundAudioBuffer || this.state.outboundAudioBuffer.length < frameSize) {
      return false;
    }
    
    if (this.ws.readyState !== WebSocket.OPEN || !this.state.streamSid || this.state.isClosed) {
      return false;
    }
    
    try {
      const frame = this.state.outboundAudioBuffer.slice(0, frameSize);
      this.state.outboundAudioBuffer = this.state.outboundAudioBuffer.slice(frameSize);
      this.state.lastOutboundSendTime = Date.now();
      
      const mediaMessage = {
        event: 'media',
        streamSid: this.state.streamSid,
        media: { 
          payload: frame.toString('base64'),
          track: 'outbound'  // Explicitly specify outbound track for reliable routing (especially for inbound calls)
        }
      };
      
      const messageJson = JSON.stringify(mediaMessage);
      
      this.ws.send(messageJson);
      
      return true;
    } catch (err) {
      console.error(`❌ [${this.state.callSid}] ERROR sending audio frame:`, err.message);
      this.state.incrementErrorCount();
      return false;
    }
  }

  /**
   * Start audio pacer to send frames at correct rate
   */
  startAudioPacer(frameSize, frameIntervalMs, shouldLog = false) {
    if (this.state.outboundAudioPacer) {
      return; // Already running
    }
    
    this.state.outboundAudioPacer = setInterval(() => {
      if (this.state.isClosed || !this.state.streamSid || this.ws.readyState !== WebSocket.OPEN) {
        this.stopAudioPacer();
        return;
      }
      
      if (this.state.outboundAudioBuffer && this.state.outboundAudioBuffer.length >= frameSize) {
        this.sendAudioFrame(frameSize, false);
      } else {
        this.stopAudioPacer();
      }
    }, frameIntervalMs);
  }

  /**
   * Stop audio pacer
   */
  stopAudioPacer() {
    if (this.state.outboundAudioPacer) {
      clearInterval(this.state.outboundAudioPacer);
      this.state.outboundAudioPacer = null;
    }
  }

  /**
   * Cleanup audio buffer and pacer
   */
  cleanupAudioBuffer() {
    this.stopAudioPacer();
    this.state.outboundAudioBuffer = null;
    this.state.lastOutboundSendTime = 0;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.cleanupAudioBuffer();
  }

  /**
   * Handle response.done event
   */
  handleResponseDone(event) {
    const status = event.response?.status || 'completed';
    const responseId = event.response?.id;
    // Fix: Error is nested under status_details, not directly under response
    const error = event.response?.status_details?.error || event.response?.error;
    
    if (status === 'failed') {
      console.error(`❌ [${this.state.callSid}] Response failed:`, error || 'undefined');
      if (error) {
        console.error(`   🔍 Error type: ${error.type || 'unknown'}`);
        console.error(`   🔍 Error code: ${error.code || 'null'}`);
        console.error(`   🔍 Error message: ${error.message || 'No message'}`);
      }
      console.error(`   📋 Full event:`, JSON.stringify(event, null, 2));
      console.error(`   📋 Response object:`, JSON.stringify(event.response, null, 2));
    }
    
    // Only clear response tracking if this is the active response
    if (responseId === this.state.activeResponseId) {
      // Log audio summary before clearing state
      const outboundChunksForResponse = this.state.outboundAudioChunkCount;
      const totalInboundChunks = this.state.inboundAudioChunkCount || 0;
      
      // Extract token counts
      const audioTokens = event.response?.usage?.output_token_details?.audio_tokens || 
                         event.response?.usage?.output_audio_tokens || 0;
      const textTokens = event.response?.usage?.output_token_details?.text_tokens || 
                        event.response?.usage?.output_text_tokens || 0;
      
      // Check for OpenAI refusal response (0 audio tokens despite audio modality)
      const hasAudioModality = event.response?.modalities?.includes('audio') || false;
      const isRefusalResponse = audioTokens === 0 && hasAudioModality && textTokens > 0;
      
      // Extract response text to check for refusal patterns AND add to transcript
      const outputItems = event.response?.output || [];
      let responseText = '';
      let fullResponseText = ''; // Full text for transcript (not lowercased)
      if (outputItems && outputItems.length > 0) {
        const textItems = outputItems.filter(item => item.type === 'message' && item.content);
        if (textItems.length > 0) {
          fullResponseText = textItems.map(item => 
            item.content.map(c => c.type === 'text' ? c.text : '').join('')
          ).join(' ').trim();
          responseText = fullResponseText.toLowerCase();
        }
      }
      
      // Add agent response to conversation transcript
      if (fullResponseText && status === 'completed') {
        if (conversations[this.state.callSid]) {
          conversations[this.state.callSid].transcript.push({
            role: 'agent',
            text: fullResponseText,
            timestamp: new Date()
          });
          console.log(`📝 [${this.state.callSid}] Added agent response to transcript: "${fullResponseText.substring(0, 50)}${fullResponseText.length > 50 ? '...' : ''}"`);
        }
      }
      
      const refusalPatterns = [
        "i'm sorry, but i'm not able to continue",
        "i'm sorry, it seems like there was an error",
        "i can't continue",
        "i cannot continue"
      ];
      const isRefusalText = refusalPatterns.some(pattern => responseText.includes(pattern));
      
      console.log(`✅ [${this.state.callSid}] Response done - ID: ${responseId}, status: ${status}`);
      console.log(`   📊 Tokens: audio=${audioTokens}, text=${textTokens}`);
      
      // Detect and log refusal response
      if (isRefusalResponse || isRefusalText) {
        console.warn(`⚠️ [${this.state.callSid}] OpenAI refusal response detected:`);
        console.warn(`   - Audio tokens: ${audioTokens} (expected > 0)`);
        console.warn(`   - Text tokens: ${textTokens}`);
        console.warn(`   - Has audio modality: ${hasAudioModality}`);
        console.warn(`   - Response text contains refusal pattern: ${isRefusalText}`);
        console.warn(`   - Possible causes:`);
        console.warn(`     1. Conversation context not properly established`);
        console.warn(`     2. Instructions causing OpenAI to refuse`);
        console.warn(`     3. Safety/content filter triggered`);
        console.warn(`     4. Session configuration issue`);
        
        // For initial greeting, this is critical - log as error
        if (!this.state.hasInitialGreetingCompleted) {
          console.error(`❌ [${this.state.callSid}] CRITICAL: Initial greeting failed - no audio generated`);
          console.error(`   This will result in silent call. Check conversation context and instructions.`);
        }
      }
      
      // Track in diagnostic service (non-intrusive, optional)
      audioDiagnosticService.trackResponseDone(this.state.callSid, event);
      
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
        
        // Check for memory consent after greeting completes (non-blocking)
        const memoryManager = new MemoryManager(this.state);
        memoryManager.checkAndRequestMemoryConsent().catch(err => {
          console.error(`⚠️ [${this.state.callSid}] Memory consent check failed (non-blocking):`, err);
        });
      }
      
      // Clear interruption state if response completed successfully
      if (status === 'completed' && this.state.isInterrupted) {
        console.log(`✅ [${this.state.callSid}] Response completed - clearing interruption state`);
        this.state.isInterrupted = false;
        this.state.interruptionStartTime = 0;
        this.state.pendingTranscriptions = [];
      }
      
      // Flush remaining audio buffer before response ends
      // Send any remaining buffered audio frames
      if (this.state.outboundAudioBuffer && this.state.outboundAudioBuffer.length > 0) {
        const FRAME_SIZE = 160;
        while (this.state.outboundAudioBuffer.length >= FRAME_SIZE) {
          this.sendAudioFrame(FRAME_SIZE, false);
        }
        // If there's a small remainder, send it as-is (better than dropping)
        if (this.state.outboundAudioBuffer.length > 0) {
          const remainder = this.state.outboundAudioBuffer;
          this.state.outboundAudioBuffer = Buffer.alloc(0);
          if (this.ws.readyState === WebSocket.OPEN && this.state.streamSid && !this.state.isClosed) {
            try {
              const mediaMessage = {
                event: 'media',
                streamSid: this.state.streamSid,
                media: { 
                  payload: remainder.toString('base64')
                }
              };
              this.ws.send(JSON.stringify(mediaMessage));
            } catch (err) {
              console.warn(`⚠️ [${this.state.callSid}] Error sending final audio buffer:`, err.message);
            }
          }
        }
      }
      
      // Stop pacer when response is done
      this.stopAudioPacer();
    } else {
      // Response completed but it's not the active one (might have been cancelled)
      console.log(`ℹ️ [${this.state.callSid}] Response done for non-active response - ID: ${responseId}, status: ${status}, activeResponseId: ${this.state.activeResponseId}`);
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

