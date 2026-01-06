import { BargeInHandler, ConsentHandler, ResponseHandler, TranscriptionHandler, ToolCallHandler } from './events/index.js';
import { MemoryManager, LanguageDetector } from './utils/index.js';
import { conversations } from '../../shared/state.js';

/**
 * Tool Coordinator
 * Coordinates event routing to appropriate handlers
 */
export class ToolCoordinator {
  constructor(stateManager, openaiWs, ws) {
    this.state = stateManager;
    this.openaiWs = openaiWs;
    this.ws = ws;
    
    // Initialize handlers
    const memoryManager = new MemoryManager(stateManager);
    const languageDetector = new LanguageDetector(stateManager);
    const consentHandler = new ConsentHandler(stateManager, memoryManager);
    
    this.bargeInHandler = new BargeInHandler(stateManager, openaiWs);
    this.consentHandler = consentHandler;
    this.responseHandler = new ResponseHandler(stateManager, ws);
    this.transcriptionHandler = new TranscriptionHandler(stateManager, languageDetector, consentHandler, openaiWs);
    this.toolCallHandler = new ToolCallHandler(stateManager, openaiWs);
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
  }

  /**
   * Route OpenAI events to appropriate handlers
   */
  async routeEvent(event) {
    if (!event || !event.type) {
      return;
    }
    
    try {
      // Route based on event type
      switch (event.type) {
        case 'session.updated':
          console.log(`📋 [${this.state.callSid}] Session updated event received`);
          console.log(`   - Session ID: ${event.session?.id}`);
          console.log(`   - Model: ${event.session?.model}`);
          console.log(`   - Input audio format: ${event.session?.input_audio_format}`);
          console.log(`   - Output audio format: ${event.session?.output_audio_format}`);
          console.log(`   - Voice: ${event.session?.voice}`);
          console.log(`   - Temperature: ${event.session?.temperature}`);
          console.log(`   - Turn detection: ${event.session?.turn_detection?.type}`);
          if (event.session?.turn_detection) {
            console.log(`   - VAD threshold: ${event.session.turn_detection.threshold}`);
            console.log(`   - Silence duration: ${event.session.turn_detection.silence_duration_ms}ms`);
            console.log(`   - Prefix padding: ${event.session.turn_detection.prefix_padding_ms}ms`);
          }
          await this.handleSessionUpdated(event);
          break;
          
        case 'response.created':
          this.responseHandler.handleResponseCreated(event);
          break;
          
        case 'conversation.item.created':
          if (event.item?.role === 'assistant') {
            this.responseHandler.handleItemCreated(event);
          }
          break;
          
        case 'response.audio.delta':
        case 'response.output_audio.delta':
          // Log first 30 audio delta events to verify they're being received
          // Use outboundAudioChunkCount if available, otherwise fall back to audioChunkCount
          const outboundCount = this.state.outboundAudioChunkCount || 0;
          const shouldLogAudioDelta = outboundCount < 30 || !this.state.audioDeltaLogged;
          if (shouldLogAudioDelta) {
            const hasPayload = !!event.delta;
            const payloadSize = hasPayload ? (typeof event.delta === 'string' ? event.delta.length : JSON.stringify(event.delta).length) : 0;
            console.log(`🎵 [${this.state.callSid}] Received audio delta event - type: ${event.type}, outbound chunk: ${outboundCount + 1}, hasPayload: ${hasPayload}, payloadSize: ${payloadSize} bytes`);
            if (outboundCount >= 29) {
              this.state.audioDeltaLogged = true; // Stop logging after first 30
            }
          }
          this.responseHandler.handleAudioDelta(event);
          break;
          
        case 'response.done':
          this.responseHandler.handleResponseDone(event);
          break;
          
        case 'input_audio_buffer.speech_started':
          await this.bargeInHandler.handleSpeechStarted(event);
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          await this.transcriptionHandler.handleTranscriptionCompleted(event);
          // Check if agent is waiting and should respond immediately
          if (this.state.waitingForUser && !this.state.isResponding && this.state.activeResponseId === null && this.state.hasInitialGreetingCompleted) {
            // Create response immediately when user speaks and agent is waiting
            try {
              this.state.explicitResponseRequested = true;
              this.openaiWs.send(JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ['audio', 'text']
                }
              }));
              console.log(`🎯 [${this.state.callSid}] Created response immediately after user transcription`);
            } catch (err) {
              console.error(`❌ [${this.state.callSid}] Error creating response after transcription:`, err);
            }
          }
          break;
          
        case 'input_audio_buffer.speech_stopped':
          const speechStoppedResult = await this.transcriptionHandler.handleSpeechStopped(event);
          // Handle process_transcriptions return value
          if (speechStoppedResult && speechStoppedResult.type === 'process_transcriptions') {
            const transcriptions = speechStoppedResult.transcriptions || [];
            if (transcriptions.length > 0 && this.state.waitingForUser && !this.state.isResponding && this.state.activeResponseId === null && this.state.hasInitialGreetingCompleted) {
              // Create response immediately when transcriptions are ready and agent is waiting
              try {
                this.state.explicitResponseRequested = true;
                this.openaiWs.send(JSON.stringify({
                  type: 'response.create',
                  response: {
                    modalities: ['audio', 'text']
                  }
                }));
                console.log(`🎯 [${this.state.callSid}] Created response immediately after processing ${transcriptions.length} transcriptions`);
              } catch (err) {
                console.error(`❌ [${this.state.callSid}] Error creating response after processing transcriptions:`, err);
              }
            }
          }
          // Handle acknowledge_interruption return value
          if (speechStoppedResult && speechStoppedResult.type === 'acknowledge_interruption') {
            // Create response to acknowledge interruption
            if (this.state.waitingForUser && !this.state.isResponding && this.state.activeResponseId === null) {
              try {
                this.state.explicitResponseRequested = true;
                this.openaiWs.send(JSON.stringify({
                  type: 'response.create',
                  response: {
                    modalities: ['audio', 'text']
                  }
                }));
                console.log(`🎯 [${this.state.callSid}] Created response to acknowledge interruption`);
              } catch (err) {
                console.error(`❌ [${this.state.callSid}] Error creating response for interruption:`, err);
              }
            }
          }
          break;
          
        case 'response.output_item.done':
          if (event.item?.type === 'function_call') {
            await this.toolCallHandler.handleToolCall(event);
          }
          break;
          
        default:
          // Unhandled event type - log for debugging
          if (event.type && !event.type.startsWith('response.function_call_arguments')) {
            // Don't log function_call_arguments events (too verbose)
            console.log(`📋 [${this.state.callSid}] Unhandled event type: ${event.type}`);
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
        this.state.explicitResponseRequested = true;
        this.openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text']
          }
        }));
        this.state.hasInitialGreetingBeenSent = true;
        this.state.isResponding = true;
        console.log(`🎯 [${this.state.callSid}] Initial greeting sent immediately`);
        
        // Set timeout for consent response if needed
        if (this.state.recordingConsentState.requested && this.state.recordingConsentState.given === null) {
          console.log(`⏱️ [${this.state.callSid}] Starting consent timeout (${this.state.CONSENT_TIMEOUT_MS/1000}s) - waiting for caller response`);
          this.state.consentTimeout = setTimeout(() => {
            if (this.state.recordingConsentState.given === null && conversations[this.state.callSid].recordingConsent.given === null) {
              this.state.recordingConsentState.given = false;
              this.state.recordingConsentState.respondedAt = new Date();
              conversations[this.state.callSid].recordingConsent.given = false;
              conversations[this.state.callSid].recordingConsent.respondedAt = new Date();
              conversations[this.state.callSid].recordingConsent.optOutReason = "No response within timeout - defaulting to opt-out for GDPR compliance";
              console.log(`⏰ [${this.state.callSid}] Recording consent timeout expired - defaulting to opt-out (GDPR compliance)`);
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
