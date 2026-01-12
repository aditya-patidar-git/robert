import { BargeInHandler, ConsentHandler, ResponseHandler, TranscriptionHandler, ToolCallHandler } from './events/index.js';
import { MemoryManager, LanguageDetector } from './utils/index.js';
import { conversations } from '../../shared/state.js';
import { getRecordingConsent, updateRecordingConsent, conversationExists } from '../../shared/conversationStateAccessor.js';
import promptService from '../../services/promptService.js';

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
   * Wait for session.updated event with timeout
   * @param {number} timeoutMs - Timeout in milliseconds (default: 5000ms)
   * @returns {Promise<void>}
   */
  async waitForSessionUpdate(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.state.pendingSessionUpdatePromise = null;
        reject(new Error(`Session update timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Store the resolver so routeEvent can call it
      this.state.pendingSessionUpdatePromise = () => {
        clearTimeout(timeout);
        this.state.pendingSessionUpdatePromise = null;
        resolve();
      };
    });
  }

  /**
   * Wait for conversation.item.created event with timeout
   * @param {number} timeoutMs - Timeout in milliseconds (default: 5000ms)
   * @returns {Promise<void>}
   */
  async waitForItemCreated(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.state.pendingItemCreatePromise = null;
        reject(new Error(`Item creation timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Store the resolver so routeEvent can call it
      this.state.pendingItemCreatePromise = () => {
        clearTimeout(timeout);
        this.state.pendingItemCreatePromise = null;
        resolve();
      };
    });
  }

  /**
   * Create audio response by temporarily disabling tools
   * This ensures OpenAI generates natural language instead of tool calls
   * 
   * IMPROVED FLOW:
   * - For initial greeting: Rely on instructions (no dummy user message), disable tools, then create response
   * - For subsequent responses: Disable tools, create response, then re-enable tools
   * 
   * CRITICAL: 
   * - Always disable tools before creating response (tools are set to 'auto' in session setup)
   * - Without disabling tools, OpenAI may call tools and generate JSON/URL output instead of speech
   * - For initial greeting, we rely on instructions rather than dummy conversation items to avoid confusion
   */
  async createAudioResponse() {
    if (!this.openaiWs || this.openaiWs.readyState !== 1) {
      console.error(`❌ [${this.state.callSid}] WebSocket not ready: ${this.openaiWs?.readyState}`);
      return;
    }
    
    // 🚨 CRITICAL: Prevent concurrent calls
    if (this.state.isResponding || this.state.activeResponseId !== null) {
      console.warn(`⚠️ [${this.state.callSid}] Already responding (responseId: ${this.state.activeResponseId}), skipping duplicate createAudioResponse call`);
      return;
    }
    
    try {
      const isInitialGreeting = !this.state.hasInitialGreetingBeenSent;
      
      // Step 1: Get contextual instructions based on conversation state
      // PHASE 1: Use promptService to get contextual instructions instead of full prompt
      let responseInstructions = null;
      
      if (isInitialGreeting) {
        console.log(`📤 [${this.state.callSid}] Preparing initial greeting with contextual instructions`);
        
        // Get consent notice/question if needed
        const privacyConfig = await import('../../../database/models/PrivacyConfig.js').then(m => m.default).catch(() => null);
        let privacySettings = null;
        if (privacyConfig) {
          privacySettings = await privacyConfig.findOne({ isActive: true }).lean().catch(() => null);
        }
        
        const requireExplicitConsent = privacySettings?.recording?.requireExplicitConsent !== false;
        const consentNotice = privacySettings?.consentScript || "For training and quality, this call may be recorded and handled in line with our Privacy Policy.";
        const consentQuestion = "Do you consent to this call being recorded?";
        
        // Get contextual instructions for initial greeting
        responseInstructions = promptService.getContextualInstructions({
          isInitialGreeting: true,
          requireConsent: requireExplicitConsent,
          consentNotice,
          consentQuestion
        });
        
        console.log(`📋 [${this.state.callSid}] Using contextual instructions for initial greeting (length: ${responseInstructions?.length || 0})`);
        
        // Small delay to ensure session is fully ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify WebSocket is still open
        if (!this.openaiWs || this.openaiWs.readyState !== 1) {
          console.error(`❌ [${this.state.callSid}] WebSocket closed during preparation`);
          this.state.isResponding = false;
          this.state.explicitResponseRequested = false;
          return;
        }
      } else {
        // PHASE 1: Get contextual instructions for subsequent responses
        // Determine workflow phase from state (pass callSid to access booking session)
        const workflowPhase = await promptService.determineWorkflowPhase(this.state, this.state.callSid);
        
        // Get active tool name if available
        const activeToolName = this.state.activeToolName || 
          (this.state.activeResponseId ? 'processing_response' : null);
        
        // Get booking session info if available
        let courseType = null;
        let workflowType = null;
        let currentStep = null;
        
        if (this.state.callSid && conversations[this.state.callSid]?.bookingSession) {
          const bookingSession = conversations[this.state.callSid].bookingSession;
          courseType = bookingSession.courseType;
          workflowType = bookingSession.workflowType;
          currentStep = bookingSession.currentStep;
        }
        
        // Get contextual instructions for this response
        responseInstructions = promptService.getContextualInstructions({
          isInitialGreeting: false,
          workflowPhase,
          courseType,
          workflowType,
          currentStep,
          activeTool: activeToolName
        });
        
        console.log(`📋 [${this.state.callSid}] Using contextual instructions for subsequent response (phase: ${workflowPhase}, length: ${responseInstructions?.length || 0})`);
      }
      
      // Step 2: ALWAYS disable tools before creating response
      // CRITICAL FIX: Tools are set to 'auto' in session setup, so we MUST disable them
      // to prevent tool calls during greeting (which causes JSON/URL output instead of speech)
      console.log(`📤 [${this.state.callSid}] Sending session.update to disable tools...`);
      this.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          tool_choice: 'none'
        }
      }));
      
      // Wait for session.updated event confirmation
      try {
        await this.waitForSessionUpdate(10000);
        console.log(`✅ [${this.state.callSid}] Session update confirmed - tools disabled`);
      } catch (err) {
        console.error(`❌ [${this.state.callSid}] Session update timeout:`, err.message);
        console.warn(`⚠️ [${this.state.callSid}] Continuing without session update confirmation`);
      }
      
      // Verify WebSocket is still open
      if (!this.openaiWs || this.openaiWs.readyState !== 1) {
        console.error(`❌ [${this.state.callSid}] WebSocket closed after session.update`);
        return;
      }
      
      // Step 3: Create response - PHASE 1: Include contextual instructions in response.create
      // Contextual instructions prevent model from falling back to full prompt (which causes code generation)
      const responseCreatePayload = {
        type: 'response.create',
        response: {
          modalities: ['audio', 'text']
        }
      };
      
      // PHASE 1: Include contextual instructions in response.create for both initial greeting and subsequent responses
      // This prevents the model from using the full prompt and generating code/JSON instead of speech
      if (responseInstructions) {
        responseCreatePayload.response.instructions = responseInstructions;
        if (isInitialGreeting) {
          console.log(`📋 [${this.state.callSid}] Including contextual instructions in response.create for initial greeting`);
        } else {
          console.log(`📋 [${this.state.callSid}] Including contextual instructions in response.create for subsequent response`);
        }
      }
      
      console.log(`📤 [${this.state.callSid}] Sending response.create, WebSocket state: ${this.openaiWs.readyState}`);
      
      // Set state BEFORE sending to prevent duplicate calls
      this.state.isResponding = true;
      this.state.explicitResponseRequested = true;
      
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
      // Reset state on error
      this.state.hasInitialGreetingBeenSent = false;
      this.state.isResponding = false;
      this.state.pendingSessionUpdatePromise = null;
      this.state.pendingItemCreatePromise = null;
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
          
          // Resolve pending session update promise if waiting
          if (this.state.pendingSessionUpdatePromise) {
            console.log(`✅ [${this.state.callSid}] Resolving pending session update promise`);
            this.state.pendingSessionUpdatePromise();
          }
          
          await this.handleSessionUpdated(event);
          break;
          
        case 'response.created':
          this.responseHandler.handleResponseCreated(event);
          break;
          
        case 'conversation.item.created':
          // Resolve pending item create promise if waiting (for any role, not just assistant)
          if (this.state.pendingItemCreatePromise) {
            console.log(`✅ [${this.state.callSid}] Resolving pending item create promise (role: ${event.item?.role})`);
            this.state.pendingItemCreatePromise();
          }
          
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
        // Increased delay to ensure audio pipeline is fully initialized
        // This helps prevent 0 audio token responses
        await new Promise(resolve => setTimeout(resolve, 800));
        
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
            // FIX: Safely check conversation state - it may have been cleaned up
            if (!conversationExists(this.state.callSid)) {
              console.warn(`⚠️ [${this.state.callSid}] Conversation cleaned up, skipping consent timeout handler`);
              return;
            }
            
            const consent = getRecordingConsent(this.state.callSid);
            if (this.state.recordingConsentState.given === null && consent && consent.given === null) {
              this.state.recordingConsentState.given = true;
              this.state.recordingConsentState.respondedAt = new Date();
              updateRecordingConsent(this.state.callSid, {
                given: true,
                respondedAt: new Date(),
                optOutReason: null
              });
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
