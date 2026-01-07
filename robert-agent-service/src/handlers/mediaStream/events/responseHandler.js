import { WebSocket } from "ws";
import configManager from '../../../agent/configManager.js';
import conversationQualityService from '../../../services/conversationQualityService.js';
import { MemoryManager } from '../utils/index.js';

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
   * Analyze audio chunk to detect format
   */
  analyzeAudioFormat(audioChunk, chunkNumber, event) {
    if (chunkNumber > 5) return; // Only analyze first 5 chunks
    
    const chunkSize = audioChunk.length;
    const sampleCount = chunkSize; // For g711_ulaw: 1 byte per sample
    const pcm16SampleCount = chunkSize / 2; // For PCM16: 2 bytes per sample
    
    // Analyze byte patterns
    let maxValue = 0;
    let minValue = 255;
    let zeroCount = 0;
    
    for (let i = 0; i < Math.min(100, chunkSize); i++) {
      const byte = audioChunk[i];
      maxValue = Math.max(maxValue, byte);
      minValue = Math.min(minValue, byte);
      if (byte === 0) zeroCount++;
    }
    
    console.log(`🔍 [${this.state.callSid}] Audio chunk #${chunkNumber} analysis:`);
    console.log(`   - Raw chunk size: ${chunkSize} bytes`);
    console.log(`   - Base64 payload length: ${typeof event?.delta === 'string' ? event.delta.length : 'N/A'} chars`);
    console.log(`   - If g711_ulaw: ${sampleCount} samples (${(sampleCount / 8000 * 1000).toFixed(1)}ms at 8kHz)`);
    console.log(`   - If PCM16 at 8kHz: ${pcm16SampleCount} samples (${(pcm16SampleCount / 8000 * 1000).toFixed(1)}ms)`);
    console.log(`   - If PCM16 at 24kHz: ${pcm16SampleCount} samples (${(pcm16SampleCount / 24000 * 1000).toFixed(1)}ms)`);
    console.log(`   - Byte range: ${minValue} - ${maxValue}`);
    console.log(`   - Zero bytes: ${zeroCount}/${Math.min(100, chunkSize)} (first 100 bytes)`);
    
    // Check for PCM16 patterns (alternating high/low bytes)
    if (chunkSize >= 4) {
      const firstSample = audioChunk.readInt16LE(0);
      const secondSample = audioChunk.readInt16LE(2);
      console.log(`   - First 2 samples as Int16LE: ${firstSample}, ${secondSample}`);
      console.log(`   - First 2 samples as Uint8: ${audioChunk[0]}, ${audioChunk[1]}, ${audioChunk[2]}, ${audioChunk[3]}`);
      
      // PCM16 samples are typically in range -32768 to 32767
      // g711_ulaw bytes are 0-255
      if (Math.abs(firstSample) > 255 || Math.abs(secondSample) > 255) {
        console.warn(`   ⚠️ DETECTED: Values suggest PCM16 format (samples: ${firstSample}, ${secondSample})`);
      } else {
        console.log(`   ℹ️ Values suggest g711_ulaw format (bytes: ${audioChunk[0]}, ${audioChunk[1]})`);
      }
    }
    
    // Check chunk size patterns
    // g711_ulaw at 8kHz: common chunk sizes are multiples of 160 (20ms frames)
    // PCM16 at 8kHz: common chunk sizes are multiples of 320 (20ms frames = 160 samples * 2 bytes)
    if (chunkSize % 160 === 0) {
      console.log(`   ✓ Chunk size is multiple of 160 (g711_ulaw 20ms frame size)`);
    } else if (chunkSize % 320 === 0) {
      console.warn(`   ⚠️ Chunk size is multiple of 320 (PCM16 20ms frame size) - FORMAT MISMATCH!`);
    } else {
      console.log(`   ℹ️ Chunk size doesn't match standard frame sizes`);
    }
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
    
    // Log that we received an audio delta event (log first 30 chunks, then every 50th)
    const shouldLog = this.state.outboundAudioChunkCount <= 30 || (this.state.outboundAudioChunkCount % 50 === 0);
    if (shouldLog) {
      const audioPayloadSize = event.delta ? (typeof event.delta === 'string' ? event.delta.length : JSON.stringify(event.delta).length) : 0;
      console.log(`🔊 [${this.state.callSid}] Audio delta received - outbound chunk #${this.state.outboundAudioChunkCount}, total chunks: ${this.state.audioChunkCount + 1}, response: ${event.response_id || this.state.activeResponseId}, payload size: ${audioPayloadSize} bytes`);
    }
    
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
      if (shouldLog) {
        console.log(`🔇 [${this.state.callSid}] Blocking audio chunk #${this.state.outboundAudioChunkCount} - isInterrupted: ${this.state.isInterrupted}, isCancelled: ${isCancelledResponse}, withinGracePeriod: ${withinGracePeriod}`);
      }
      return false; // Don't send audio chunks
    }
    
    // Verify audio payload format
    if (!event.delta) {
      if (shouldLog) {
        console.warn(`⚠️ [${this.state.callSid}] Audio delta event missing payload for chunk #${this.state.outboundAudioChunkCount}`);
      }
      return false;
    }
    
    // Validate payload is a string (base64-encoded g711_ulaw)
    const audioPayload = event.delta;
    if (typeof audioPayload !== 'string') {
      if (shouldLog) {
        console.warn(`⚠️ [${this.state.callSid}] Audio payload is not a string - type: ${typeof audioPayload}`);
      }
      return false;
    }
    
    // Validate it looks like base64 (basic check)
    if (audioPayload.length === 0) {
      if (shouldLog) {
        console.warn(`⚠️ [${this.state.callSid}] Audio payload is empty`);
      }
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
      // Decode base64 - this is g711_ulaw from OpenAI (direct format, no conversion needed)
      const audioChunk = Buffer.from(audioPayload, 'base64');
      
      // DEBUG: Analyze first few chunks to detect format
      if (this.state.outboundAudioChunkCount <= 5) {
        this.analyzeAudioFormat(audioChunk, this.state.outboundAudioChunkCount, event);
      }
      
      // Direct format: OpenAI sends g711_ulaw, we can send it directly to Twilio
      // Buffer the g711_ulaw audio
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
      console.error(`❌ [${this.state.callSid}] Error processing audio chunk:`, err);
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
      
      // DEBUG: Log first frame details
      if (shouldLog && this.state.outboundAudioChunkCount <= 3) {
        console.log(`🔍 [${this.state.callSid}] Sending frame to Twilio:`);
        console.log(`   - Frame size: ${frameSize} bytes`);
        console.log(`   - First 10 bytes (hex): ${frame.slice(0, 10).toString('hex')}`);
        console.log(`   - First 10 bytes (decimal): ${Array.from(frame.slice(0, 10)).join(', ')}`);
        console.log(`   - Buffer remaining: ${this.state.outboundAudioBuffer.length} bytes`);
      }
      
      const mediaMessage = {
        event: 'media',
        streamSid: this.state.streamSid,
        media: { 
          payload: frame.toString('base64')
          // NO track field - Twilio automatically routes to outbound
        }
      };
      
      this.ws.send(JSON.stringify(mediaMessage));
      
      if (shouldLog) {
        console.log(`📤 [${this.state.callSid}] Sent audio frame to Twilio - frame: ${frameSize} bytes, buffer remaining: ${this.state.outboundAudioBuffer.length} bytes`);
      }
      
      return true;
    } catch (err) {
      this.state.incrementErrorCount();
      console.error(`❌ [${this.state.callSid}] Error sending audio frame:`, err);
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
        // Buffer empty or insufficient, stop pacer
        this.stopAudioPacer();
      }
    }, frameIntervalMs);
    
    if (shouldLog) {
      console.log(`⏱️ [${this.state.callSid}] Started audio pacer - ${frameIntervalMs}ms intervals, ${frameSize} bytes per frame`);
    }
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
    const error = event.response?.error;
    
    if (status === 'failed') {
      console.error(`❌ [${this.state.callSid}] Response failed:`, error);
    }
    
    // Only clear response tracking if this is the active response
    if (responseId === this.state.activeResponseId) {
      // Log audio summary before clearing state
      const outboundChunksForResponse = this.state.outboundAudioChunkCount;
      const totalInboundChunks = this.state.inboundAudioChunkCount || 0;
      
      console.log(`✅ [${this.state.callSid}] Response done - ID: ${responseId}, status: ${status}`);
      console.log(`   📊 Audio summary: ${outboundChunksForResponse} outbound chunks sent, ${totalInboundChunks} inbound chunks received`);
      
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

