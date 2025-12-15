/**
 * Adaptive Timing Service
 * Tracks caller behavior patterns and adjusts response timing dynamically
 */

import { conversations } from "../shared/state.js";

class AdaptiveTimingService {
  constructor() {
    // Behavior tracking is stored in conversation state
  }

  /**
   * Track caller behavior event
   * @param {string} callSid - Call SID
   * @param {string} eventType - Type of event ('user_spoke', 'interruption', 'response_time')
   * @param {number} timestamp - Event timestamp
   * @param {Object} metadata - Additional event metadata
   */
  trackCallerBehavior(callSid, eventType, timestamp, metadata = {}) {
    if (!conversations[callSid]) {
      return;
    }

    if (!conversations[callSid].behaviorTracking) {
      conversations[callSid].behaviorTracking = {
        events: [],
        averageResponseTime: null,
        interruptionCount: 0,
        averageTurnLength: null,
        lastEventTime: null
      };
    }

    const tracking = conversations[callSid].behaviorTracking;
    
    // Add event
    tracking.events.push({
      type: eventType,
      timestamp,
      metadata
    });

    // Keep only last 50 events
    if (tracking.events.length > 50) {
      tracking.events.shift();
    }

    // Update statistics based on event type
    if (eventType === 'user_spoke') {
      if (tracking.lastEventTime) {
        const responseTime = timestamp - tracking.lastEventTime;
        this._updateAverageResponseTime(tracking, responseTime);
      }
      tracking.lastEventTime = timestamp;
    } else if (eventType === 'interruption') {
      tracking.interruptionCount++;
    } else if (eventType === 'turn_length' && metadata.duration) {
      this._updateAverageTurnLength(tracking, metadata.duration);
    }

    console.log(`📊 [${callSid}] Behavior tracked: ${eventType} (total events: ${tracking.events.length})`);
  }

  /**
   * Update average response time
   * @private
   */
  _updateAverageResponseTime(tracking, responseTime) {
    const responseEvents = tracking.events.filter(e => e.type === 'user_spoke');
    if (responseEvents.length === 0) return;

    const sum = responseEvents.reduce((acc, e) => {
      const prevEvent = tracking.events[tracking.events.indexOf(e) - 1];
      if (prevEvent && prevEvent.type === 'agent_finished') {
        return acc + (e.timestamp - prevEvent.timestamp);
      }
      return acc;
    }, responseTime);

    tracking.averageResponseTime = Math.round(sum / responseEvents.length);
  }

  /**
   * Update average turn length
   * @private
   */
  _updateAverageTurnLength(tracking, duration) {
    const turnEvents = tracking.events.filter(e => e.type === 'turn_length');
    if (turnEvents.length === 0) {
      tracking.averageTurnLength = duration;
      return;
    }

    const sum = turnEvents.reduce((acc, e) => acc + (e.metadata.duration || 0), duration);
    tracking.averageTurnLength = Math.round(sum / (turnEvents.length + 1));
  }

  /**
   * Calculate adaptive speaking window based on caller behavior
   * @param {string} callSid - Call SID
   * @param {number} baseWindow - Base window from config (ms)
   * @param {Object} config - ConversationBehaviorConfig conversationFlow settings
   * @returns {number} - Adaptive window in milliseconds
   */
  calculateAdaptiveWindow(callSid, baseWindow, config) {
    if (!config?.adaptivePacing) {
      return baseWindow;
    }

    const tracking = conversations[callSid]?.behaviorTracking;
    if (!tracking || tracking.events.length < 3) {
      // Not enough data, use base window
      return baseWindow;
    }

    const adaptationWindowSize = config.adaptationWindowSize || 5;
    const minWindow = config.minAdaptiveWindowMs || 3000;
    const maxWindow = config.maxAdaptiveWindowMs || 15000;

    // Analyze recent events (last N interactions)
    const recentEvents = tracking.events.slice(-adaptationWindowSize);
    
    // Calculate average response time from recent events
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (let i = 1; i < recentEvents.length; i++) {
      if (recentEvents[i].type === 'user_spoke' && recentEvents[i-1].type === 'agent_finished') {
        const responseTime = recentEvents[i].timestamp - recentEvents[i-1].timestamp;
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    if (responseCount === 0) {
      return baseWindow;
    }

    const avgResponseTime = totalResponseTime / responseCount;
    
    // Adjust window based on caller's response speed
    // Fast callers (< 2s average) -> reduce window slightly
    // Slow callers (> 5s average) -> increase window
    let adjustment = 0;
    
    if (avgResponseTime < 2000) {
      // Fast caller - reduce window by 20%
      adjustment = -0.2;
    } else if (avgResponseTime < 3000) {
      // Normal caller - slight reduction
      adjustment = -0.1;
    } else if (avgResponseTime > 8000) {
      // Very slow caller - increase window by 30%
      adjustment = 0.3;
    } else if (avgResponseTime > 5000) {
      // Slow caller - increase window by 15%
      adjustment = 0.15;
    }

    // Factor in interruption frequency
    const recentInterruptions = recentEvents.filter(e => e.type === 'interruption').length;
    const interruptionRate = recentInterruptions / recentEvents.length;
    
    if (interruptionRate > 0.3) {
      // High interruption rate - increase window to give more time
      adjustment += 0.2;
    } else if (interruptionRate < 0.1 && avgResponseTime < 3000) {
      // Low interruption rate and fast responses - can reduce window
      adjustment -= 0.1;
    }

    const adaptiveWindow = baseWindow * (1 + adjustment);
    
    // Clamp to min/max bounds
    const clampedWindow = Math.max(minWindow, Math.min(maxWindow, adaptiveWindow));
    
    console.log(`📊 [${callSid}] Adaptive window: ${baseWindow}ms → ${Math.round(clampedWindow)}ms (avg response: ${Math.round(avgResponseTime)}ms, interruptions: ${recentInterruptions})`);
    
    return Math.round(clampedWindow);
  }

  /**
   * Get optimal response delay based on caller behavior
   * @param {string} callSid - Call SID
   * @param {number} baseMin - Base minimum delay from config (ms)
   * @param {number} baseMax - Base maximum delay from config (ms)
   * @param {Object} config - ConversationBehaviorConfig conversationFlow settings
   * @returns {number} - Optimal delay in milliseconds
   */
  getOptimalResponseDelay(callSid, baseMin, baseMax, config) {
    if (!config?.adaptivePacing) {
      return baseMin;
    }

    const tracking = conversations[callSid]?.behaviorTracking;
    if (!tracking || tracking.events.length < 2) {
      return baseMin;
    }

    // Use average response time to determine delay
    // If caller responds quickly, we can respond quickly too
    // If caller takes time, we should also take a moment (more natural)
    if (tracking.averageResponseTime) {
      if (tracking.averageResponseTime < 2000) {
        // Fast caller - use shorter delay
        return Math.max(baseMin, Math.min(baseMax, baseMin + 200));
      } else if (tracking.averageResponseTime > 5000) {
        // Slow caller - use longer delay (but not too long)
        return Math.max(baseMin, Math.min(baseMax, baseMax - 200));
      }
    }

    return baseMin;
  }

  /**
   * Reset caller profile for a new call
   * @param {string} callSid - Call SID
   */
  resetCallerProfile(callSid) {
    if (conversations[callSid]) {
      conversations[callSid].behaviorTracking = {
        events: [],
        averageResponseTime: null,
        interruptionCount: 0,
        averageTurnLength: null,
        lastEventTime: null
      };
      console.log(`🧹 [${callSid}] Caller behavior profile reset`);
    }
  }

  /**
   * Get behavior statistics for a call
   * @param {string} callSid - Call SID
   * @returns {Object|null} - Behavior statistics or null
   */
  getBehaviorStats(callSid) {
    return conversations[callSid]?.behaviorTracking || null;
  }
}

export default new AdaptiveTimingService();

