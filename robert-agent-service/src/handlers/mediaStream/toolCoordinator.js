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
    
    // Initialize ResponseHandler first (needed by BargeInHandler for immediate audio stopping)
    this.responseHandler = new ResponseHandler(stateManager, ws);
    
    // Initialize BargeInHandler with ResponseHandler reference for immediate Twilio-level audio stopping
    this.bargeInHandler = new BargeInHandler(stateManager, openaiWs, this.responseHandler);
    
    this.consentHandler = consentHandler;
    // Pass BargeInHandler reference to TranscriptionHandler so it can trigger barge-in when "stop" is detected
    this.transcriptionHandler = new TranscriptionHandler(stateManager, languageDetector, consentHandler, openaiWs, this.bargeInHandler);
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
    
    // 🚨 CRITICAL: Use atomic lock to prevent concurrent calls
    if (!this.state.tryAcquireResponseLock()) {
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
        
        // OPTIMIZATION: Cache privacy settings from setupOpenAI instead of querying again
        // Get consent notice/question if needed (use cached value if available)
        const conversation = conversations[this.state.callSid];
        let privacySettings = conversation?._cachedPrivacySettings || null;
        
        if (!privacySettings) {
          const privacyConfig = await import('../../../database/models/PrivacyConfig.js').then(m => m.default).catch(() => null);
          if (privacyConfig) {
            privacySettings = await privacyConfig.findOne({ isActive: true }).lean().catch(() => null);
            // Cache for reuse
            if (conversation && privacySettings) {
              conversation._cachedPrivacySettings = privacySettings;
            }
          }
        }
        
        const requireExplicitConsent = privacySettings?.recording?.requireExplicitConsent !== false;
        const consentNotice = privacySettings?.consentScript || "For training and quality, this call may be recorded and handled in line with our Privacy Policy.";
        const consentQuestion = "Do you consent to this call being recorded?";
        
        // Check language preference state
        const waitingForLanguage = conversations[this.state.callSid]?.waitingForLanguage || this.state.waitingForLanguage || false;
        const languageSelected = conversations[this.state.callSid]?.languagePreferenceState?.selected || this.state.languagePreferenceState?.selected || false;
        
        // Get contextual instructions for initial greeting OR language question
        responseInstructions = promptService.getContextualInstructions({
          isInitialGreeting: !waitingForLanguage,
          requireConsent: requireExplicitConsent && !waitingForLanguage,
          consentNotice,
          consentQuestion,
          waitingForLanguage: waitingForLanguage && !languageSelected,
          languageSelected
        });
        
        console.log(`📋 [${this.state.callSid}] Using contextual instructions for initial greeting (length: ${responseInstructions?.length || 0})`);
        
        // OPTIMIZATION: Reduced delay from 300ms to 100ms
        // Session should already be ready after session.update confirmation
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
        
        // Check language preference state
        const waitingForLanguage = conversations[this.state.callSid]?.waitingForLanguage || this.state.waitingForLanguage || false;
        const languageSelected = conversations[this.state.callSid]?.languagePreferenceState?.selected || this.state.languagePreferenceState?.selected || false;
        
        // Get contextual instructions for this response
        responseInstructions = promptService.getContextualInstructions({
          isInitialGreeting: false,
          workflowPhase,
          courseType,
          workflowType,
          currentStep,
          activeTool: activeToolName,
          waitingForLanguage: waitingForLanguage && !languageSelected,
          languageSelected
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
      
      // Lock already acquired by tryAcquireResponseLock()
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
      this.state.releaseResponseLock();
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
    
    // Periodic cleanup of old audio segments (prevent memory leaks)
    // Clean up every 10th event to avoid overhead
    if (Math.random() < 0.1) {
      this.state.cleanupOldSegments();
    }
    
    // Remove verbose logging - not needed for format testing
    
    try {
      // Route based on event type
      switch (event.type) {
        case 'session.updated':
          // Only log format info
          console.log(`📋 [${this.state.callSid}] Session updated - output_audio_format: ${event.session?.output_audio_format || 'N/A'}`);
          
          // Resolve pending session update promise if waiting
          if (this.state.pendingSessionUpdatePromise) {
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
          // Remove verbose logging
          break;
          
        case 'response.done':
          this.responseHandler.handleResponseDone(event);
          break;
          
        case 'input_audio_buffer.speech_started':
          await this.bargeInHandler.handleSpeechStarted(event);
          break;
          
        case 'conversation.item.input_audio_transcription.delta':
          // INDUSTRY STANDARD: Handle partial transcription deltas for faster "stop" detection
          // This enables barge-in detection in 150-300ms vs 300-800ms for completed events
          await this.transcriptionHandler.handleTranscriptionDelta(event);
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          // CRITICAL DIAGNOSTIC: Log ALL transcription events to diagnose why "stop" isn't detected
          console.log(`📝 [${this.state.callSid}] Transcription.completed event received:`);
          console.log(`   - item_id: ${event.item_id || 'N/A'}`);
          console.log(`   - transcript: "${event.transcript || 'N/A'}"`);
          console.log(`   - confidence: ${event.confidence || 'N/A'}`);
          console.log(`   - Barge-in already triggered: ${this.state.isInterrupted}`);
          console.log(`   - Audio playing: isResponding=${this.state.isResponding}, activeResponseId=${this.state.activeResponseId}`);
          
          const transcriptionResult = await this.transcriptionHandler.handleTranscriptionCompleted(event);
          const transcriptionItemId = event.item_id; // Link to committed segment
          
          // CRITICAL DIAGNOSTIC: Log transcription processing result
          console.log(`📝 [${this.state.callSid}] Transcription processing result:`);
          console.log(`   - processed: ${transcriptionResult?.processed}`);
          console.log(`   - shouldCreateResponse: ${transcriptionResult?.shouldCreateResponse}`);
          console.log(`   - isBackgroundNoise: ${transcriptionResult?.isBackgroundNoise}`);
          console.log(`   - qualityScore: ${transcriptionResult?.qualityScore}`);
          console.log(`   - reason: ${transcriptionResult?.reason || 'N/A'}`);
          
          // CRITICAL: Check if this is background noise - if so, DO NOT create response
          // This breaks the feedback loop where agent keeps responding to noise
          if (transcriptionResult?.isBackgroundNoise) {
            console.log(`🔇 [${this.state.callSid}] BLOCKED response - background noise detected (reason: ${transcriptionResult.reason}, quality: ${transcriptionResult.qualityScore})`);
            
            // CRITICAL: Ensure agent stays in listening mode when noise is detected
            // This prevents the feedback loop
            this.state.waitingForUser = true;
            
            // Clean up segment tracking
            if (transcriptionItemId && this.state.pendingAudioSegments.has(transcriptionItemId)) {
              // Keep segment data for potential future reference, but mark as noise
              const segment = this.state.pendingAudioSegments.get(transcriptionItemId);
              segment.isBackgroundNoise = true;
            }
            
            // DO NOT create response - break the loop
            break;
          }
          
          // Check if transcription was processed and if we should create a response
          const shouldCreateResponse = 
            transcriptionResult?.processed && 
            transcriptionResult?.shouldCreateResponse !== false &&
            transcriptionResult?.qualityScore >= 0.7 && // Additional quality gate
            !transcriptionResult?.isBackgroundNoise; // Explicitly check background noise flag
          
          // CRITICAL: Robust audio playing check (same logic as in TranscriptionHandler)
          const hasActiveResponse = this.state.activeResponseId !== null;
          const hasAudioPacer = this.state.outboundAudioPacer !== null;
          const hasBufferedAudio = this.state.outboundAudioBuffer !== null && this.state.outboundAudioBuffer.length > 0;
          const hasRecentAudio = this.state.lastAudioChunkTime > 0 && (Date.now() - this.state.lastAudioChunkTime) < 5000;
          const isAudioPlaying = this.state.isResponding || hasActiveResponse || hasAudioPacer || hasBufferedAudio || hasRecentAudio;
          
          // Create response only if:
          // 1. Transcription was processed successfully AND is high quality
          // 2. shouldCreateResponse flag is true (from TranscriptionHandler)
          // 3. Quality score meets threshold (>= 0.7)
          // 4. NOT background noise
          // 5. Agent is waiting for user
          // 6. Audio is NOT currently playing (CRITICAL: prevent responses during audio playback)
          // 7. No active response exists
          // 8. Initial greeting has completed
          if (shouldCreateResponse && this.state.waitingForUser && !isAudioPlaying && this.state.activeResponseId === null && this.state.hasInitialGreetingCompleted) {
            try {
              this.state.explicitResponseRequested = true;
              
              // CRITICAL FIX: Use createAudioResponse to disable tools and ensure natural language
              await this.createAudioResponse();
              console.log(`🎯 [${this.state.callSid}] Created response after high-quality transcription (quality: ${transcriptionResult.qualityScore?.toFixed(2)})`);
            } catch (err) {
              console.error(`❌ [${this.state.callSid}] Error creating response after transcription:`, err);
            }
          } else if (isAudioPlaying && shouldCreateResponse) {
            console.log(`🔇 [${this.state.callSid}] Skipping response creation - audio is currently playing`);
          } else if (!shouldCreateResponse && transcriptionResult?.processed === false) {
            console.log(`🔇 [${this.state.callSid}] Blocked response - transcription filtered (reason: ${transcriptionResult.reason}, quality: ${transcriptionResult.qualityScore?.toFixed(2)})`);
          } else if (transcriptionResult?.qualityScore < 0.7) {
            console.log(`🔇 [${this.state.callSid}] Blocked response - quality score too low (${transcriptionResult.qualityScore?.toFixed(2)} < 0.7)`);
          }
          break;
          
        case 'input_audio_buffer.speech_stopped':
          const speechStoppedResult = await this.transcriptionHandler.handleSpeechStopped(event);
          // Handle process_transcriptions return value
          if (speechStoppedResult && speechStoppedResult.type === 'process_transcriptions') {
            const transcriptions = speechStoppedResult.transcriptions || [];
            // CRITICAL: Don't create response if interrupted
            if (transcriptions.length > 0 && this.state.waitingForUser && !this.state.isResponding && this.state.activeResponseId === null && this.state.hasInitialGreetingCompleted && !this.state.isInterrupted && this.state.tryAcquireResponseLock()) {
              // Create response immediately when transcriptions are ready and agent is waiting
              try {
                // Double-check interruption state after acquiring lock
                if (this.state.isInterrupted) {
                  console.log(`🛑 [${this.state.callSid}] Skipping response creation - user interrupted after lock acquisition`);
                  this.state.releaseResponseLock();
                  return;
                }
                
                this.state.explicitResponseRequested = true;
                
                // CRITICAL FIX: Use createAudioResponse to disable tools and ensure natural language
                await this.createAudioResponse();
                console.log(`🎯 [${this.state.callSid}] Created response after processing ${transcriptions.length} transcriptions`);
              } catch (err) {
                console.error(`❌ [${this.state.callSid}] Error creating response after processing transcriptions:`, err);
                this.state.releaseResponseLock();
              }
            }
          }
          // Handle acknowledge_interruption return value
          if (speechStoppedResult && speechStoppedResult.type === 'acknowledge_interruption') {
            // CRITICAL: Don't create acknowledgment if interrupted (user said stop)
            if (this.state.waitingForUser && !this.state.isResponding && this.state.activeResponseId === null && !this.state.isInterrupted && this.state.tryAcquireResponseLock()) {
              try {
                // Double-check interruption state after acquiring lock
                if (this.state.isInterrupted) {
                  console.log(`🛑 [${this.state.callSid}] Skipping acknowledgment response - user interrupted after lock acquisition`);
                  this.state.releaseResponseLock();
                  return;
                }
                
                this.state.explicitResponseRequested = true;
                
                // CRITICAL FIX: Use createAudioResponse to disable tools and ensure natural language
                await this.createAudioResponse();
                console.log(`🎯 [${this.state.callSid}] Created response to acknowledge interruption`);
              } catch (err) {
                console.error(`❌ [${this.state.callSid}] Error creating response for interruption:`, err);
                this.state.releaseResponseLock();
              }
            }
          }
          break;
          
        case 'response.output_item.done':
          if (event.item?.type === 'function_call') {
            await this.toolCallHandler.handleToolCall(event);
          }
          break;
          
        case 'input_audio_buffer.committed':
          // CRITICAL: Track committed audio segments to prevent automatic responses from background noise
          // OpenAI may auto-create responses when buffer is committed, but we need to verify transcription quality first
          const itemId = event.item_id;
          const committedAt = Date.now();
          
          if (itemId) {
            // Track this segment - transcription will arrive later via transcription.completed event
            this.state.pendingAudioSegments.set(itemId, {
              timestamp: committedAt,
              committedAt,
              transcriptionReceived: false,
              transcriptionQuality: null,
              isBackgroundNoise: null
            });
            
            console.log(`📦 [${this.state.callSid}] Audio buffer committed (item: ${itemId}) - waiting for transcription to verify quality`);
            
            // CRITICAL: DO NOT create response here - wait for transcription.completed event
            // This prevents responses from being created for background noise
            // Response will only be created if transcription passes quality checks
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
              'rate_limits.updated',
              'response.audio_transcript.delta',
              'response.audio_transcript.done'
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
        // OPTIMIZATION: Reduced delay from 800ms to 200ms
        // OpenAI Realtime API typically needs minimal time after session.update
        // The 200ms delay ensures the session is ready while minimizing latency
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
