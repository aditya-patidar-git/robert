import { WebSocket } from "ws";
import { conversations, realtimeClients } from "../../../shared/state.js";
import configManager from "../../../agent/configManager.js";
import toolExecutor from "../../../tools/index.js";

/**
 * OpenAI Integration
 * Handles OpenAI WebSocket connection setup, session configuration, and event routing
 */
export class OpenAIIntegration {
  constructor(stateManager, ws, audioProcessor, onEvent) {
    this.state = stateManager;
    this.ws = ws;
    this.audioProcessor = audioProcessor;
    this.onEvent = onEvent; // Callback for event handling
    this.openaiTimeout = null;
  }

  /**
   * Setup OpenAI WebSocket connection and session
   */
  async setupOpenAI() {
    if (this.state.setupComplete || this.state.isClosed) return;
    this.state.markSetupComplete();
    
    try {
      console.log(`🚀 Setting up OpenAI connection for call: ${this.state.callSid}`);
      
      if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY is missing');
        return { error: 'missing_api_key' };
      }
      
      // Get dynamic config for this phone number (with current language)
      const currentLanguage = conversations[this.state.callSid]?.language || 'en';
      const config = configManager.getConfigForNumber(this.state.phoneNumber, currentLanguage);
      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      console.log('📋 Using config:', {
        voice: config.voice.id,
        temperature: config.temperature,
        confidence: config.confidenceThreshold
      });
      
      // Initialize conversation state with recording consent tracking
      const sessionManagementService = (await import('../../../services/sessionManagementService.js')).default;
      if (!conversations[this.state.callSid]) {
        sessionManagementService.initializeSession(this.state.callSid, {
          language: 'en-US',
          realtimeWs: this.ws,
          from: this.state.phoneNumber,
          to: this.state.phoneNumber,
          callType: 'Twilio',
          recordingConsent: {
            requested: false,
            given: null,
            requestedAt: null,
            respondedAt: null
          },
          memoryConsent: {
            requested: false,
            given: null,
            requestedAt: null,
            respondedAt: null
          },
          kba: {
            verified: false,
            method: null,
            verifiedAt: null,
            otpVerified: false,
            otpVerifiedAt: null,
            email: null,
            postcode: null,
            bookingReference: null
          }
        });
      } else {
        // Ensure required properties exist
        await this.ensureConversationState();
      }
      
      // Add recording consent notice and question to instructions
      const privacyConfig = await import('../../../database/models/PrivacyConfig.js').then(m => m.default).catch(() => null);
      let privacySettings = null;
      if (privacyConfig) {
        privacySettings = await privacyConfig.findOne({ isActive: true }).lean().catch(() => null);
      }
      
      const requireExplicitConsent = privacySettings?.recording?.requireExplicitConsent !== false;
      const consentNotice = privacySettings?.consentScript || "For training and quality, this call may be recorded and handled in line with our Privacy Policy.";
      const consentQuestion = "Do you consent to this call being recorded?";
      
      // Modify instructions to include recording consent flow at the start
      let modifiedInstructions = config.instructions;
      if (requireExplicitConsent) {
        modifiedInstructions = `IMPORTANT: You must start every call with the following exact sequence:
1. First, say: "${consentNotice}"
2. Then immediately ask: "${consentQuestion}"
3. WAIT for the caller's response (yes, no, or silence) - DO NOT continue until they respond
4. Only after they respond, continue with: "Hello, you're through to Universal Motorcycle Training. This is Robert. What language would you like to use today?"

CRITICAL: You MUST ask the consent question before proceeding with any other conversation. Do not skip this step.

${config.instructions}`;
        
        // Mark consent as requested
        this.state.recordingConsentState.requested = true;
        this.state.recordingConsentState.requestedAt = new Date();
        conversations[this.state.callSid].recordingConsent.requested = true;
        conversations[this.state.callSid].recordingConsent.requestedAt = new Date();
        console.log(`📋 [${this.state.callSid}] Recording consent will be requested - instructions modified to include consent flow`);
      }
      
      // Use model from database configuration, fallback to default if not available
      const modelId = config.model?.id || 'gpt-4o-realtime-preview';
      const openaiUrl = `wss://api.openai.com/v1/realtime?model=${modelId}`;
      console.log(`📋 [${this.state.callSid}] Using model from config: ${modelId}`);
      
      const openaiWs = new WebSocket(openaiUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });
      
      this.state.setOpenAIReady(openaiWs);
      realtimeClients[this.state.callSid] = { twilioWs: this.ws, openaiWs, streamSid: this.state.streamSid };
      
      // Ensure transcript and language are set
      if (!conversations[this.state.callSid].transcript) {
        conversations[this.state.callSid].transcript = [];
      }
      if (!conversations[this.state.callSid].language) {
        conversations[this.state.callSid].language = 'en-US';
      }
      if (!conversations[this.state.callSid].realtimeWs) {
        conversations[this.state.callSid].realtimeWs = this.ws;
      }
      
      // Setup timeout
      this.openaiTimeout = setTimeout(() => {
        if (!this.state.openaiReady && !this.state.isClosed) {
          console.error(`❌ OpenAI connection timeout for call: ${this.state.callSid}`);
          return { error: 'openai_timeout' };
        }
      }, 30000);
      
      // Setup event handlers
      this.setupEventHandlers(openaiWs, config, modifiedInstructions);
      
      return { success: true, openaiWs };
    } catch (err) {
      this.state.incrementErrorCount();
      console.error('❌ Failed to setup OpenAI:', err);
      if (this.state.hasMaxErrors()) {
        return { error: 'setup_error' };
      } else {
        return { error: 'setup_error', details: err.message };
      }
    }
  }

  /**
   * Ensure conversation state has all required properties
   */
  async ensureConversationState() {
    const { conversations } = await import('../../../shared/state.js');
    const conv = conversations[this.state.callSid];
    
    if (!conv.recordingConsent) {
      conv.recordingConsent = {
        requested: false,
        given: null,
        requestedAt: null,
        respondedAt: null
      };
    }
    if (!conv.memoryConsent) {
      conv.memoryConsent = {
        requested: false,
        given: null,
        requestedAt: null,
        respondedAt: null
      };
    }
    if (!conv.kba) {
      conv.kba = {
        verified: false,
        method: null,
        verifiedAt: null,
        otpVerified: false,
        otpVerifiedAt: null,
        email: null,
        postcode: null,
        bookingReference: null
      };
    }
    if (!conv.transcript) conv.transcript = [];
    if (!conv.language) conv.language = 'en-US';
    if (!conv.realtimeWs) conv.realtimeWs = this.ws;
    if (!conv.from) conv.from = this.state.phoneNumber;
    if (!conv.to) conv.to = this.state.phoneNumber;
  }

  /**
   * Setup OpenAI WebSocket event handlers
   */
  setupEventHandlers(openaiWs, config, modifiedInstructions) {
    // Error handler
    openaiWs.on('error', (err) => {
      console.error(`❌ OpenAI WebSocket ERROR for call ${this.state.callSid}:`, err);
      this.state.incrementErrorCount();
      if (this.state.hasMaxErrors()) {
        if (this.onEvent) this.onEvent({ type: 'error', error: 'openai_error' });
      }
    });
    
    // Connection open handler
    openaiWs.on('open', () => {
      if (this.state.isClosed) return;
      if (this.openaiTimeout) {
        clearTimeout(this.openaiTimeout);
        this.openaiTimeout = null;
      }
      console.log(`✅ OpenAI connected for call: ${this.state.callSid}`);
      
      try {
        // Get tool definitions
        const tools = toolExecutor.getToolDefinitions();
        
        // CRITICAL: Clear any existing conversation state and audio buffer
        try {
          openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          console.log(`🧹 [${this.state.callSid}] Cleared input audio buffer at session start`);
        } catch (err) {
          console.warn(`⚠️ [${this.state.callSid}] Could not clear audio buffer at start:`, err.message);
        }
        
        // Get audio config for calibration check
        const audioConfig = configManager.getAudioConfig();
        
        // Use base threshold initially (will be updated after calibration if enabled)
        const initialThreshold = config.vadThreshold / 1000; // Convert ms to seconds
        
        // Apply dynamic config to OpenAI session
        openaiWs.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            instructions: modifiedInstructions || config.instructions,
            voice: config.voice.id,
            temperature: Math.max(0.6, config.temperature), // Minimum is 0.6 for Realtime API
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            turn_detection: {
              type: 'server_vad',
              threshold: initialThreshold,
              prefix_padding_ms: config.startPadding,
              silence_duration_ms: config.endPadding
            },
            tools: tools,
            tool_choice: 'auto'
          }
        }));
        console.log(`📤 Sent session.update with config and ${tools.length} tools for call: ${this.state.callSid}`);
        if (audioConfig?.energyThresholdAutoCalibrate !== false) {
          console.log(`📊 [${this.state.callSid}] VAD auto-calibration enabled - will calibrate after ${this.state.CALIBRATION_DURATION_MS}ms of audio`);
        }
      } catch (err) {
        this.state.incrementErrorCount();
        console.error('❌ Error sending session.update:', err);
        if (this.state.hasMaxErrors()) {
          if (this.onEvent) this.onEvent({ type: 'error', error: 'send_error' });
        }
      }
    });
    
    // Message handler - route events to onEvent callback
    openaiWs.on('message', async (data) => {
      if (this.state.isClosed) return;
      
      try {
        const event = JSON.parse(data.toString());
        
        // Handle error events
        if (event.type === 'error') {
          const errorCode = event.error?.code;
          const errorMessage = event.error?.message || '';
          
          const nonCriticalErrors = [
            'response_cancel_not_active',
            'missing_required_parameter'
          ];
          
          if (nonCriticalErrors.some(code => errorCode === code || errorMessage.includes(code))) {
            console.warn(`⚠️ [${this.state.callSid}] Non-critical OpenAI error (ignoring):`, event.error);
            return;
          }
          
          this.state.incrementErrorCount();
          console.error(`❌ OpenAI error for call ${this.state.callSid}:`, event.error);
          if (this.state.hasMaxErrors()) {
            if (this.onEvent) this.onEvent({ type: 'error', error: 'openai_error', details: event.error });
          }
          return;
        }
        
        // Route all other events to event handler
        if (this.onEvent) {
          await this.onEvent(event);
        }
      } catch (err) {
        this.state.incrementErrorCount();
        console.error('❌ Error processing OpenAI event:', err);
        if (this.state.hasMaxErrors()) {
          if (this.onEvent) this.onEvent({ type: 'error', error: 'parse_error' });
        }
      }
    });
    
    // Close handler
    openaiWs.on('close', () => {
      if (this.onEvent) this.onEvent({ type: 'close', reason: 'openai_close' });
    });
  }

  /**
   * Cleanup OpenAI connection
   */
  cleanup() {
    if (this.openaiTimeout) {
      clearTimeout(this.openaiTimeout);
      this.openaiTimeout = null;
    }
    
    if (this.state.openaiWs) {
      this.state.openaiWs.removeAllListeners();
      if (this.state.openaiWs.readyState === 1) {
        try {
          this.state.openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          this.state.openaiWs.send(JSON.stringify({ type: 'session.cancel' }));
        } catch (err) {
          console.warn(`⚠️ [${this.state.callSid}] Error clearing state during cleanup:`, err.message);
        }
        this.state.openaiWs.close(1000, 'Call ended');
      }
    }
  }
}

