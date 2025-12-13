/**
 * SIP Status Tracker
 * Tracks SIP call state transitions and logs SIP-specific events
 */

class SipStatusTracker {
  constructor() {
    this.statusHistory = new Map(); // Map<callId, statusHistory[]>
    this.maxHistoryPerCall = 50; // Keep last 50 status changes per call
  }

  /**
   * Track status change
   * @param {string} callId - Call ID
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata
   */
  trackStatus(callId, status, metadata = {}) {
    if (!this.statusHistory.has(callId)) {
      this.statusHistory.set(callId, []);
    }

    const history = this.statusHistory.get(callId);
    const statusEntry = {
      status,
      timestamp: Date.now(),
      metadata
    };

    history.push(statusEntry);

    // Keep only last N entries
    if (history.length > this.maxHistoryPerCall) {
      history.shift();
    }

    // Log status change
    console.log(`📞 [SIP] Call ${callId}: ${status}`, metadata);

    // Handle terminal states
    if (this.isTerminalState(status)) {
      this.logTerminalState(callId, status);
    }
  }

  /**
   * Get status history for a call
   * @param {string} callId - Call ID
   * @returns {Array} - Status history
   */
  getStatusHistory(callId) {
    return this.statusHistory.get(callId) || [];
  }

  /**
   * Get current status for a call
   * @param {string} callId - Call ID
   * @returns {string|null} - Current status or null
   */
  getCurrentStatus(callId) {
    const history = this.getStatusHistory(callId);
    if (history.length === 0) {
      return null;
    }
    return history[history.length - 1].status;
  }

  /**
   * Check if status is terminal
   * @param {string} status - Status to check
   * @returns {boolean} - True if terminal
   */
  isTerminalState(status) {
    return ['completed', 'failed', 'busy', 'no-answer', 'cancelled'].includes(status);
  }

  /**
   * Log terminal state
   * @param {string} callId - Call ID
   * @param {string} status - Terminal status
   */
  logTerminalState(callId, status) {
    const history = this.getStatusHistory(callId);
    const duration = history.length > 0 
      ? Date.now() - history[0].timestamp 
      : 0;

    console.log(`📞 [SIP] Call ${callId} ended with status: ${status} (duration: ${duration}ms)`);
  }

  /**
   * Handle SIP error code
   * @param {string} callId - Call ID
   * @param {number} errorCode - SIP error code
   * @param {string} errorMessage - Error message
   */
  handleErrorCode(callId, errorCode, errorMessage) {
    const errorMetadata = {
      errorCode,
      errorMessage,
      errorType: this.getErrorType(errorCode)
    };

    this.trackStatus(callId, 'error', errorMetadata);

    // Log specific error handling
    console.error(`❌ [SIP] Call ${callId} error: ${errorCode} - ${errorMessage}`);
  }

  /**
   * Get error type from SIP error code
   * @param {number} errorCode - SIP error code
   * @returns {string} - Error type
   */
  getErrorType(errorCode) {
    if (errorCode >= 400 && errorCode < 500) {
      return 'client_error';
    } else if (errorCode >= 500 && errorCode < 600) {
      return 'server_error';
    } else if (errorCode >= 600 && errorCode < 700) {
      return 'global_failure';
    }
    return 'unknown';
  }

  /**
   * Clean up history for a call
   * @param {string} callId - Call ID
   */
  cleanup(callId) {
    this.statusHistory.delete(callId);
  }

  /**
   * Clean up all history (for shutdown)
   */
  cleanupAll() {
    const count = this.statusHistory.size;
    this.statusHistory.clear();
    console.log(`🧹 [SIP] Cleaned up status history for ${count} calls`);
  }
}

export default new SipStatusTracker();

