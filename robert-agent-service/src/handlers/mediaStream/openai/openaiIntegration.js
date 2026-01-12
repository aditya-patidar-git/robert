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
   * Check if an error is retryable
   * @param {Error} err - Error object
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(err) {
    // Check for HTTP status codes in error message
    const errorMessage = err.message || err.toString() || '';
    const statusCode = err.statusCode || err.code || err.status;
    
    // Retryable errors: 503 (Service Unavailable), 429 (Rate Limit), 502 (Bad Gateway), 504 (Gateway Timeout)
    // Network errors: ECONNRESET, ETIMEDOUT, ECONNREFUSED
    const retryableStatusCodes = [503, 429, 502, 504];
    const retryableNetworkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'];
    
    // Check numeric status code
    if (statusCode && typeof statusCode === 'number' && retryableStatusCodes.includes(statusCode)) {
      return true;
    }
    
    // Check error message for status codes (e.g., "Unexpected server response: 503")
    const statusMatch = errorMessage.match(/(?:status|response|code)[\s:]*(\d{3})/i) || 
                       errorMessage.match(/\b(503|429|502|504)\b/);
    if (statusMatch) {
      const code = parseInt(statusMatch[1] || statusMatch[0], 10);
      if (retryableStatusCodes.includes(code)) {
        return true;
      }
    }
    
    // Check for network errors by code
    if (statusCode && typeof statusCode === 'string' && retryableNetworkErrors.includes(statusCode)) {
      return true;
    }
    
    // Check error message for network errors
    if (retryableNetworkErrors.some(code => errorMessage.includes(code))) {
      return true;
    }
    
    // Check for "Unexpected server response" with retryable status codes
    if (errorMessage.includes('Unexpected server response')) {
      const responseMatch = errorMessage.match(/response[:\s]+(\d{3})/i);
      if (responseMatch) {
        const code = parseInt(responseMatch[1], 10);
        if (retryableStatusCodes.includes(code)) {
          return true;
        }
      }
    }
    
    // Check for connection timeout errors (retryable)
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return true;
    }
    
    return false;
  }

  /**
   * Create OpenAI WebSocket connection with retry logic
   * @param {string} openaiUrl - WebSocket URL
   * @param {Object} headers - Connection headers
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @param {number} initialDelay - Initial delay in ms (default: 1000)
   * @returns {Promise<WebSocket>} Connected WebSocket
   */
  async createWebSocketWithRetry(openaiUrl, headers, maxRetries = 3, initialDelay = 1000) {
    let lastError = null;
    
    // Validate headers before attempting connection
    console.log(`🔍 [${this.state.callSid}] Pre-connection Header Validation:`);
    if (!headers) {
      console.error(`❌ [${this.state.callSid}] Headers object is null or undefined`);
      throw new Error('Headers object is missing');
    }
    
    if (!headers['Authorization']) {
      console.error(`❌ [${this.state.callSid}] Authorization header is missing from headers object`);
      throw new Error('Authorization header is missing');
    }
    
    const authHeaderValue = headers['Authorization'];
    if (!authHeaderValue.startsWith('Bearer ')) {
      console.error(`❌ [${this.state.callSid}] Authorization header does not start with 'Bearer '`);
      console.error(`   - Header value: ${authHeaderValue.substring(0, 20)}...`);
      throw new Error('Invalid Authorization header format');
    }
    
    const extractedKey = authHeaderValue.replace('Bearer ', '').trim();
    if (!extractedKey || extractedKey.length < 20) {
      console.error(`❌ [${this.state.callSid}] Extracted API key from header is invalid (length: ${extractedKey?.length || 0})`);
      throw new Error('API key in header is empty or too short');
    }
    
    console.log(`   - Authorization header present: ✓`);
    console.log(`   - Authorization header format: ✓`);
    console.log(`   - Extracted key length: ${extractedKey.length}`);
    console.log(`   - OpenAI-Beta header: ${headers['OpenAI-Beta'] || 'MISSING'}`);
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`🔄 [${this.state.callSid}] Retrying OpenAI connection (attempt ${attempt + 1}/${maxRetries + 1}) in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.log(`🔌 [${this.state.callSid}] Connection attempt ${attempt + 1}/${maxRetries + 1}:`);
        console.log(`   - URL: ${openaiUrl}`);
        console.log(`   - Headers keys: ${Object.keys(headers).join(', ')}`);
        console.log(`   - Creating WebSocket instance...`);
        
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(openaiUrl, {
            headers: headers
          });
          
          // Set a connection timeout
          const connectionTimeout = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
              console.error(`⏱️ [${this.state.callSid}] Connection timeout after 10s (readyState: ${ws.readyState})`);
              ws.removeAllListeners();
              ws.terminate();
              reject(new Error('Connection timeout'));
            }
          }, 10000); // 10 second timeout
          
          ws.on('open', () => {
            clearTimeout(connectionTimeout);
            console.log(`✅ [${this.state.callSid}] WebSocket 'open' event received - connection established`);
            resolve(ws);
          });
          
          ws.on('error', (err) => {
            clearTimeout(connectionTimeout);
            lastError = err;
            
            // Detailed error logging
            console.error(`❌ [${this.state.callSid}] WebSocket 'error' event (attempt ${attempt + 1}):`);
            console.error(`   - Error type: ${err.constructor?.name || typeof err}`);
            console.error(`   - Error message: ${err.message || err.toString()}`);
            console.error(`   - Error code: ${err.code || 'N/A'}`);
            console.error(`   - ReadyState: ${ws.readyState}`);
            
            // Check for specific error patterns
            const errorStr = err.message || err.toString() || '';
            if (errorStr.includes('401') || errorStr.includes('Unauthorized') || errorStr.includes('authentication')) {
              console.error(`   - 🔐 AUTHENTICATION ERROR DETECTED`);
              console.error(`   - This suggests the API key may be invalid, expired, or deleted`);
            }
            if (errorStr.includes('429') || errorStr.includes('rate limit') || errorStr.includes('quota')) {
              console.error(`   - ⚠️ RATE LIMIT ERROR DETECTED`);
              console.error(`   - This suggests the API key has exceeded rate limits or quota`);
            }
            if (errorStr.includes('403') || errorStr.includes('Forbidden')) {
              console.error(`   - 🚫 FORBIDDEN ERROR DETECTED`);
              console.error(`   - This suggests the API key may not have permission for this endpoint`);
            }
            
            if (this.isRetryableError(err) && attempt < maxRetries) {
              // Error is retryable and we have retries left
              console.log(`   - Error is retryable, will retry...`);
              reject(err); // Will be caught and retried
            } else {
              // Non-retryable error or out of retries
              console.error(`   - Error is non-retryable or max retries reached`);
              reject(err);
            }
          });
          
          ws.on('unexpected-response', (request, response) => {
            console.error(`❌ [${this.state.callSid}] WebSocket 'unexpected-response' event:`);
            console.error(`   - Status code: ${response.statusCode}`);
            console.error(`   - Status message: ${response.statusMessage}`);
            console.error(`   - Headers:`, response.headers);
            
            // Try to read response body
            let body = '';
            response.on('data', (chunk) => {
              body += chunk.toString();
            });
            response.on('end', () => {
              console.error(`   - Response body: ${body}`);
              
              if (response.statusCode === 401) {
                console.error(`   - 🔐 401 UNAUTHORIZED: API key authentication failed`);
                console.error(`   - Possible causes: Invalid key, expired key, deleted key, or key format issue`);
              } else if (response.statusCode === 429) {
                console.error(`   - ⚠️ 429 RATE LIMIT: API quota or rate limit exceeded`);
              } else if (response.statusCode === 403) {
                console.error(`   - 🚫 403 FORBIDDEN: API key lacks permission for this endpoint`);
              }
            });
          });
        });
      } catch (err) {
        lastError = err;
        
        if (this.isRetryableError(err) && attempt < maxRetries) {
          // Continue to next retry
          continue;
        } else {
          // Non-retryable error or out of retries
          throw err;
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Failed to establish OpenAI connection after retries');
  }

  /**
   * Setup OpenAI WebSocket connection and session
   */
  async setupOpenAI() {
    if (this.state.setupComplete || this.state.isClosed) return;
    this.state.markSetupComplete();
    
    try {
      console.log(`🚀 Setting up OpenAI connection for call: ${this.state.callSid}`);
      
      // Detailed API key validation and debugging
      const rawApiKey = process.env.OPENAI_API_KEY;
      console.log(`🔍 [${this.state.callSid}] API Key Check:`);
      console.log(`   - Exists: ${rawApiKey !== undefined && rawApiKey !== null}`);
      console.log(`   - Type: ${typeof rawApiKey}`);
      console.log(`   - Length: ${rawApiKey?.length || 0}`);
      console.log(`   - Is empty string: ${rawApiKey === ''}`);
      console.log(`   - Is whitespace only: ${rawApiKey?.trim() === ''}`);
      
      if (!rawApiKey) {
        console.error(`❌ [${this.state.callSid}] OPENAI_API_KEY is missing (undefined or null)`);
        return { error: 'missing_api_key', retryable: false };
      }
      
      const apiKey = rawApiKey.trim();
      if (apiKey === '') {
        console.error(`❌ [${this.state.callSid}] OPENAI_API_KEY is empty or whitespace only`);
        return { error: 'empty_api_key', retryable: false };
      }
      
      if (apiKey.length < 20) {
        console.error(`❌ [${this.state.callSid}] OPENAI_API_KEY appears invalid (too short: ${apiKey.length} chars)`);
        return { error: 'invalid_api_key_length', retryable: false };
      }
      
      // Mask API key for logging (show first 4 and last 4 chars)
      const maskedKey = apiKey.length > 8 
        ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` 
        : '***';
      console.log(`   - Masked key: ${maskedKey}`);
      console.log(`   - Starts with 'sk-': ${apiKey.startsWith('sk-')}`);
      console.log(`   - Valid format: ${apiKey.startsWith('sk-') && apiKey.length >= 20}`);
      
      // Get dynamic config for this phone number (with current language)
      const currentLanguage = conversations[this.state.callSid]?.language || 'en';
      const config = configManager.getConfigForNumber(this.state.phoneNumber, currentLanguage);
      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      
      // Detect flow type from conversation context (if available)
      let flowType = 'default';
      try {
        const flowDetectionService = (await import('../../../services/flowDetectionService.js')).default;
        const conversation = conversations[this.state.callSid] || {};
        const transcript = conversation.transcript || [];
        const recentText = transcript.slice(-5).map(t => t.text || t.content || '').join(' ');
        
        flowType = flowDetectionService.detectFlow(recentText, transcript, {
          callSid: this.state.callSid,
          phoneNumber: this.state.phoneNumber
        });
      } catch (error) {
        console.warn(`⚠️ [${this.state.callSid}] Flow detection failed, using default:`, error.message);
      }
      
      // Get effective parameters (flow-specific or global)
      const aiConfig = configManager.getAIConfig();
      const effectiveParams = configManager.getEffectiveParameters(flowType, aiConfig);
      
      // Override temperature with effective params if flow-specific override exists
      const effectiveTemperature = effectiveParams.temperature ?? config.temperature;
      
      console.log('📋 Using config:', {
        voice: config.voice.id,
        temperature: effectiveTemperature,
        confidence: config.confidenceThreshold,
        flowType: flowType
      });
      
      // Initialize conversation state with recording consent tracking
      const sessionManagementService = (await import('../../../services/sessionManagementService.js')).default;
      if (!conversations[this.state.callSid]) {
        sessionManagementService.initializeSession(this.state.callSid, {
          language: 'en-GB',
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
4. If the caller's response is unclear, ambiguous, or you detect background noise/barge-in that prevents you from understanding their answer, IMMEDIATELY repeat the question: "${consentQuestion}" - DO NOT proceed until you receive a clear yes or no answer
5. Only after they respond clearly, continue with: "Hello, you're through to Universal Motorcycle Training. This is Robert. What language would you like to use today?"
6. If the language preference is unclear or you detect noise/barge-in, repeat: "What language would you like to use today?" until you get a clear answer

CRITICAL: 
- You MUST ask the consent question before proceeding with any other conversation
- If you cannot clearly understand the caller's response (due to noise, barge-in, or unclear speech), you MUST repeat the question
- Do not assume or guess the answer - always wait for a clear response
- The same applies to the language preference question - repeat if unclear

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
      console.log(`📋 [${this.state.callSid}] WebSocket URL: ${openaiUrl}`);
      
      // Create WebSocket connection with retry logic
      const authHeader = `Bearer ${apiKey}`;
      const headers = {
        'Authorization': authHeader,
        'OpenAI-Beta': 'realtime=v1'
      };
      
      // Debug header creation
      console.log(`🔍 [${this.state.callSid}] Header Validation:`);
      console.log(`   - Authorization header exists: ${!!headers['Authorization']}`);
      console.log(`   - Authorization header length: ${headers['Authorization']?.length || 0}`);
      console.log(`   - Authorization starts with 'Bearer ': ${headers['Authorization']?.startsWith('Bearer ') || false}`);
      console.log(`   - OpenAI-Beta header: ${headers['OpenAI-Beta']}`);
      console.log(`   - Masked auth header: Bearer ${maskedKey}`);
      
      // Verify header format
      if (!headers['Authorization'] || !headers['Authorization'].startsWith('Bearer ')) {
        console.error(`❌ [${this.state.callSid}] Invalid Authorization header format`);
        return { error: 'invalid_header_format', retryable: false };
      }
      
      const headerApiKey = headers['Authorization'].replace('Bearer ', '').trim();
      if (headerApiKey !== apiKey) {
        console.error(`❌ [${this.state.callSid}] API key mismatch between env var and header`);
        return { error: 'api_key_mismatch', retryable: false };
      }
      
      let openaiWs;
      try {
        console.log(`🔌 [${this.state.callSid}] Attempting WebSocket connection with headers...`);
        openaiWs = await this.createWebSocketWithRetry(openaiUrl, headers, 3, 1000);
        console.log(`✅ [${this.state.callSid}] OpenAI WebSocket connected successfully`);
      } catch (err) {
        const isRetryable = this.isRetryableError(err);
        const errorType = isRetryable ? 'retryable_error' : 'non_retryable_error';
        
        if (isRetryable) {
          console.error(`❌ [${this.state.callSid}] OpenAI connection failed after retries (retryable error):`, err.message);
          return { error: 'connection_failed_retryable', details: err.message, retryable: true };
        } else {
          console.error(`❌ [${this.state.callSid}] OpenAI connection failed (non-retryable error):`, err.message);
          return { error: 'connection_failed', details: err.message, retryable: false };
        }
      }
      
      this.state.setOpenAIReady(openaiWs);
      realtimeClients[this.state.callSid] = { twilioWs: this.ws, openaiWs, streamSid: this.state.streamSid };
      
      // Ensure transcript and language are set
      if (!conversations[this.state.callSid].transcript) {
        conversations[this.state.callSid].transcript = [];
      }
      if (!conversations[this.state.callSid].language) {
        conversations[this.state.callSid].language = 'en-GB';
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
      
      // CRITICAL FIX: If WebSocket is already open, send session.update immediately
      // (The open event may have already fired before handlers were set up)
      if (openaiWs.readyState === WebSocket.OPEN) {
        console.log(`✅ [${this.state.callSid}] WebSocket already open, sending session.update immediately`);
        
        try {
          // Get tool definitions
          const tools = toolExecutor.getToolDefinitions();
          
          // Clear any existing conversation state and audio buffer
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
              temperature: Math.max(0.6, effectiveTemperature), // Use flow-specific temperature if available
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw',  // Direct format - no conversion needed
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
          console.log(`🔍 [${this.state.callSid}] Session config details:`);
          console.log(`   - input_audio_format: g711_ulaw`);
          console.log(`   - output_audio_format: g711_ulaw (direct format - no conversion needed)`);
          console.log(`   - voice: ${config.voice.id}`);
          console.log(`   - temperature: ${Math.max(0.6, effectiveTemperature)} (flow: ${flowType})`);
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
      }
      
      return { success: true, openaiWs };
    } catch (err) {
      const isRetryable = this.isRetryableError(err);
      this.state.incrementErrorCount();
      console.error(`❌ [${this.state.callSid}] Failed to setup OpenAI:`, err.message);
      
      if (this.state.hasMaxErrors()) {
        return { error: 'setup_error', details: err.message, retryable: isRetryable };
      } else {
        return { error: 'setup_error', details: err.message, retryable: isRetryable };
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
    if (!conv.language) conv.language = 'en-GB';
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
      const isRetryable = this.isRetryableError(err);
      const errorType = isRetryable ? 'retryable' : 'non-retryable';
      
      console.error(`❌ [${this.state.callSid}] OpenAI WebSocket ERROR (${errorType}):`, err.message || err);
      
      // Only increment error count for non-retryable errors or if we've already retried
      if (!isRetryable) {
        this.state.incrementErrorCount();
      }
      
      if (this.state.hasMaxErrors()) {
        if (this.onEvent) {
          this.onEvent({ 
            type: 'error', 
            error: 'openai_error',
            retryable: isRetryable,
            details: err.message || err.toString()
          });
        }
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
            output_audio_format: 'g711_ulaw',  // Direct format - no conversion needed
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
        console.log(`🔍 [${this.state.callSid}] Session config details:`);
        console.log(`   - input_audio_format: g711_ulaw`);
        console.log(`   - output_audio_format: g711_ulaw (direct format - no conversion needed)`);
        console.log(`   - voice: ${config.voice.id}`);
        console.log(`   - temperature: ${Math.max(0.6, config.temperature)}`);
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
        
        // Minimal logging - only log important events
        if (event.type === 'session.updated') {
          console.log(`✅ [${this.state.callSid}] Session updated - audio format: ${event.session?.output_audio_format || 'N/A'}, voice: ${event.session?.voice || 'N/A'}`);
        }
        
        // Handle error events
        if (event.type === 'error') {
          const errorCode = event.error?.code;
          const errorMessage = event.error?.message || '';
          const errorType = event.error?.type || '';
          const errorParam = event.error?.param || null;
          const eventId = event.error?.event_id || null;
          
          // Detailed error logging
          console.error(`❌ [${this.state.callSid}] OpenAI Error Event Received:`);
          console.error(`   - Type: ${errorType}`);
          console.error(`   - Code: ${errorCode || 'N/A'}`);
          console.error(`   - Message: ${errorMessage}`);
          console.error(`   - Param: ${errorParam || 'N/A'}`);
          console.error(`   - Event ID: ${eventId || 'N/A'}`);
          console.error(`   - Full error object:`, JSON.stringify(event.error, null, 2));
          
          // Detect specific error types
          if (errorMessage.includes('Missing bearer') || 
              errorMessage.includes('authentication') || 
              errorMessage.includes('Unauthorized') ||
              errorCode === 'invalid_api_key' ||
              errorCode === 'authentication_error' ||
              errorType === 'invalid_request_error' && errorMessage.includes('authentication')) {
            console.error(`   - 🔐 AUTHENTICATION ERROR DETECTED`);
            console.error(`   - Possible causes:`);
            console.error(`     1. API key is missing or empty`);
            console.error(`     2. API key has been deleted or revoked`);
            console.error(`     3. API key format is invalid`);
            console.error(`     4. Authorization header not being sent correctly`);
            console.error(`   - Current API key status: ${process.env.OPENAI_API_KEY ? 'EXISTS' : 'MISSING'}`);
            if (process.env.OPENAI_API_KEY) {
              const key = process.env.OPENAI_API_KEY.trim();
              console.error(`   - API key length: ${key.length}`);
              console.error(`   - API key starts with 'sk-': ${key.startsWith('sk-')}`);
            }
          }
          
          if (errorMessage.includes('rate limit') || 
              errorMessage.includes('quota') || 
              errorMessage.includes('429') ||
              errorCode === 'rate_limit_error' ||
              errorCode === 'insufficient_quota') {
            console.error(`   - ⚠️ RATE LIMIT / QUOTA ERROR DETECTED`);
            console.error(`   - Possible causes:`);
            console.error(`     1. API key has exceeded rate limits`);
            console.error(`     2. API key has exceeded monthly quota`);
            console.error(`     3. Too many requests in short time period`);
          }
          
          if (errorMessage.includes('Forbidden') || 
              errorCode === 'permission_denied' ||
              errorCode === 'access_denied') {
            console.error(`   - 🚫 PERMISSION ERROR DETECTED`);
            console.error(`   - Possible causes:`);
            console.error(`     1. API key lacks permission for Realtime API`);
            console.error(`     2. API key is for a different organization`);
          }
          
          const nonCriticalErrors = [
            'response_cancel_not_active',
            'missing_required_parameter'
          ];
          
          if (nonCriticalErrors.some(code => errorCode === code || errorMessage.includes(code))) {
            console.warn(`⚠️ [${this.state.callSid}] Non-critical OpenAI error (ignoring):`, event.error);
            return;
          }
          
          this.state.incrementErrorCount();
          console.error(`❌ [${this.state.callSid}] OpenAI error logged (error count: ${this.state.errorCount})`);
          
          // Track in diagnostic service (non-intrusive, optional)
          const audioDiagnosticService = (await import('../../../services/audioDiagnosticService.js')).default;
          audioDiagnosticService.trackOpenAIError(this.state.callSid, event);
          
          if (this.state.hasMaxErrors()) {
            console.error(`❌ [${this.state.callSid}] Max errors reached, triggering error event`);
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

