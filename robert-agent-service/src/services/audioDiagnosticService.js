/**
 * Audio Diagnostic Service
 * Reusable service for diagnosing audio issues and detecting OpenAI server errors
 * Follows single-responsibility principle and promotes code reusability
 */

class AudioDiagnosticService {
  constructor() {
    this.diagnostics = new Map(); // callSid -> diagnostic data
    this.enabled = process.env.AUDIO_DIAGNOSTICS_ENABLED === 'true' || false;
  }

  /**
   * Initialize diagnostics for a call
   * @param {string} callSid - Call SID
   */
  initializeCall(callSid) {
    if (!this.enabled) return;

    this.diagnostics.set(callSid, {
      callSid,
      startTime: Date.now(),
      audioEvents: {
        responseCreated: false,
        responseHasAudioModality: false,
        firstAudioDeltaReceived: false,
        audioDeltaCount: 0,
        lastAudioDeltaTime: null,
        totalAudioBytes: 0
      },
      errors: {
        openaiErrors: [],
        missingAudioModality: false,
        emptyAudioPayloads: 0
      },
      responseMetrics: {
        responseIds: [],
        audioTokens: 0,
        textTokens: 0,
        totalTokens: 0
      },
      status: {
        isResponding: false,
        activeResponseId: null,
        websocketReady: false
      }
    });
  }

  /**
   * Track response creation event
   * @param {string} callSid - Call SID
   * @param {Object} event - Response created event
   */
  trackResponseCreated(callSid, event) {
    if (!this.enabled) return;

    const diagnostic = this.diagnostics.get(callSid);
    if (!diagnostic) return;

    diagnostic.audioEvents.responseCreated = true;
    diagnostic.audioEvents.responseHasAudioModality = 
      (event.response?.modalities || []).includes('audio');
    
    if (event.response?.id) {
      diagnostic.responseMetrics.responseIds.push(event.response.id);
    }

    if (!diagnostic.audioEvents.responseHasAudioModality) {
      diagnostic.errors.missingAudioModality = true;
      console.warn(`⚠️ [DIAGNOSTIC] [${callSid}] Response created WITHOUT audio modality - OpenAI server issue detected`);
    }
  }

  /**
   * Track audio delta event
   * @param {string} callSid - Call SID
   * @param {Object} event - Audio delta event
   */
  trackAudioDelta(callSid, event) {
    if (!this.enabled) return;

    const diagnostic = this.diagnostics.get(callSid);
    if (!diagnostic) return;

    if (!diagnostic.audioEvents.firstAudioDeltaReceived) {
      diagnostic.audioEvents.firstAudioDeltaReceived = true;
      console.log(`✅ [DIAGNOSTIC] [${callSid}] First audio delta received from OpenAI`);
    }

    diagnostic.audioEvents.audioDeltaCount++;
    diagnostic.audioEvents.lastAudioDeltaTime = Date.now();

    if (event.delta) {
      const decodedSize = Buffer.from(event.delta, 'base64').length;
      diagnostic.audioEvents.totalAudioBytes += decodedSize;
    } else {
      diagnostic.errors.emptyAudioPayloads++;
    }

    // Log every 10th chunk for monitoring
    if (diagnostic.audioEvents.audioDeltaCount % 10 === 0) {
      const payloadSize = event.delta ? event.delta.length : 0;
      const decodedSize = event.delta ? Buffer.from(event.delta, 'base64').length : 0;
      console.log(`🔍 [DIAGNOSTIC] [${callSid}] Audio delta #${diagnostic.audioEvents.audioDeltaCount}: payload=${payloadSize} bytes, decoded=${decodedSize} bytes`);
    }
  }

  /**
   * Track OpenAI error event
   * @param {string} callSid - Call SID
   * @param {Object} errorEvent - Error event
   */
  trackOpenAIError(callSid, errorEvent) {
    if (!this.enabled) return;

    const diagnostic = this.diagnostics.get(callSid);
    if (!diagnostic) return;

    const errorInfo = {
      timestamp: Date.now(),
      code: errorEvent.error?.code || 'unknown',
      message: errorEvent.error?.message || '',
      type: errorEvent.error?.type || 'unknown',
      eventId: errorEvent.error?.event_id || null
    };

    diagnostic.errors.openaiErrors.push(errorInfo);
    console.error(`❌ [DIAGNOSTIC] [${callSid}] OpenAI error detected: ${errorInfo.code} - ${errorInfo.message}`);
  }

  /**
   * Track response completion
   * @param {string} callSid - Call SID
   * @param {Object} event - Response done event
   */
  trackResponseDone(callSid, event) {
    if (!this.enabled) return;

    const diagnostic = this.diagnostics.get(callSid);
    if (!diagnostic) return;

    if (event.response?.output) {
      const output = event.response.output;
      if (Array.isArray(output)) {
        output.forEach(item => {
          if (item.type === 'audio' && item.audio) {
            // Track audio tokens if available
            if (item.audio.tokens) {
              diagnostic.responseMetrics.audioTokens += item.audio.tokens;
            }
          }
          if (item.type === 'text' && item.text) {
            if (item.text.tokens) {
              diagnostic.responseMetrics.textTokens += item.text.tokens;
            }
          }
        });
      }
    }

    if (event.response?.usage) {
      diagnostic.responseMetrics.audioTokens = event.response.usage.output_audio_tokens || 0;
      diagnostic.responseMetrics.textTokens = event.response.usage.output_text_tokens || 0;
      diagnostic.responseMetrics.totalTokens = event.response.usage.total_tokens || 0;
    }

    // Check for silent audio issue
    if (diagnostic.responseMetrics.audioTokens === 0 && diagnostic.audioEvents.responseHasAudioModality) {
      console.warn(`⚠️ [DIAGNOSTIC] [${callSid}] Response completed with 0 audio tokens despite audio modality - possible OpenAI server issue`);
    }
  }

  /**
   * Update call status
   * @param {string} callSid - Call SID
   * @param {Object} status - Status object
   */
  updateStatus(callSid, status) {
    if (!this.enabled) return;

    const diagnostic = this.diagnostics.get(callSid);
    if (!diagnostic) return;

    Object.assign(diagnostic.status, status);
  }

  /**
   * Get diagnostic summary for a call
   * @param {string} callSid - Call SID
   * @returns {Object|null} - Diagnostic summary or null
   */
  getDiagnostics(callSid) {
    const diagnostic = this.diagnostics.get(callSid);
    if (!diagnostic) return null;

    const duration = Date.now() - diagnostic.startTime;
    
    // Determine if it's likely an OpenAI server issue
    const isLikelyOpenAIServerIssue = 
      (diagnostic.audioEvents.responseCreated && !diagnostic.audioEvents.responseHasAudioModality) ||
      (diagnostic.audioEvents.responseHasAudioModality && !diagnostic.audioEvents.firstAudioDeltaReceived && duration > 5000) ||
      (diagnostic.responseMetrics.audioTokens === 0 && diagnostic.audioEvents.responseHasAudioModality) ||
      diagnostic.errors.openaiErrors.length > 0;

    return {
      callSid,
      duration: `${duration}ms`,
      audioEvents: {
        ...diagnostic.audioEvents,
        averageChunkSize: diagnostic.audioEvents.audioDeltaCount > 0 
          ? Math.round(diagnostic.audioEvents.totalAudioBytes / diagnostic.audioEvents.audioDeltaCount)
          : 0
      },
      errors: diagnostic.errors,
      responseMetrics: diagnostic.responseMetrics,
      status: diagnostic.status,
      diagnosis: {
        isLikelyOpenAIServerIssue,
        reasons: this.getIssueReasons(diagnostic, isLikelyOpenAIServerIssue)
      }
    };
  }

  /**
   * Get reasons for issue diagnosis
   * @private
   * @param {Object} diagnostic - Diagnostic data
   * @param {boolean} isServerIssue - Whether it's likely a server issue
   * @returns {Array<string>} - Array of reason strings
   */
  getIssueReasons(diagnostic, isServerIssue) {
    const reasons = [];

    if (diagnostic.audioEvents.responseCreated && !diagnostic.audioEvents.responseHasAudioModality) {
      reasons.push('Response created without audio modality');
    }

    if (diagnostic.audioEvents.responseHasAudioModality && !diagnostic.audioEvents.firstAudioDeltaReceived) {
      reasons.push('Response has audio modality but no audio deltas received');
    }

    if (diagnostic.responseMetrics.audioTokens === 0 && diagnostic.audioEvents.responseHasAudioModality) {
      reasons.push('Response completed with 0 audio tokens despite audio modality');
    }

    if (diagnostic.errors.openaiErrors.length > 0) {
      reasons.push(`${diagnostic.errors.openaiErrors.length} OpenAI error(s) received`);
    }

    if (diagnostic.errors.emptyAudioPayloads > 0) {
      reasons.push(`${diagnostic.errors.emptyAudioPayloads} empty audio payload(s) received`);
    }

    if (!isServerIssue && diagnostic.audioEvents.firstAudioDeltaReceived && diagnostic.audioEvents.audioDeltaCount > 0) {
      reasons.push('Audio deltas received - likely local processing issue, not OpenAI server issue');
    }

    return reasons;
  }

  /**
   * Cleanup diagnostics for a call
   * @param {string} callSid - Call SID
   */
  cleanup(callSid) {
    this.diagnostics.delete(callSid);
  }

  /**
   * Get all active diagnostics
   * @returns {Array<Object>} - Array of diagnostic summaries
   */
  getAllDiagnostics() {
    return Array.from(this.diagnostics.keys()).map(callSid => 
      this.getDiagnostics(callSid)
    ).filter(d => d !== null);
  }
}

export default new AudioDiagnosticService();


