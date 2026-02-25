import { WebSocket } from "ws";
import configManager from '../../../agent/configManager.js';
import conversationQualityService from '../../../services/conversationQualityService.js';
import audioDiagnosticService from '../../../services/audioDiagnosticService.js';
import { MemoryManager } from '../utils/index.js';
import { conversations } from '../../../shared/state.js';
import testClientRegistry from '../../../services/testClientRegistry.js';
import { appendTranscriptEntry } from '../../../services/transcriptPersistenceService.js';
import { getConversationFlowState } from '../utils/conversationStateHelpers.js';
import progressIndicatorService from '../../../services/progressIndicatorService.js';

/**
 * Response Handler
 * Handles response creation, completion, and audio streaming
 */
export class ResponseHandler {
  constructor(stateManager, ws) {
    this.state = stateManager;
    this.ws = ws;
    this.onCreateConsentResponseNeeded = null;
    this.onResponseDone = null;
  }

  setOnCreateConsentResponseNeeded(fn) {
    this.onCreateConsentResponseNeeded = typeof fn === 'function' ? fn : null;
  }

  setOnResponseDone(fn) {
    this.onResponseDone = typeof fn === 'function' ? fn : null;
  }


  /**
   * Handle response.created event
   */
  handleResponseCreated(event) {
    // Clear lock timeout since response creation succeeded
    if (this.state.responseLockTimer) {
      clearTimeout(this.state.responseLockTimer);
      this.state.responseLockTimer = null;
    }

    this.state.activeResponseId = event.response?.id;
    this.state.currentResponseOutputTranscript = null;
    const currentTime = Date.now();
    this.state.responseStartTime = currentTime;
    this.state.bargeInTailUntil = 0;
    this.state.audioFramesSentCountAtResponseStart = this.state.audioFramesSentCount || 0;

    // Track response latency
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    if (conversationBehaviorConfig?.qualityMetrics?.trackLatency && this.state.lastProcessedTranscriptionTime > 0) {
      const latency = currentTime - this.state.lastProcessedTranscriptionTime;
      conversationQualityService.trackResponseLatency(this.state.callSid, latency);
    }

    console.log(`📝 [${this.state.callSid}] Response created - ID: ${this.state.activeResponseId}, modalities: ${JSON.stringify(event.response?.modalities || [])}, isResponding: ${this.state.isResponding}`);

    // Register holding response (ack/periodic update) so response.done does not set waitingForUser
    progressIndicatorService.notifyResponseCreated(this.state.callSid, event.response?.id);

    const responseModalities = event.response?.modalities || [];
    const hasAudioModality = responseModalities.includes('audio');
    if (!hasAudioModality) {
      console.warn(`⚠️ [${this.state.callSid}] Response created WITHOUT audio modality!`);
    }

    // Check if response has errors
    if (event.response?.error) {
      console.error(`❌ [${this.state.callSid}] Response created with error:`, event.response.error);
    }

    // Track in diagnostic service (non-intrusive, optional)
    audioDiagnosticService.trackResponseCreated(this.state.callSid, event);

    // CRITICAL: Check if this response was triggered by a low-quality segment (background noise)
    // OpenAI may auto-create responses even if we don't explicitly call response.create
    const responseItemId = event.response?.output_item?.id;
    let isLowQualitySegment = false;

    if (responseItemId && this.state.pendingAudioSegments.has(responseItemId)) {
      const segment = this.state.pendingAudioSegments.get(responseItemId);

      // If transcription was received and marked as background noise, cancel this response
      if (segment.transcriptionReceived && segment.isBackgroundNoise) {
        isLowQualitySegment = true;
        console.log(`🛑 [${this.state.callSid}] Cancelling response from low-quality/background noise segment (item: ${responseItemId}, quality: ${segment.transcriptionQuality})`);
      } else if (this.state.segmentTranscriptionMap.has(responseItemId)) {
        const transcription = this.state.segmentTranscriptionMap.get(responseItemId);
        if (transcription.quality < 0.7 || transcription.isHighQuality === false) {
          isLowQualitySegment = true;
          console.log(`🛑 [${this.state.callSid}] Cancelling response from low-quality transcription (item: ${responseItemId}, quality: ${transcription.quality})`);
        }
      }
    }

    if (!this.state.explicitResponseRequested) {
      const currentTime = Date.now();
      const timeSinceTranscription = this.state.lastTranscriptionReceivedTime > 0 ? currentTime - this.state.lastTranscriptionReceivedTime : Infinity;
      const timeSinceAgentFinished = this.state.agentFinishedSpeakingTime > 0 ? currentTime - this.state.agentFinishedSpeakingTime : Infinity;
      const isRecentTranscription = this.state.lastTranscriptionReceivedTime > 0 && timeSinceTranscription >= 0 && timeSinceTranscription < 3000;
      const isWithinUserSpeakingWindow = this.state.agentFinishedSpeakingTime > 0 && timeSinceAgentFinished >= 0 && timeSinceAgentFinished < this.state.userSpeakingWindowMs;
      const userSpokeBeforeResponse = this.state.userSpeechStartedTime > 0 && this.state.userSpeechStartedTime < this.state.responseStartTime;

      const flowState = getConversationFlowState(this.state.callSid, this.state);
      const consentRequired = flowState.consentRequested && !flowState.consentGiven && flowState.languageSelected;

      const isInterrupted = this.state.isInterrupted;
      const isRespondingToDifferentResponse = this.state.isResponding && this.state.activeResponseId !== event.response?.id;
      const shouldBlockWaiting = this.state.waitingForUser && !isRecentTranscription && !isWithinUserSpeakingWindow && !userSpokeBeforeResponse;
      const shouldBlock = isInterrupted || isRespondingToDifferentResponse || shouldBlockWaiting || isLowQualitySegment || consentRequired;

      if (shouldBlock) {
        if (consentRequired) {
          console.log(`🚫 [${this.state.callSid}] Blocking automatic response - consent question must be asked first (ID: ${this.state.activeResponseId})`);
        } else {
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
        }

        try {
          const sent = this.state.sendToOpenAI({
            type: 'response.cancel',
            response_id: this.state.activeResponseId
          }, { priority: 'high' });

          if (sent) {
            console.log(`   ✅ Sent response.cancel to OpenAI for response ${this.state.activeResponseId}`);
          } else {
            console.warn(`   ⚠️ Cannot cancel response - message queued or connection not ready`);
          }
          this.state.activeResponseId = null;
          this.state.isResponding = false;
          this.state.waitingForUser = true;

          if (consentRequired && this.onCreateConsentResponseNeeded) {
            Promise.resolve(this.onCreateConsentResponseNeeded()).catch(err => {
              console.error(`❌ [${this.state.callSid}] Error creating consent response after blocking auto-response:`, err?.message || err);
            });
          }
          return false;
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
   * CRITICAL: Checks interruption/cancellation FIRST to stop current response immediately
   */
  handleAudioDelta(event) {
    // CRITICAL: Check interruption and cancellation FIRST before any processing
    // This ensures cancelled audio deltas are completely ignored (no metrics, no buffering)
    const currentResponseId = event.response_id || this.state.activeResponseId;
    const isCancelledResponse = currentResponseId && this.state.cancelledResponseIds.has(currentResponseId);
    const cancellationTimestamp = currentResponseId ? this.state.cancellationTime.get(currentResponseId) : null;
    const timeSinceCancellation = cancellationTimestamp ? Date.now() - cancellationTimestamp : Infinity;
    const withinGracePeriod = cancellationTimestamp && timeSinceCancellation < this.state.AUDIO_CANCELLATION_GRACE_PERIOD;

    // IMMEDIATELY block audio if interrupted or cancelled - don't process, track, or buffer anything
    if (this.state.isInterrupted || isCancelledResponse || (cancellationTimestamp && withinGracePeriod)) {
      // Silently ignore cancelled audio deltas - don't even log to reduce noise
      return false;
    }

    // Only process audio if not interrupted/cancelled
    // Track outbound audio separately
    this.state.outboundAudioChunkCount++;

    if (this.state.outboundAudioChunkCount === 1) {
      console.log(`🎵 [${this.state.callSid}] FIRST audio chunk received from OpenAI (response: ${currentResponseId || 'unknown'})`);
    }

    const isActiveResponse = this.state.activeResponseId !== null &&
      (!event.response_id || event.response_id === this.state.activeResponseId);
    if (isActiveResponse) {
      audioDiagnosticService.trackAudioDelta(this.state.callSid, event, { isActiveResponse: true });
    }

    this.state.isResponding = true;
    this.state.lastAudioChunkTime = Date.now();
    this.state.audioChunkCount++;  // Keep for backward compatibility
    const responseTime = Date.now();
    this.state.audioMetrics.responseTimestamps.push(responseTime);
    this.state.audioMetrics.lastResponseTime = responseTime;

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
   * CRITICAL: Checks for interruption before sending to enable immediate barge-in response
   */
  sendAudioFrame(frameSize, shouldLog = false) {
    // CRITICAL: Check for interruption first - prevents sending audio during barge-in
    if (this.state.isInterrupted) {
      return false; // Don't send audio frames when interrupted
    }

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

      // Track frames sent for diagnostic summary
      if (!this.state.audioFramesSentCount) {
        this.state.audioFramesSentCount = 0;
        this.state.firstAudioFrameTime = Date.now();
      }
      this.state.audioFramesSentCount++;

      // DIAGNOSTIC: Log first audio frame sent to Twilio
      if (this.state.audioFramesSentCount === 1) {
        const ms = this.state.pickupLatencyMs();
        console.log(`[PICKUP_LATENCY] [${this.state.callSid}] first_audio_to_twilio ${ms != null ? ms : '?'}ms (target <5000ms)`);
        console.log(`📤 [${this.state.callSid}] FIRST audio frame sent to Twilio (${frameSize} bytes, streamSid: ${this.state.streamSid})`);
      }

      // DIAGNOSTIC: Log summary every 250 frames (~5 seconds of audio) to reduce log volume
      if (this.state.audioFramesSentCount % 250 === 0) {
        const elapsed = Date.now() - this.state.firstAudioFrameTime;
        console.log(`📊 [${this.state.callSid}] Audio pipeline: ${this.state.audioFramesSentCount} frames sent to Twilio (~${Math.round(elapsed / 1000)}s)`);
      }

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

      // CRITICAL: Forward outbound audio to test clients for acceptance testing
      const callSidForForward = this.state.callSidForForwarding || this.state.callSid;
      if (callSidForForward) {
        testClientRegistry.forwardEvent(callSidForForward, mediaMessage);
      }

      return true;
    } catch (err) {
      console.error(`❌ [${this.state.callSid}] ERROR sending audio frame:`, err.message);
      this.state.incrementErrorCount();
      return false;
    }
  }

  /**
   * Start audio pacer to send frames at correct rate
   * FIXED: More resilient to temporary WebSocket unavailability
   * Prevents audio gaps by keeping pacer running during temporary connection issues
   * CRITICAL: Checks for interruption to enable immediate barge-in response
   */
  startAudioPacer(frameSize, frameIntervalMs, shouldLog = false) {
    if (this.state.outboundAudioPacer) {
      return; // Already running
    }

    this.state.outboundAudioPacer = setInterval(() => {
      // CRITICAL: Check for interruption first - stop immediately if barge-in detected
      if (this.state.isInterrupted) {
        this.stopAudioPacer();
        return;
      }

      // Only stop if call is closed or WebSocket is permanently closed
      if (this.state.isClosed || !this.state.streamSid) {
        this.stopAudioPacer();
        return;
      }

      // Only stop if WebSocket is permanently closed (CLOSED=3), not just temporarily unavailable
      if (this.ws.readyState === WebSocket.CLOSED) {
        this.stopAudioPacer();
        return;
      }

      // Try to send frame if WebSocket is ready and buffer has data
      if (this.ws.readyState === WebSocket.OPEN && this.state.outboundAudioBuffer && this.state.outboundAudioBuffer.length >= frameSize) {
        this.sendAudioFrame(frameSize, false);
      }

      // Only stop pacer if buffer is empty AND we're not responding (no more audio expected)
      // Keep running if we're still responding, as more audio might arrive
      if (!this.state.outboundAudioBuffer || this.state.outboundAudioBuffer.length < frameSize) {
        // Only stop if we're not responding (no more audio expected)
        if (!this.state.isResponding) {
          this.stopAudioPacer();
        }
        // Otherwise, keep pacer running - more audio might arrive soon
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
   * Immediately stop audio at Twilio level (for barge-in)
   * Stops audio pacer and clears buffer immediately to achieve <50ms response time
   * CRITICAL: Uses Twilio's native "clear" message for immediate barge-in support
   * This is more reliable than silence frames and provides instant buffer clearing
   * Thread-safe: Uses isolated state per callSid
   */
  immediatelyStopAudio() {
    const stopStartTime = Date.now();

    console.log(`🛑 [${this.state.callSid}] immediatelyStopAudio() called - starting barge-in process`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] TTS HALT START - timestamp: ${stopStartTime}`);

    // Stop audio pacer immediately
    const pacerStopTime = Date.now();
    this.stopAudioPacer();
    const pacerStopDuration = Date.now() - pacerStopTime;
    console.log(`🛑 [${this.state.callSid}] Audio pacer stopped`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] Audio pacer stopped in ${pacerStopDuration}ms`);

    // Clear audio buffer immediately to prevent any buffered audio from being sent
    const bufferClearStartTime = Date.now();
    let bufferSize = 0;
    if (this.state.outboundAudioBuffer) {
      bufferSize = this.state.outboundAudioBuffer.length;
      this.state.outboundAudioBuffer = null;
      this.state.lastOutboundSendTime = 0;

      if (bufferSize > 0) {
        console.log(`🛑 [${this.state.callSid}] Cleared ${bufferSize} bytes of buffered audio during barge-in`);
        console.log(`🔍 [TEST-2] [${this.state.callSid}] Buffer cleared: ${bufferSize} bytes in ${Date.now() - bufferClearStartTime}ms`);
      } else {
        console.log(`🛑 [${this.state.callSid}] Audio buffer was already empty`);
        console.log(`🔍 [TEST-2] [${this.state.callSid}] Buffer was empty - no clear needed`);
      }
    } else {
      console.log(`🛑 [${this.state.callSid}] No audio buffer to clear`);
      console.log(`🔍 [TEST-2] [${this.state.callSid}] No buffer exists - nothing to clear`);
    }

    // CRITICAL: Use Twilio's native "clear" message for immediate barge-in
    // This clears all buffered audio in Twilio's queue instantly, providing
    // more reliable interruption than silence frames
    // Format: {"event": "clear", "streamSid": "MZ..."}

    // ENHANCED LOGGING: Log all conditions before attempting to send clear message
    const wsExists = !!this.ws;
    const wsReadyState = this.ws ? this.ws.readyState : null;
    const wsIsOpen = wsReadyState === WebSocket.OPEN;
    const streamSidExists = !!this.state.streamSid;
    const callIsOpen = !this.state.isClosed;

    console.log(`🔍 [${this.state.callSid}] Clear message pre-flight check:`);
    console.log(`   - WebSocket exists: ${wsExists}`);
    console.log(`   - WebSocket readyState: ${wsReadyState} (1=OPEN, 2=CLOSING, 3=CLOSED)`);
    console.log(`   - WebSocket is OPEN: ${wsIsOpen}`);
    console.log(`   - streamSid exists: ${streamSidExists} (value: ${this.state.streamSid || 'null'})`);
    console.log(`   - Call is open: ${callIsOpen}`);
    console.log(`   - All conditions met: ${wsExists && wsIsOpen && streamSidExists && callIsOpen}`);

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state.streamSid && !this.state.isClosed) {
      try {
        const clearMessage = {
          event: 'clear',
          streamSid: this.state.streamSid
        };

        const messageJson = JSON.stringify(clearMessage);
        console.log(`📤 [${this.state.callSid}] Sending Twilio "clear" message: ${messageJson}`);

        this.ws.send(messageJson);
        console.log(`✅ [${this.state.callSid}] Successfully sent Twilio "clear" message to stop audio playback (streamSid: ${this.state.streamSid})`);
      } catch (err) {
        console.error(`❌ [${this.state.callSid}] Error sending Twilio clear message:`, err.message);
        console.error(`❌ [${this.state.callSid}] Error stack:`, err.stack);
        // Fallback: Log error but don't throw - barge-in should still work via state management
      }
    } else {
      // ENHANCED LOGGING: Detailed diagnostic information
      const wsState = this.ws ? this.ws.readyState : 'null';
      const streamSidStatus = this.state.streamSid ? `present (${this.state.streamSid})` : 'missing';
      const isClosedStatus = this.state.isClosed ? 'closed' : 'open';

      console.warn(`⚠️ [${this.state.callSid}] Cannot send Twilio clear message - conditions not met:`);
      console.warn(`   - WebSocket state: ${wsState} (expected: 1=OPEN)`);
      console.warn(`   - streamSid: ${streamSidStatus}`);
      console.warn(`   - Call closed: ${isClosedStatus}`);
      console.warn(`⚠️ [${this.state.callSid}] Barge-in will rely on state-based audio blocking only`);
    }

    const stopTime = Date.now() - stopStartTime;
    console.log(`⚡ [${this.state.callSid}] Audio stopped at Twilio level in ${stopTime}ms`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] TTS HALT COMPLETE - Total halt time: ${stopTime}ms (target: <200ms)`);
    console.log(`🔍 [TEST-2] [${this.state.callSid}] TTS halt breakdown:`);
    console.log(`   - Audio pacer stop: ${pacerStopDuration}ms`);
    console.log(`   - Buffer clear: ${bufferSize > 0 ? 'cleared ' + bufferSize + ' bytes' : 'no buffer'}`);
    console.log(`   - Twilio clear message: ${wsExists && wsIsOpen && streamSidExists && callIsOpen ? 'sent' : 'skipped'}`);

    // Track barge-in response time for metrics
    if (this.state.interruptionStartTime > 0) {
      const bargeInResponseTime = Date.now() - this.state.interruptionStartTime;
      conversationQualityService.trackBargeInResponseTime(this.state.callSid, bargeInResponseTime);
      console.log(`📊 [${this.state.callSid}] Barge-in response time: ${bargeInResponseTime}ms`);
      console.log(`🔍 [TEST-2] [${this.state.callSid}] METRIC - TTS halt time: ${stopTime}ms`);
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

    // Send first progress when model's response.done arrives, even if activeResponseId was already cleared
    // (e.g. in handleToolCall) so the caller hears progress during long tool runs.
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    if (conversationBehaviorConfig && progressIndicatorService.hasPendingFirstProgress(this.state.callSid)) {
      progressIndicatorService.trySendFirstProgressAfterResponseDone(this.state.callSid, this.ws, conversationBehaviorConfig, this.state);
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

      const hasAudioModality = event.response?.modalities?.includes('audio') || false;
      const outputItems = event.response?.output || [];
      let responseText = '';
      let fullResponseText = '';
      if (outputItems && outputItems.length > 0) {
        const textItems = outputItems.filter(item => item.type === 'message' && item.content);
        if (textItems.length > 0) {
          fullResponseText = textItems.map(item =>
            item.content.map(c => {
              if (c.type === 'text') return c.text || '';
              if (c.type === 'output_audio' && c.transcript) return c.transcript;
              if (c.type === 'audio' && c.transcript) return c.transcript;
              return '';
            }).join('')
          ).join(' ').trim();
          responseText = fullResponseText.toLowerCase();
        }
      }
      if (!fullResponseText && this.state.currentResponseOutputTranscript) {
        fullResponseText = this.state.currentResponseOutputTranscript.trim();
        responseText = fullResponseText.toLowerCase();
      }
      const streamedLen = (this.state.currentResponseOutputTranscript || '').length;
      console.log(`[AGENT-DEBUG] [${this.state.callSid}] response.done: outputItems=${outputItems?.length ?? 0}, fullResponseText.len=${fullResponseText.length}, currentResponseOutputTranscript.len=${streamedLen}`);
      if (outputItems?.length > 0) {
        const shape = outputItems.map(o => ({ type: o.type, contentTypes: (o.content || []).map(c => c.type) }));
        console.log(`[AGENT-DEBUG] [${this.state.callSid}] response.output shape: ${JSON.stringify(shape)}`);
      }
      this.state.currentResponseOutputTranscript = null;

      const refusalPatterns = [
        "i'm sorry, but i'm not able to continue",
        "i'm sorry, it seems like there was an error",
        "i can't continue",
        "i cannot continue",
        "i'm not able to",
        "i am not able to",
        "i cannot assist",
        "i can't assist"
      ];
      const isRefusalText = refusalPatterns.some(pattern => responseText.includes(pattern));
      const isRefusalResponse = audioTokens === 0 && hasAudioModality && textTokens > 0 && isRefusalText;

      if (fullResponseText && conversations[this.state.callSid]) {
        const conv = conversations[this.state.callSid];
        if (!conv.transcript) conv.transcript = [];
        const entry = { role: 'agent', text: fullResponseText, timestamp: new Date(), confidence: 1 };
        conv.transcript.push(entry);
        const maxLogLen = 500;
        const logText = fullResponseText.length > maxLogLen ? `${fullResponseText.substring(0, maxLogLen)}... (${fullResponseText.length} chars)` : fullResponseText;
        console.log(`[AGENT] [${this.state.callSid}] "${logText}"`);
        appendTranscriptEntry(this.state.callSid, entry, { consentGiven: conv.recordingConsent?.given === true }).catch(() => { });
      }

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

      const framesThisResponse = (this.state.audioFramesSentCount || 0) - (this.state.audioFramesSentCountAtResponseStart || 0);
      const responseDurationMs = Math.max(0, framesThisResponse) * 20;
      const bargeInTail = configManager.getConversationBehaviorConfig()?.bargeInTail;
      const drainBufferMs = bargeInTail?.drainBufferMs ?? 2000;
      const maxTailMs = bargeInTail?.maxTailMs ?? 8000;
      this.state.bargeInTailUntil = Date.now() + Math.min(responseDurationMs, maxTailMs) + drainBufferMs;

      // Clear response tracking
      this.state.activeResponseId = null;
      this.state.responseItemId = null;
      this.state.responseStartTime = null;
      this.state.isResponding = false;
      const activeToolExecution = progressIndicatorService.getExecutionInfo(this.state.callSid);
      const hasPendingRecoveryTool = !!this.state.pendingChainedToolCall;
      const isHoldingResponse = progressIndicatorService.isHoldingResponse(this.state.callSid, responseId);
      if (isHoldingResponse) {
        const actualDuration = this.state.responseStartTime != null ? Date.now() - this.state.responseStartTime : 0;
        progressIndicatorService.onAcknowledgmentCompleted(this.state.callSid, responseId, actualDuration);
        this.state.waitingForUser = false;
        progressIndicatorService.removeHoldingResponse(this.state.callSid, responseId);
        this.state.releaseResponseLock();
        progressIndicatorService.trySendNextProgressUpdate(this.state.callSid, this.ws, conversationBehaviorConfig, this.state);
        console.log(`📢 [${this.state.callSid}] Response done (holding message - ack/periodic update) - NOT setting waitingForUser`);
      } else {
        this.state.waitingForUser = !activeToolExecution && !hasPendingRecoveryTool;
        if (activeToolExecution) {
          console.log(`📢 [${this.state.callSid}] Response done during tool execution (periodic update) - NOT setting waitingForUser`);
        }
        if (hasPendingRecoveryTool) {
          console.log(`📢 [${this.state.callSid}] Response done with pending recovery/chained tool - NOT setting waitingForUser (will run correct tool)`);
        }
      }

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

        // Clear interruption timeout if set
        if (this.state.interruptionTimeout) {
          clearTimeout(this.state.interruptionTimeout);
          this.state.interruptionTimeout = null;
        }

        this.state.isInterrupted = false;
        this.state.interruptionStartTime = 0;
        this.state.pendingTranscriptions = [];
      }

      // Flush remaining audio buffer before response ends
      // Send only full 160-byte frames (g711_ulaw 20ms). Drop any remainder to avoid
      // sending variable-length or non-standard frames, which can cause distortion.
      if (this.state.outboundAudioBuffer && this.state.outboundAudioBuffer.length > 0) {
        const FRAME_SIZE = 160;
        while (this.state.outboundAudioBuffer.length >= FRAME_SIZE) {
          this.sendAudioFrame(FRAME_SIZE, false);
        }
        // Drop remainder (do not send); Twilio expects consistent 20ms frames.
        this.state.outboundAudioBuffer = Buffer.alloc(0);
      }

      // Stop pacer when response is done
      this.stopAudioPacer();

      // Run pending chained tool when response completes, or when a holding/ack response ends with status incomplete (so flow proceeds without waiting)
      const shouldRunChainedTool = status === 'completed' || (status === 'incomplete' && (isHoldingResponse || hasPendingRecoveryTool));
      if (shouldRunChainedTool && this.onResponseDone) {
        this.onResponseDone(event);
      }
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

