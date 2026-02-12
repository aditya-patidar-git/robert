import { conversations } from '../shared/state.js';

class AbusePreventionService {
  constructor() {
    this.callFrequency = new Map();
    this.suspiciousPatterns = new Map();
    this.RATE_LIMIT_WINDOW_MS = parseInt(process.env.ABUSE_RATE_LIMIT_WINDOW_MS, 10) || 3600000;
    this.MAX_CALLS_PER_WINDOW = parseInt(process.env.ABUSE_MAX_CALLS_PER_WINDOW, 10) || 100;
    this.BLOCK_DURATION_MS = parseInt(process.env.ABUSE_BLOCK_DURATION_MS, 10) || 86400000;
    this.SUSPICIOUS_PATTERN_THRESHOLD = parseInt(process.env.ABUSE_SUSPICIOUS_PATTERN_THRESHOLD, 10) || 5;
  }
  
  /**
   * Check if caller is rate limited
   * @param {string} callerId - Caller phone number
   * @returns {Promise<{allowed: boolean, reason?: string, retryAfter?: number}>}
   */
  async checkRateLimit(callerId) {
    try {
      if (!callerId || callerId === 'unknown') {
        return { allowed: true }; // Allow unknown callers (may be first call)
      }

      const now = Date.now();
      const callerData = this.callFrequency.get(callerId);

      // Check if blocked
      if (callerData && callerData.blocked) {
        const timeSinceBlock = now - callerData.blockedAt;
        if (timeSinceBlock < this.BLOCK_DURATION_MS) {
          const retryAfter = Math.ceil((this.BLOCK_DURATION_MS - timeSinceBlock) / 1000 / 60); // minutes
          return {
            allowed: false,
            reason: 'Caller is temporarily blocked due to abuse',
            retryAfter
          };
        } else {
          // Block expired, reset
          this.callFrequency.delete(callerId);
        }
      }

      // Check rate limit window
      if (!callerData) {
        // First call from this number
        this.callFrequency.set(callerId, {
          count: 1,
          windowStart: now,
          blocked: false
        });
        return { allowed: true };
      }

      const timeSinceWindowStart = now - callerData.windowStart;

      if (timeSinceWindowStart > this.RATE_LIMIT_WINDOW_MS) {
        // New window, reset
        this.callFrequency.set(callerId, {
          count: 1,
          windowStart: now,
          blocked: false
        });
        return { allowed: true };
      }

      // Within window, check count
      if (callerData.count >= this.MAX_CALLS_PER_WINDOW) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((this.RATE_LIMIT_WINDOW_MS - timeSinceWindowStart) / 1000 / 60); // minutes
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${callerData.count} calls in the last hour`,
          retryAfter
        };
      }

      // Increment count
      callerData.count++;
      this.callFrequency.set(callerId, callerData);

      return { allowed: true };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Fail closed: block call when abuse layer errors so attackers do not get full access
      return {
        allowed: false,
        reason: 'Temporarily unable to verify. Please try again later.'
      };
    }
  }

  /**
   * Record call for monitoring
   * @param {string} callerId - Caller phone number
   * @param {string} callSid - Call SID
   * @param {object} metadata - Call metadata
   */
  recordCall(callerId, callSid, metadata = {}) {
    try {
      if (!callerId || callerId === 'unknown') {
        return;
      }

      // Update call frequency
      const callerData = this.callFrequency.get(callerId);
      if (callerData) {
        callerData.count = (callerData.count || 0) + 1;
      }

      // Check for suspicious patterns
      this.detectSuspiciousPattern(callerId, callSid, metadata);
    } catch (error) {
      console.error('Error recording call:', error);
    }
  }

  /**
   * Detect suspicious patterns
   * @param {string} callerId - Caller phone number
   * @param {string} callSid - Call SID
   * @param {object} metadata - Call metadata
   */
  detectSuspiciousPattern(callerId, callSid, metadata) {
    try {
      if (!callerId || callerId === 'unknown') {
        return;
      }

      let patternData = this.suspiciousPatterns.get(callerId);
      if (!patternData) {
        patternData = {
          suspiciousCalls: 0,
          shortCalls: 0, // Calls < 30 seconds
          failedCalls: 0,
          lastCallTime: null
        };
      }

      // Check for short calls (potential abuse)
      if (metadata.duration && metadata.duration < 30) {
        patternData.shortCalls++;
      }

      // Check for failed calls
      if (metadata.status === 'failed' || metadata.status === 'no-answer') {
        patternData.failedCalls++;
      }

      // Check for rapid successive calls
      if (patternData.lastCallTime) {
        const timeSinceLastCall = Date.now() - patternData.lastCallTime;
        if (timeSinceLastCall < 60000) { // Less than 1 minute
          patternData.suspiciousCalls++;
        }
      }

      patternData.lastCallTime = Date.now();
      this.suspiciousPatterns.set(callerId, patternData);

      // Auto-block if threshold exceeded
      if (patternData.suspiciousCalls >= this.SUSPICIOUS_PATTERN_THRESHOLD) {
        this.blockCaller(callerId, 'Suspicious calling pattern detected');
      }
    } catch (error) {
      console.error('Error detecting suspicious pattern:', error);
    }
  }

  /**
   * Block a caller
   * @param {string} callerId - Caller phone number
   * @param {string} reason - Block reason
   */
  async blockCaller(callerId, reason) {
    try {
      if (!callerId || callerId === 'unknown') {
        return;
      }

      const callerData = this.callFrequency.get(callerId) || {
        count: 0,
        windowStart: Date.now(),
        blocked: false
      };

      callerData.blocked = true;
      callerData.blockedAt = Date.now();
      callerData.blockReason = reason;

      this.callFrequency.set(callerId, callerData);

      console.log(`🚫 Blocked caller ${callerId}: ${reason}`);
      
      // Send admin alert (fire and forget - don't block on alert sending)
      this.sendAdminAlert(callerId, reason).catch(error => {
        console.error('Error sending admin alert:', error);
      });
    } catch (error) {
      console.error('Error blocking caller:', error);
    }
  }

  /**
   * Send admin alert for abuse
   * Writes alert directly to database (no HTTP calls)
   * @param {string} callerId - Caller phone number
   * @param {string} reason - Block reason
   * @param {Object} metadata - Additional metadata
   */
  async sendAdminAlert(callerId, reason, metadata = {}) {
    try {
      // Get caller statistics for additional context
      const callerStats = this.getCallerStats(callerId);
      
      // Prepare alert metadata
      const alertMetadata = {
        ...metadata,
        callerStats: {
          callCount: callerStats?.callCount || 0,
          suspiciousCalls: callerStats?.suspiciousCalls || 0,
          shortCalls: callerStats?.shortCalls || 0,
          failedCalls: callerStats?.failedCalls || 0
        },
        blockedAt: new Date().toISOString()
      };

      // Write alert directly to database
      const Alert = (await import('../database/models/Alert.js')).default;
      
      const alert = new Alert({
        title: 'Abuse Prevention Alert',
        message: `Caller ${callerId} has been blocked due to: ${reason}`,
        severity: 'warning',
        callerId: callerId,
        reason: reason,
        component: 'abuse-prevention',
        source: 'agent-service',
        metadata: alertMetadata
      });

      await alert.save();
      console.log(`✅ [ABUSE PREVENTION] Alert created in database for caller ${callerId}`);
    } catch (error) {
      // Fallback to console log on any error
      console.log(`🚨 ADMIN ALERT: Caller ${callerId} blocked - ${reason}`);
      console.error(`❌ [ABUSE PREVENTION] Error creating alert: ${error.message}`);
    }
  }

  /**
   * Check if caller is blocked
   * @param {string} callerId - Caller phone number
   * @returns {boolean} True if blocked
   */
  isBlocked(callerId) {
    if (!callerId || callerId === 'unknown') {
      return false;
    }

    const callerData = this.callFrequency.get(callerId);
    if (!callerData || !callerData.blocked) {
      return false;
    }

    const timeSinceBlock = Date.now() - callerData.blockedAt;
    if (timeSinceBlock >= this.BLOCK_DURATION_MS) {
      // Block expired
      callerData.blocked = false;
      this.callFrequency.set(callerId, callerData);
      return false;
    }

    return true;
  }

  /**
   * Get caller statistics
   * @param {string} callerId - Caller phone number
   * @returns {object} Caller statistics
   */
  getCallerStats(callerId) {
    if (!callerId || callerId === 'unknown') {
      return null;
    }

    const callerData = this.callFrequency.get(callerId);
    const patternData = this.suspiciousPatterns.get(callerId);

    return {
      callCount: callerData?.count || 0,
      blocked: callerData?.blocked || false,
      blockReason: callerData?.blockReason || null,
      suspiciousCalls: patternData?.suspiciousCalls || 0,
      shortCalls: patternData?.shortCalls || 0,
      failedCalls: patternData?.failedCalls || 0
    };
  }
}

export default new AbusePreventionService();

