/**
 * Call State Manager
 * Manages all state variables for a media stream call
 */
export class CallStateManager {
  constructor() {
    // Connection state
    this.callSid = null;
    this.streamSid = null;
    this.phoneNumber = null;
    this.openaiWs = null;
    this.openaiReady = false;
    this.setupComplete = false;
    this.isClosed = false;
    this.accepting = true;
    this.openaiConnectionManager = null; // Reference to WebSocketConnectionManager for robust sending
    
    // Constants
    this.MAX_CALL_DURATION_MS = 3600000; // 1 hour max
    this.MAX_ERROR_COUNT = 5;
    this.MAX_AUDIO_BUFFER_SIZE = 100;
    this.AUDIO_CANCELLATION_GRACE_PERIOD = 2000; // 2 seconds
    this.AUDIO_PLAYBACK_GRACE_PERIOD = 1500; // 1.5 seconds
    this.CONSENT_TIMEOUT_MS = 20000; // 20 seconds
    this.CALIBRATION_DURATION_MS = 3000; // 3 seconds
    this.DUPLICATE_CALL_WINDOW_MS = 3000; // 3 seconds
    this.WORKFLOW_TIMEOUT_MS = 900000; // 15 minutes
    this.CONTINUATION_TIMEOUT_MS = 300000; // 5 minutes
    
    // Error and timing tracking
    this.errorCount = 0;
    this.audioChunkCount = 0;  // Keep for backward compatibility
    this.inboundAudioChunkCount = 0;  // Track inbound audio separately
    this.outboundAudioChunkCount = 0;  // Track outbound audio separately
    this.audioChunkWarningLogged = false;
    this.audioDeltaLogged = false;
    
    // Outbound audio buffering and pacing
    this.outboundAudioBuffer = null;  // Buffer for pacing audio chunks (Buffer object)
    this.lastOutboundSendTime = 0;  // Last time we sent an audio frame
    this.outboundAudioPacer = null;  // Interval timer for sending frames at correct rate
    this.callStartTime = Date.now();
    this.startTimeout = null;
    this.durationTimer = null;
    
    // Response state
    this.isResponding = false;
    this.waitingForUser = true;
    this.lastUserTranscript = null;
    
    // Response tracking for barge-in
    this.activeResponseId = null;
    this.responseItemId = null;
    this.responseStartTime = null;
    this.lastCancellationTime = 0;
    this.explicitResponseRequested = false;
    this.cancelledResponseIds = new Set();
    this.cancellationTime = new Map();
    this.lastAudioChunkTime = 0;
    
    // Interruption state tracking
    this.isInterrupted = false;
    this.interruptionStartTime = 0;
    this.pendingTranscriptions = [];
    this.lastProcessedTranscriptionTime = 0;
    this.lastTranscriptionReceivedTime = 0;
    this.agentFinishedSpeakingTime = 0;
    this.userSpeakingWindowMs = 6000;
    this.userSpeechStartedTime = 0;
    
    // Initial greeting tracking
    this.hasInitialGreetingBeenSent = false;
    this.hasInitialGreetingCompleted = false;
    
    // Recording consent tracking
    this.recordingConsentState = {
      requested: false,
      given: null, // null = not yet responded, true = consented, false = declined
      requestedAt: null,
      respondedAt: null
    };
    this.consentTimeout = null;
    
    // Language preference tracking
    this.waitingForLanguage = false;
    this.languagePreferenceState = {
      asked: false,
      selected: false,
      language: null,
      askedAt: null,
      selectedAt: null
    };
    
    // Tool execution tracking
    this.pendingToolCalls = new Map(); // call_id -> { name, arguments, startTime }
    this.recentToolCalls = new Map(); // callSid -> [{ name, parameters, timestamp }]
    this.activeToolExecutions = new Map(); // toolName -> { call_id, startTime, callSid }
    this.activeWorkflowTimers = new Map(); // callSid -> { toolName, startTime, timeout }
    this.expectedContinuations = new Map(); // toolName -> { previousCallId, structuredFlags, timestamp, callSid }
    
    // VAD Calibration tracking
    this.calibrationSamples = [];
    this.calibrationStartTime = null;
    this.calibrationComplete = false;
    this.calibratedThreshold = null;
    
    // Speech Continuation Grace Period tracking
    this.speechStoppedTime = 0;
    this.speechContinuationGraceTimer = null;
    this.speechResumedDuringGrace = false;
    this.gracePeriodExtensionCount = 0;
    this.pendingTranscriptionsAfterGrace = [];
    
    // Audio quality metrics
    this.audioMetrics = {
      incomingTimestamps: [],
      outgoingTimestamps: [],
      responseTimestamps: [],
      expectedChunks: 0,
      receivedChunks: 0,
      lastIncomingTime: null,
      lastOutgoingTime: null,
      lastResponseTime: null
    };
    
    // Event waiting promises for race condition fixes
    this.pendingSessionUpdatePromise = null;
    this.pendingItemCreatePromise = null;
  }

  /**
   * Initialize call state with callSid, streamSid, and phoneNumber
   */
  initialize(callSid, streamSid, phoneNumber) {
    this.callSid = callSid;
    this.streamSid = streamSid;
    this.phoneNumber = phoneNumber;
    this.callStartTime = Date.now();
  }

  /**
   * Mark OpenAI connection as ready
   */
  setOpenAIReady(openaiWs, connectionManager = null) {
    this.openaiWs = openaiWs;
    this.openaiReady = true;
    this.openaiConnectionManager = connectionManager;
  }

  /**
   * Send message to OpenAI WebSocket with connection manager support
   * Provides robust sending with queuing, keep-alive, and quality monitoring
   * @param {Object|string} message - Message to send
   * @param {Object} options - Send options (priority, queueOnFailure)
   * @returns {boolean} True if sent successfully
   */
  sendToOpenAI(message, options = {}) {
    // Use connection manager if available (provides queuing, keep-alive, quality monitoring)
    if (this.openaiConnectionManager) {
      return this.openaiConnectionManager.send(message, options);
    }
    
    // Fallback to direct send if connection manager not available
    if (this.openaiWs && this.openaiWs.readyState === 1) { // 1 = OPEN
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        this.openaiWs.send(messageStr);
        return true;
      } catch (error) {
        console.error(`❌ [${this.callSid}] Error sending message:`, error.message);
        return false;
      }
    }
    
    console.warn(`⚠️ [${this.callSid}] Cannot send message - WebSocket not ready (readyState: ${this.openaiWs?.readyState})`);
    return false;
  }

  /**
   * Mark setup as complete
   */
  markSetupComplete() {
    this.setupComplete = true;
  }

  /**
   * Mark connection as closed
   */
  markClosed() {
    this.isClosed = true;
    this.accepting = false;
  }

  /**
   * Check if connection is active
   */
  isActive() {
    return !this.isClosed && this.openaiReady;
  }

  /**
   * Increment error count
   */
  incrementErrorCount() {
    this.errorCount++;
    return this.errorCount;
  }

  /**
   * Reset error count
   */
  resetErrorCount() {
    this.errorCount = 0;
  }

  /**
   * Check if max errors reached
   */
  hasMaxErrors() {
    return this.errorCount >= this.MAX_ERROR_COUNT;
  }

  /**
   * Get state snapshot (for debugging)
   */
  getStateSnapshot() {
    return {
      callSid: this.callSid,
      streamSid: this.streamSid,
      phoneNumber: this.phoneNumber,
      openaiReady: this.openaiReady,
      setupComplete: this.setupComplete,
      isClosed: this.isClosed,
      isResponding: this.isResponding,
      waitingForUser: this.waitingForUser,
      isInterrupted: this.isInterrupted,
      hasInitialGreetingCompleted: this.hasInitialGreetingCompleted,
      errorCount: this.errorCount,
      audioChunkCount: this.audioChunkCount
    };
  }
}

