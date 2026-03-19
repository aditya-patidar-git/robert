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
    this.audioFramesSentCount = 0;  // Track total frames sent for diagnostics
    this.firstAudioFrameTime = null;  // Timestamp of first audio frame sent
    this.callStartTime = Date.now();
    this.pickupLatencyStartTime = null;  // Set on start event for pickup→first-greeting timing
    this.startTimeout = null;
    this.durationTimer = null;

    // Response state
    this.isResponding = false;
    this.waitingForUser = true;
    this.lastUserTranscript = null;
    this.responseLockTimer = null;

    // Response tracking for barge-in
    this.activeResponseId = null;
    this.responseItemId = null;
    this.responseStartTime = null;
    this.lastCancellationTime = 0;
    this.explicitResponseRequested = false;
    this.cancelledResponseIds = new Set();
    this.cancellationTime = new Map();
    this.lastAudioChunkTime = 0;
    this.bargeInTailUntil = 0;
    this.audioFramesSentCountAtResponseStart = 0;
    this.currentResponseOutputTranscript = null;

    // Interruption state tracking
    this.isInterrupted = false;
    this.interruptionStartTime = 0;
    this.pendingTranscriptions = [];
    this.lastProcessedTranscriptionTime = 0;
    this.lastTranscriptionReceivedTime = 0;
    this.agentFinishedSpeakingTime = 0;
    this.userSpeakingWindowMs = 6000;
    this.userSpeechStartedTime = 0;
    this.pendingBargeInCheck = false; // Flag to track when user is speaking but we're waiting for transcription to check for "stop"
    this.interruptionTimeout = null; // Timeout to clear isInterrupted if transcriptions don't arrive
    this.bargeInWorkflowSnapshot = null; // Workflow-critical state snapshot at barge-in for resume restore

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
    /** When set (e.g. 'Sinhala'), next response must say that language is not available; then cleared */
    this.unsupportedLanguageRequested = null;

    // Tool execution tracking
    this.pendingToolCalls = new Map(); // call_id -> { name, arguments, startTime }
    this.recentToolCalls = new Map(); // callSid -> [{ name, parameters, timestamp }]
    this.activeToolExecutions = new Map(); // toolName -> { call_id, startTime, callSid }
    this.activeWorkflowTimers = new Map(); // callSid -> { toolName, startTime, timeout }
    this.expectedContinuations = new Map(); // toolName -> { previousCallId, structuredFlags, timestamp, callSid }
    this.toolExecutionCompleting = false; // Flag to prevent periodic updates during tool completion (race condition fix)
    this.toolExecutionCompletingTimeout = null; // Safety timeout to auto-clear stuck flag
    this.progressQueue = []; // { message: string, queuedAt: number } — path-based progress for periodic updates
    /** When true (after client_verification verified + requiresExplicitConfirmation), next turn must not offer booking_step_search_client so model calls booking_step_select_session when user says "yes" */
    this.postVerificationWaitingConfirmation = false;

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

    // Background noise filtering - track pending audio segments
    this.pendingAudioSegments = new Map(); // itemId → { timestamp, committedAt, transcriptionReceived, transcriptionQuality }
    this.segmentTranscriptionMap = new Map(); // itemId → { transcript, confidence, quality, timestamp }

    // Event waiting promises for race condition fixes
    this.pendingSessionUpdatePromise = null;
    this.pendingItemCreatePromise = null;
    /** Resolvers waiting for the next session.updated (mid-call language switch, etc.) */
    this._sessionUpdatedWaiters = [];
    /** After mid-call language switch: next response.create gets a one-shot output-language instruction */
    this.pendingOneShotOutputLanguageCanonical = null;
    /** Timestamp of last mid-call language switch (model or transcript); transcript fallback skips if within cooldown */
    this.lastMidCallLanguageSwitchAt = 0;

    // Pre-connection message queue: flush when WebSocket becomes ready (avoids "Cannot send - WebSocket not ready")
    this.preConnectionMessageQueue = [];
    this.MAX_PRE_CONNECTION_QUEUE = 200;
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
   * Mark OpenAI connection as ready and flush any messages queued before connection
   */
  setOpenAIReady(openaiWs, connectionManager = null) {
    this.openaiWs = openaiWs;
    this.openaiReady = true;
    this.openaiConnectionManager = connectionManager;
    this.flushPreConnectionQueue();
  }

  /**
   * Flush messages queued before WebSocket was ready (called from setOpenAIReady)
   */
  flushPreConnectionQueue() {
    if (this.preConnectionMessageQueue.length === 0) return;
    const target = this.openaiConnectionManager || this.openaiWs;
    const isOpen = this.openaiWs && this.openaiWs.readyState === 1;
    if (!target || !isOpen) return;
    while (this.preConnectionMessageQueue.length > 0) {
      const { message, options } = this.preConnectionMessageQueue.shift();
      if (this.openaiConnectionManager) {
        this.openaiConnectionManager.send(message, options);
      } else {
        try {
          const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
          this.openaiWs.send(msgStr);
        } catch (err) {
          console.error(`❌ [${this.callSid}] Error flushing queued message:`, err.message);
        }
      }
    }
  }

  /**
   * Send message to OpenAI WebSocket with connection manager support
   * Provides robust sending with queuing, keep-alive, and quality monitoring
   * @param {Object|string} message - Message to send
   * @param {Object} options - Send options (priority, queueOnFailure)
   * @returns {boolean} True if sent successfully
   */
  sendToOpenAI(message, options = {}) {
    if (this.isClosed) {
      console.warn(`⚠️ [${this.callSid}] Cannot send message - call is closed`);
      return false;
    }

    if (this.openaiConnectionManager) {
      return this.openaiConnectionManager.send(message, options);
    }

    if (this.openaiWs && this.openaiWs.readyState === 1) {
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        this.openaiWs.send(messageStr);
        return true;
      } catch (error) {
        console.error(`❌ [${this.callSid}] Error sending message:`, error.message);
        return false;
      }
    }

    if (this.preConnectionMessageQueue.length < this.MAX_PRE_CONNECTION_QUEUE) {
      this.preConnectionMessageQueue.push({ message, options });
      return true;
    }
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
    this.preConnectionMessageQueue = [];
    this._sessionUpdatedWaiters = [];
    this.pendingOneShotOutputLanguageCanonical = null;
  }

  /**
   * Wait until the next session.updated from Realtime API (or timeout).
   * Used after session.update so response.create runs with applied voice/instructions.
   */
  waitForNextSessionUpdated(timeoutMs = 5000) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        resolve();
      };
      const t = setTimeout(() => {
        console.warn(
          `⚠️ [${this.callSid}] waitForNextSessionUpdated timeout after ${timeoutMs}ms — continuing`
        );
        finish();
      }, timeoutMs);
      this._sessionUpdatedWaiters.push({ finish, t });
    });
  }

  /** Called from toolCoordinator when session.updated is received */
  flushSessionUpdatedWaiters() {
    const list = [...this._sessionUpdatedWaiters];
    this._sessionUpdatedWaiters = [];
    for (const rec of list) {
      clearTimeout(rec.t);
      rec.finish();
    }
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
   * Elapsed ms since start event (for pickup-latency logging). Returns null if not set.
   */
  pickupLatencyMs() {
    return this.pickupLatencyStartTime != null ? Date.now() - this.pickupLatencyStartTime : null;
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

  /**
   * Atomically acquire response creation lock
   * Returns true if lock was acquired, false if already locked
   * This prevents concurrent response creation from multiple handlers
   */
  tryAcquireResponseLock() {
    if (this.isResponding || this.activeResponseId !== null) {
      return false; // Already responding
    }
    // Atomically set the lock
    this.isResponding = true;
    this.explicitResponseRequested = true;

    // Fail-safe to prevent deadlocks: if a response isn't created within 5 seconds, forcefully release the lock
    if (this.responseLockTimer) {
      clearTimeout(this.responseLockTimer);
    }
    this.responseLockTimer = setTimeout(() => {
      if (this.isResponding && this.activeResponseId === null) {
        console.warn(`⚠️ [${this.callSid}] Response lock timeout triggered (5s)! Forcefully releasing stuck lock to prevent deadlock.`);
        this.activeResponseId = null; // Ensure clean state so periodic updates can acquire lock
        this.releaseResponseLock();
      }
    }, 5000);

    return true;
  }

  /**
   * Release response creation lock (call on error)
   */
  releaseResponseLock() {
    this.isResponding = false;
    this.explicitResponseRequested = false;
    if (this.responseLockTimer) {
      clearTimeout(this.responseLockTimer);
      this.responseLockTimer = null;
    }
  }

  /**
   * Force-release response lock and clear active response (e.g. when tool completes while holding message is playing).
   * Use when tool result must be spoken and a periodic holding response is still holding the lock.
   */
  forceReleaseResponseLock() {
    this.isResponding = false;
    this.activeResponseId = null;
    this.explicitResponseRequested = false;
    if (this.responseLockTimer) {
      clearTimeout(this.responseLockTimer);
      this.responseLockTimer = null;
    }
  }

  /**
   * Clear tool execution completing flag
   * Used to reset state after tool completion response is created or on error
   */
  clearToolExecutionCompleting() {
    this.toolExecutionCompleting = false;
    // Clear safety timeout if it exists
    if (this.toolExecutionCompletingTimeout) {
      clearTimeout(this.toolExecutionCompletingTimeout);
      this.toolExecutionCompletingTimeout = null;
    }
  }

  /**
   * Cleanup old audio segments to prevent memory leaks
   * Removes segments older than 30 seconds
   */
  cleanupOldSegments() {
    const now = Date.now();
    const MAX_SEGMENT_AGE_MS = 30000; // 30 seconds

    // Clean up pending segments
    for (const [itemId, segment] of this.pendingAudioSegments.entries()) {
      const age = now - segment.timestamp;
      if (age > MAX_SEGMENT_AGE_MS) {
        this.pendingAudioSegments.delete(itemId);
        this.segmentTranscriptionMap.delete(itemId);
      }
    }
  }
}

