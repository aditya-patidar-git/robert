import { WebSocket } from "ws";
import { conversations, realtimeClients } from "../../../shared/state.js";
import configManager from "../../../agent/configManager.js";
import toolExecutor from "../../../tools/index.js";
import { WebSocketConnectionManager } from "../../../utils/websocketConnectionManager.js";
import consentInstructionBuilder from "../../../services/consentInstructionBuilder.js";
import { getEffectiveRecordingConsentSettings } from "../../../services/callRecordPersistenceService.js";
import { getFlowCopy } from "../../../services/flowCopyByLanguage.js";
import { resolveTranscriptionLanguage } from "../../../services/multilingualService.js";

/**
 * Map internal workflow phase to FlowParameterOverride flowType for flow-specific temperature/model.
 */
function mapPhaseToFlowType(phase) {
  if (!phase || typeof phase !== 'string') return 'default';
  const p = phase.toLowerCase();
  if (p.startsWith('booking')) return 'booking';
  if (p.includes('complaint')) return 'complaint';
  if (p.includes('transfer') || p === 'human_transfer') return 'human_transfer';
  if (p === 'general_inquiry' || p === 'information') return 'information';
  return 'default';
}

/**
 * OpenAI Integration
 * Handles OpenAI WebSocket connection setup, session configuration, and event routing
 * Note: Realtime API session does not support top_p, max_tokens, or speech_rate; only temperature (and model) are applied from config.
 */
export class OpenAIIntegration {
  constructor(stateManager, ws, audioProcessor, onEvent) {
    this.state = stateManager;
    this.ws = ws;
    this.audioProcessor = audioProcessor;
    this.onEvent = onEvent;
    this.openaiTimeout = null;
    this.connectionManager = null;
    this.currentWorkflowPhase = 'greeting';
    this._lastSessionLogKey = new Map();
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
          
          // OPTIMIZATION: Reduced timeout from 20s to 8s (removed VPN-specific increase)
          // 8 seconds is sufficient for normal connections and allows faster failure detection
          const connectionTimeout = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
              console.error(`⏱️ [${this.state.callSid}] Connection timeout after 8s (readyState: ${ws.readyState})`);
              ws.removeAllListeners();
              ws.terminate();
              reject(new Error('Connection timeout'));
            }
          }, 8000); // Reduced from 20s (VPN-specific) to 8s for faster startup
          
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
   * Send message through OpenAI WebSocket with connection manager support
   * @param {Object|string} message - Message to send
   * @param {Object} options - Send options (priority, queueOnFailure)
   * @returns {boolean} True if sent successfully
   */
  sendToOpenAI(message, options = {}) {
    const messageObj = typeof message === 'string' ? message : JSON.stringify(message);

    if (this.connectionManager) {
      return this.connectionManager.send(messageObj, options);
    }

    if (this.state.openaiWs && this.state.openaiWs.readyState === WebSocket.OPEN) {
      try {
        this.state.openaiWs.send(messageObj);
        return true;
      } catch (error) {
        console.error(`❌ [${this.state.callSid}] Error sending message:`, error.message);
        return false;
      }
    }

    return this.state.sendToOpenAI(messageObj, options);
  }

  /**
   * Setup OpenAI WebSocket connection and session.
   * Optional fallbackOverride: { modelId, voiceId } from AIConfig.model.fallbackChain for best-effort reconnection (Realtime API has no native failover).
   */
  async setupOpenAI(fallbackOverride = null) {
    if (this.state.setupComplete || this.state.isClosed) return;
    const latency = () => this.state.pickupLatencyMs();
    try {
      console.log(`[PICKUP_LATENCY] [${this.state.callSid}] setup_openai_enter ${latency() ?? 0}ms`);
      console.log(`🚀 Setting up OpenAI connection for call: ${this.state.callSid}`);
      
      // OPTIMIZATION: Reduced logging verbosity - only validate and log errors
      const rawApiKey = process.env.OPENAI_API_KEY;
      if (!rawApiKey || rawApiKey.trim() === '' || rawApiKey.trim().length < 20) {
        console.error(`❌ [${this.state.callSid}] OPENAI_API_KEY is invalid or missing`);
        return { error: 'missing_api_key', retryable: false };
      }
      
      const apiKey = rawApiKey.trim();
      const maskedKey = apiKey.length > 8 
        ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` 
        : '***';
      
      // Get dynamic config for this phone number (with current language)
      const currentLanguage = conversations[this.state.callSid]?.language || 'en';
      let config = configManager.getConfigForNumber(this.state.phoneNumber, currentLanguage);
      if (fallbackOverride?.modelId && fallbackOverride?.voiceId) {
        config = { ...config, model: { ...config.model, id: fallbackOverride.modelId }, voice: { ...config.voice, id: fallbackOverride.voiceId } };
        console.log(`🔄 [${this.state.callSid}] Using fallback model from chain: model=${fallbackOverride.modelId}, voice=${fallbackOverride.voiceId}`);
      }
      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      
      // Flow-specific temperature/model from FlowParameterOverride (e.g. booking vs default)
      const flowType = mapPhaseToFlowType(this.currentWorkflowPhase);
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

      // Apply conversation behavior: user speaking window from config (admin-editable)
      this.state.userSpeakingWindowMs = conversationBehaviorConfig?.conversationFlow?.userSpeakingWindowMs ?? 6000;
      
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
      // Defensive: ensure conversation exists so no code path reads recordingConsent on undefined
      if (!conversations[this.state.callSid]) {
        sessionManagementService.initializeSession(this.state.callSid, {
          language: 'en-GB',
          realtimeWs: this.ws,
          from: this.state.phoneNumber,
          to: this.state.phoneNumber,
          callType: 'Twilio',
          recordingConsent: { requested: false, given: null, requestedAt: null, respondedAt: null },
          memoryConsent: { requested: false, given: null, requestedAt: null, respondedAt: null },
          kba: { verified: false, method: null, verifiedAt: null, otpVerified: false, otpVerifiedAt: null, email: null, postcode: null, bookingReference: null }
        });
      }
      const conv = conversations[this.state.callSid];
      if (!conv.recordingConsent) {
        conv.recordingConsent = { requested: false, given: null, requestedAt: null, respondedAt: null };
      }
      const { ensureCallRecordCallerIdentity } = await import('../../../services/callRecordPersistenceService.js');
      await ensureCallRecordCallerIdentity(this.state.callSid, { from: this.state.phoneNumber, to: this.state.phoneNumber });

      // Add recording consent notice and question to instructions (TelephonyConfig.recordingSettings preferred, else PrivacyConfig)
      const telephonyConfig = configManager.getTelephonyConfig();
      const privacyConfig = await import('../../../database/models/PrivacyConfig.js').then(m => m.default).catch(() => null);
      let privacySettings = null;
      if (privacyConfig) {
        privacySettings = await privacyConfig.findOne({ isActive: true }).lean().catch(() => null);
        // OPTIMIZATION: Cache privacy settings in conversation for reuse
        if (privacySettings && conv) conv._cachedPrivacySettings = privacySettings;
      }
      const { consentRequired: requireExplicitConsent, consentMessage: consentNotice } = getEffectiveRecordingConsentSettings(telephonyConfig, privacySettings);
      const flowEn = getFlowCopy("en");

      // CRITICAL FIX: Check if consent was already set by handleIncomingCall (conv already ensured above)
      const existingConsent = conv.recordingConsent;
      const consentAlreadySet = existingConsent?.given === true;
      
      // Modify instructions to include recording consent flow at the start
      // NEW ORDER: Language preference (greeting) → Consent question → Main follow-up
      let modifiedInstructions = config.instructions;
      if (requireExplicitConsent && !consentAlreadySet) {
        modifiedInstructions = consentInstructionBuilder.buildSessionInstructions({
          consentNotice,
          consentQuestion: flowEn.consentQuestion,
          mainFollowUpQuestion: flowEn.mainFollowUpQuestion,
          baseInstructions: config.instructions
        });
        conv.recordingConsent.requested = false;
        conv.recordingConsent.given = null;
        this.state.waitingForLanguage = true;
        this.state.languagePreferenceState.asked = false;
        conv.waitingForLanguage = true;
        if (!conv.languagePreferenceState) {
          conv.languagePreferenceState = {
            asked: false,
            selected: false,
            language: null,
            askedAt: null,
            selectedAt: null
          };
        }
        console.log(`📋 [${this.state.callSid}] Recording consent will be requested after language selection - instructions include flow (greeting → consent → follow-up)`);
      } else if (consentAlreadySet) {
        // Consent was already set by handleIncomingCall - use it and skip consent question
        this.state.recordingConsentState.requested = existingConsent.requested || false;
        this.state.recordingConsentState.given = true;
        this.state.recordingConsentState.respondedAt = existingConsent.respondedAt || new Date();
        conv.recordingConsent.requested = existingConsent.requested || false;
        conv.recordingConsent.given = true;
        conv.recordingConsent.respondedAt = existingConsent.respondedAt || new Date();
        conv.recordingConsent.optOutReason = null;
        console.log(`✅ [${this.state.callSid}] Recording consent already set (given: true) - skipping consent question`);
      } else {
        // Opt-in by default: automatically set consent to given
        const consentData = {
          requested: false,
          given: true,
          respondedAt: new Date(),
          optOutReason: null
        };
        this.state.recordingConsentState.requested = consentData.requested;
        this.state.recordingConsentState.given = consentData.given;
        this.state.recordingConsentState.respondedAt = consentData.respondedAt;
        conv.recordingConsent.requested = consentData.requested;
        conv.recordingConsent.given = consentData.given;
        conv.recordingConsent.respondedAt = consentData.respondedAt;
        conv.recordingConsent.optOutReason = consentData.optOutReason;
        
        // CRITICAL: Save consent to CallRecord immediately so it's available when recording webhook arrives
        try {
          const CallRecord = (await import('../../../database/models/CallRecord.js')).default;
          await CallRecord.findOneAndUpdate(
            { callSid: this.state.callSid },
            {
              $set: {
                recordingConsent: consentData
              }
            },
            { upsert: true }
          );
          console.log(`✅ [${this.state.callSid}] Recording consent saved to CallRecord (opt-in by default)`);
        } catch (dbError) {
          console.error(`⚠️ [${this.state.callSid}] Error saving consent to CallRecord:`, dbError);
          // Continue even if DB save fails - consent is still in memory
        }
        
        console.log(`✅ [${this.state.callSid}] Recording consent set to opt-in by default (given: true)`);
        
        // CRITICAL: Even when consent is opt-in, we MUST still ask language preference
        this.state.waitingForLanguage = true;
        this.state.languagePreferenceState.asked = false;
        conv.waitingForLanguage = true;
        if (!conv.languagePreferenceState) {
          conv.languagePreferenceState = {
            asked: false,
            selected: false,
            language: null,
            askedAt: null,
            selectedAt: null
          };
        }
        console.log(`🌐 [${this.state.callSid}] Consent opt-in - language preference MUST be asked`);
      }
      
      // Use model from database configuration, fallback to default if not available
      console.log(`[PICKUP_LATENCY] [${this.state.callSid}] session_config_built ${latency()}ms`);
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
      
      // OPTIMIZATION: Reduced logging - only log if there's an issue
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
        console.log(`[PICKUP_LATENCY] [${this.state.callSid}] openai_ws_connect_start ${latency()}ms`);
        console.log(`🔌 [${this.state.callSid}] Attempting WebSocket connection...`);
        openaiWs = await this.createWebSocketWithRetry(openaiUrl, headers, 3, 1000);
        console.log(`[PICKUP_LATENCY] [${this.state.callSid}] openai_ws_connected ${latency()}ms`);
        console.log(`✅ [${this.state.callSid}] OpenAI WebSocket connected successfully`);
        
        // Initialize connection manager for robust connection handling (keep-alive, queuing, quality monitoring)
        this.connectionManager = new WebSocketConnectionManager(openaiWs, this.state.callSid, {
          pingInterval: 30000, // 30 seconds
          pongTimeout: 10000, // 10 seconds
          maxQueueSize: 100,
          unhealthyThreshold: 3
        });
        console.log(`🔧 [${this.state.callSid}] WebSocket connection manager initialized`);
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
      
      // Set OpenAI ready with connection manager reference
      this.state.setOpenAIReady(openaiWs, this.connectionManager);
      console.log(`[PICKUP_LATENCY] [${this.state.callSid}] openai_ready_set ${latency()}ms`);
      realtimeClients[this.state.callSid] = { twilioWs: this.ws, openaiWs, streamSid: this.state.streamSid, connectionManager: this.connectionManager };
      
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
          // Get filtered tool definitions based on current workflow phase
          // Start with 'greeting' phase which has minimal tools
          const toolContext = {
            workflowPhase: this.currentWorkflowPhase,
            clientVerified: conversations[this.state.callSid]?.kba?.verified || false
          };
          const tools = toolExecutor.getFilteredToolDefinitions(toolContext);
          
          // Clear any existing conversation state and audio buffer
          try {
            this.sendToOpenAI({ type: 'input_audio_buffer.clear' }, { priority: 'high' });
            console.log(`🧹 [${this.state.callSid}] Cleared input audio buffer at session start`);
          } catch (err) {
            console.warn(`⚠️ [${this.state.callSid}] Could not clear audio buffer at start:`, err.message);
          }
          
          // Get audio config for calibration check (noise_reduction not sent - session.audio rejected by API)
          const audioConfig = configManager.getAudioConfig();
          const initialThreshold = config.vadThreshold / 1000;
          const transcriptionLang = resolveTranscriptionLanguage(conversations[this.state.callSid]?.language || 'en');
          const sessionUpdateMessage = {
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
                silence_duration_ms: config.endPadding,
                create_response: false,
                interrupt_response: (audioConfig?.bargeInPolicy === 'stop')
              },
              tools: tools,
              tool_choice: 'auto',
              input_audio_transcription: { model: 'gpt-4o-transcribe', language: transcriptionLang }
            }
          };
          // Use robust send method with connection manager support
          this.sendToOpenAI(sessionUpdateMessage, { priority: 'high' });
          console.log(`[PICKUP_LATENCY] [${this.state.callSid}] session_update_sent ${this.state.pickupLatencyMs()}ms`);
          console.log(`📤 Sent session.update with config and ${tools.length} tools (phase: ${this.currentWorkflowPhase}) for call: ${this.state.callSid}`);
          console.log(`🔍 [${this.state.callSid}] Session config details:`);
          console.log(`   - input_audio_format: g711_ulaw`);
          console.log(`   - output_audio_format: g711_ulaw (direct format - no conversion needed)`);
          console.log(`   - voice: ${config.voice.id}`);
          console.log(`   - temperature: ${Math.max(0.6, effectiveTemperature)} (flow: ${flowType})`);
          console.log(`   - workflow_phase: ${this.currentWorkflowPhase}`);
          console.log(`   - turn_detection: server_vad`);
          console.log(`   - barge_in_policy: ${audioConfig?.bargeInPolicy ?? 'pause'}, interrupt_response: ${audioConfig?.bargeInPolicy === 'stop'}`);
          console.log(`   - input_transcription: gpt-4o-transcribe, language: ${transcriptionLang}`);
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
      
      this.state.markSetupComplete();
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
    if (!conv) return;
    
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
        // Get filtered tool definitions based on current workflow phase
        const toolContext = {
          workflowPhase: this.currentWorkflowPhase,
          clientVerified: conversations[this.state.callSid]?.kba?.verified || false
        };
        const tools = toolExecutor.getFilteredToolDefinitions(toolContext);
        
        // CRITICAL: Clear any existing conversation state and audio buffer
        try {
          this.sendToOpenAI({ type: 'input_audio_buffer.clear' }, { priority: 'high' });
          console.log(`🧹 [${this.state.callSid}] Cleared input audio buffer at session start`);
        } catch (err) {
          console.warn(`⚠️ [${this.state.callSid}] Could not clear audio buffer at start:`, err.message);
        }
        
        // Get audio config and flow-specific params (same as main setup path; noise_reduction not sent - session.audio rejected by API)
        const audioConfig = configManager.getAudioConfig();
        const initialThreshold = config.vadThreshold / 1000;
        const flowTypeOpen = mapPhaseToFlowType(this.currentWorkflowPhase);
        const effectiveParamsOpen = configManager.getEffectiveParameters(flowTypeOpen, configManager.getAIConfig());
        const effectiveTemperatureOpen = effectiveParamsOpen.temperature ?? config.temperature;
        const transcriptionLangOpen = resolveTranscriptionLanguage(conversations[this.state.callSid]?.language || 'en');
        const sessionUpdateMessage = {
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            instructions: modifiedInstructions || config.instructions,
            voice: config.voice.id,
            temperature: Math.max(0.6, effectiveTemperatureOpen),
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',  // Direct format - no conversion needed
            turn_detection: {
              type: 'server_vad',
              threshold: initialThreshold,
              prefix_padding_ms: config.startPadding,
              silence_duration_ms: config.endPadding,
              create_response: false,
              interrupt_response: (audioConfig?.bargeInPolicy === 'stop')
            },
            tools: tools,
            tool_choice: 'auto',
            input_audio_transcription: { model: 'gpt-4o-transcribe', language: transcriptionLangOpen }
          }
        };
        
        // Use robust send method with connection manager support
        this.sendToOpenAI(sessionUpdateMessage, { priority: 'high' });
        console.log(`📤 Sent session.update with config and ${tools.length} tools (phase: ${this.currentWorkflowPhase}) for call: ${this.state.callSid}`);
        console.log(`🔍 [${this.state.callSid}] Session config details:`);
        console.log(`   - input_audio_format: g711_ulaw`);
        console.log(`   - output_audio_format: g711_ulaw (direct format - no conversion needed)`);
        console.log(`   - voice: ${config.voice.id}`);
        console.log(`   - temperature: ${Math.max(0.6, effectiveTemperatureOpen)} (flow: ${flowTypeOpen})`);
        console.log(`   - workflow_phase: ${this.currentWorkflowPhase}`);
        console.log(`   - turn_detection: server_vad`);
        console.log(`   - barge_in_policy: ${audioConfig?.bargeInPolicy ?? 'pause'}, interrupt_response: ${audioConfig?.bargeInPolicy === 'stop'}`);
        console.log(`   - input_transcription: gpt-4o-transcribe, language: ${transcriptionLangOpen}`);
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
        
        if (event.type === 'session.updated') {
          const outFmt = event.session?.output_audio_format || 'N/A';
          const trans = event.session?.audio?.input?.transcription;
          const key = `${outFmt}-${trans ? JSON.stringify(trans) : 'null'}`;
          const callSid = this.state.callSid;
          if (this._lastSessionLogKey.get(callSid) !== key) {
            this._lastSessionLogKey.set(callSid, key);
            console.log(`📋 [${callSid}] Session config - output_audio_format: ${outFmt}, input_transcription: ${trans ? JSON.stringify(trans) : 'null'}`);
          }
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
   * Update tools for a new workflow phase.
   * Call this when the conversation transitions to a different workflow phase.
   * Sends a session.update to OpenAI with the filtered tools for the new phase.
   * 
   * @param {string} newPhase - The new workflow phase (e.g., 'booking_start', 'general_inquiry')
   * @param {Object} additionalContext - Additional context for tool filtering
   * @returns {boolean} True if update was sent successfully
   */
  updateToolsForPhase(newPhase, additionalContext = {}) {
    // Skip if phase hasn't changed
    if (newPhase === this.currentWorkflowPhase) {
      console.log(`🔧 [${this.state.callSid}] Tool update skipped - already in phase: ${newPhase}`);
      return true;
    }
    
    // Skip if WebSocket not ready
    if (!this.state.openaiWs || this.state.openaiWs.readyState !== 1) { // 1 = OPEN
      console.warn(`⚠️ [${this.state.callSid}] Cannot update tools - WebSocket not ready`);
      return false;
    }
    
    const previousPhase = this.currentWorkflowPhase;
    this.currentWorkflowPhase = newPhase;
    
    // Build context for tool filtering
    const toolContext = {
      workflowPhase: newPhase,
      clientVerified: conversations[this.state.callSid]?.kba?.verified || false,
      ...additionalContext
    };
    
    // Get filtered tools for the new phase
    const tools = toolExecutor.getFilteredToolDefinitions(toolContext);
    
    // Send session.update with only the tools property
    const sessionUpdateMessage = {
      type: 'session.update',
      session: {
        tools: tools,
        tool_choice: 'auto'
      }
    };
    
    const sent = this.sendToOpenAI(sessionUpdateMessage, { priority: 'high' });
    
    if (sent) {
      console.log(`🔄 [${this.state.callSid}] Workflow phase transition: ${previousPhase} → ${newPhase}`);
      console.log(`   - Tools updated: ${tools.length} tools now available`);
      console.log(`   - Tool names: ${tools.map(t => t.name).join(', ')}`);
    } else {
      // Revert phase on failure
      this.currentWorkflowPhase = previousPhase;
      console.error(`❌ [${this.state.callSid}] Failed to update tools for phase: ${newPhase}`);
    }
    
    return sent;
  }

  /**
   * Get the current workflow phase.
   * @returns {string} Current workflow phase
   */
  getCurrentWorkflowPhase() {
    return this.currentWorkflowPhase;
  }

  /**
   * Set the current workflow phase without sending session.update.
   * Use when a tool failure should keep the next response in a specific phase (e.g. process_payment failure → booking_payment).
   * @param {string} phase - Workflow phase (e.g. 'booking_payment')
   */
  setCurrentWorkflowPhase(phase) {
    if (phase && typeof phase === 'string') {
      this.currentWorkflowPhase = phase;
      console.log(`🔧 [${this.state.callSid}] Workflow phase set to ${phase} (no session update)`);
    }
  }

  /**
   * Cleanup OpenAI connection
   */
  cleanup() {
    // Idempotent: media stream sets state.isClosed before calling us; we must still close the Realtime WS.
    if (this._openaiCleanupRan) return;
    this._openaiCleanupRan = true;
    this.state.isClosed = true;

    console.log(`🧹 Cleaning up OpenAI integration for call: ${this.state.callSid}`);
    
    // Cleanup connection manager (stops keep-alive, clears queue)
    if (this.connectionManager) {
      this.connectionManager.cleanup();
      this.connectionManager = null;
    }
    
    if (this.openaiTimeout) {
      clearTimeout(this.openaiTimeout);
      this.openaiTimeout = null;
    }
    
    if (this.state.openaiWs) {
      this.state.openaiWs.removeAllListeners();
      if (this.state.openaiWs.readyState === WebSocket.OPEN) {
        try {
          // Use robust send method for cleanup messages (don't queue on failure)
          this.sendToOpenAI({ type: 'input_audio_buffer.clear' }, { priority: 'high', queueOnFailure: false });
          this.sendToOpenAI({ type: 'session.cancel' }, { priority: 'high', queueOnFailure: false });
        } catch (err) {
          console.warn(`⚠️ [${this.state.callSid}] Error clearing state during cleanup:`, err.message);
        }
        this.state.openaiWs.close(1000, 'Call ended');
      }
      this.state.openaiWs = null;
    }
    
    this.state.setOpenAIReady(null);
  }
}

