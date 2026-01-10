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
   * Inject text content into conversation to ensure audio generation
   * OpenAI only generates audio for natural language text, not tool calls
   */
  injectTextContent(text) {
    if (!this.openaiWs || this.openaiWs.readyState !== 1 || !text) {
      return;
    }
    
    try {
      this.openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: text
            }
          ]
        }
      }));
    } catch (err) {
      console.error(`❌ [${this.state.callSid}] Error injecting text content:`, err);
    }
  }

  /**
   * Create audio response by temporarily disabling tools
   * This ensures OpenAI generates natural language instead of tool calls
   * Note: For initial greeting, inject a dummy user message to provide conversation context
   */
  async createAudioResponse() {
    if (!this.openaiWs || this.openaiWs.readyState !== 1) {
      return;
    }
    
    try {
      // Step 1: Temporarily disable tools
      this.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          tool_choice: 'none'
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Step 2: For initial greeting, inject a dummy user message to provide conversation context
      // OpenAI Realtime API needs conversation context to generate audio responses
      if (!this.state.hasInitialGreetingBeenSent) {
        this.openaiWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Hello'
              }
            ]
          }
        }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Step 3: Create response - OpenAI will generate based on instructions/context
      const responseCreatePayload = {
        type: 'response.create',
        response: {
          modalities: ['audio', 'text']
        }
      };
      this.openaiWs.send(JSON.stringify(responseCreatePayload));
      
      // Step 4: Re-enable tools after delay
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
      
    } catch (err) {
      console.error(`❌ [${this.state.callSid}] Error creating audio response:`, err);
    }
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
    // Update tool call handler with openaiWs
    if (this.toolCallHandler) {
      this.toolCallHandler.setOpenAIWebSocket(openaiWs);
    }
    // Update barge-in handler with openaiWs
    if (this.bargeInHandler) {
      this.bargeInHandler.openaiWs = openaiWs;
    }
  }

  /**
   * Route OpenAI events to appropriate handlers
   */
  async routeEvent(event) {
    if (!event || !event.type) {
      return;
    }
    
    // Minimal logging - only log important events
    if (event.type === 'response.created') {
      console.log(`📝 [${this.state.callSid}] Response created - ID: ${event.response?.id}, modalities: ${JSON.stringify(event.response?.modalities || [])}`);
    }
    
    if (event.type === 'response.audio.delta' || event.type === 'response.output_audio.delta') {
      const outboundCount = this.state.outboundAudioChunkCount || 0;
      if (outboundCount < 5) {
        console.log(`🔊 [${this.state.callSid}] Audio delta #${outboundCount + 1} received`);
      }
    }
    
    if (event.type === 'response.done') {
      const audioTokens = event.response?.usage?.output_token_details?.audio_tokens || 0;
      const textTokens = event.response?.usage?.output_token_details?.text_tokens || 0;
      const totalTokens = event.response?.usage?.output_token_details?.total_tokens || 0;
      
      // Log the actual response items to see what was generated
      const outputItems = event.response?.output || [];
      let textContent = '';
      if (outputItems && outputItems.length > 0) {
        const textItems = outputItems.filter(item => item.type === 'message' && item.content);
        if (textItems.length > 0) {
          textContent = textItems.map(item => 
            item.content.map(c => c.type === 'text' ? c.text : '').join('')
          ).join(' ');
        }
      }
      
      console.log(`✅ [${this.state.callSid}] Response done - ID: ${event.response?.id}`);
      console.log(`   📊 Tokens: audio=${audioTokens}, text=${textTokens}, total=${totalTokens}`);
      if (textContent) {
        console.log(`   📝 Text content: "${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}"`);
      } else {
        console.log(`   ⚠️ No text content found in response`);
      }
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
          this.responseHandler.handleAudioDelta(event);
          break;
          
        case 'response.text.done':
          // Log the text content that was generated
          const textContent = event.text || '';
          console.log(`📝 [${this.state.callSid}] Response text done - length: ${textContent.length}, content: "${textContent.substring(0, 150)}${textContent.length > 150 ? '...' : ''}"`);
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
              
              // CRITICAL FIX: Use createAudioResponse to disable tools and ensure natural language
              await this.createAudioResponse();
              console.log(`🎯 [${this.state.callSid}] Created response after transcription`);
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
                
                // CRITICAL FIX: Use createAudioResponse to disable tools and ensure natural language
                await this.createAudioResponse();
                console.log(`🎯 [${this.state.callSid}] Created response after processing ${transcriptions.length} transcriptions`);
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
                
                // CRITICAL FIX: Use createAudioResponse to disable tools and ensure natural language
                await this.createAudioResponse();
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
            // Don't log verbose events that are handled elsewhere
            const verboseEvents = [
              'response.text.delta',
              'response.content_part.done',
              'response.output_item.added',
              'response.content_part.added',
              'rate_limits.updated'
            ];
            
            if (!verboseEvents.includes(event.type)) {
            console.log(`📋 [${this.state.callSid}] Unhandled event type: ${event.type}`);
              // Only log full event for critical errors
              if (event.type.includes('error')) {
                console.log(`   Full Unhandled Event: ${JSON.stringify(event, null, 2)}`);
              }
            }
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
        // CRITICAL FIX: Wait longer for session to be fully ready for audio generation
        // OpenAI Realtime API may need more time after session.update to enable audio output
        // Increased from 100ms to 500ms to ensure audio pipeline is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Double-check WebSocket is still open after delay
        if (this.state.isClosed || !this.openaiWs || this.openaiWs.readyState !== 1) {
          console.warn(`⚠️ [${this.state.callSid}] WebSocket closed during delay, skipping initial greeting`);
          return;
        }
        
        this.state.explicitResponseRequested = true;
        
        // CRITICAL FIX: Use createAudioResponse to disable tools and ensure natural language
        // Instructions already include the greeting text, so no need to pass it
        await this.createAudioResponse();
        
        this.state.hasInitialGreetingBeenSent = true;
        this.state.isResponding = true;
        console.log(`✅ [${this.state.callSid}] Initial greeting sent`);
        
        // Set timeout for consent response if needed
        if (this.state.recordingConsentState.requested && this.state.recordingConsentState.given === null) {
          console.log(`⏱️ [${this.state.callSid}] Starting consent timeout (${this.state.CONSENT_TIMEOUT_MS/1000}s) - waiting for caller response`);
          this.state.consentTimeout = setTimeout(() => {
            if (this.state.recordingConsentState.given === null && conversations[this.state.callSid].recordingConsent.given === null) {
              this.state.recordingConsentState.given = true;
              this.state.recordingConsentState.respondedAt = new Date();
              conversations[this.state.callSid].recordingConsent.given = true;
              conversations[this.state.callSid].recordingConsent.respondedAt = new Date();
              conversations[this.state.callSid].recordingConsent.optOutReason = null;
              console.log(`⏰ [${this.state.callSid}] Recording consent timeout expired - defaulting to opt-in`);
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
