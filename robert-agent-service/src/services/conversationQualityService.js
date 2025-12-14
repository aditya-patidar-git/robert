/**
 * Conversation Quality Service
 * Tracks conversation quality metrics including latency, interruptions, and tool success rates
 */

import { conversations } from "../shared/state.js";

class ConversationQualityService {
  constructor() {
    // Metrics are stored in conversation state, this service provides helper methods
  }

  /**
   * Track response latency (time from user input to agent response)
   * @param {string} callSid - Call SID
   * @param {number} latencyMs - Response latency in milliseconds
   */
  trackResponseLatency(callSid, latencyMs) {
    if (!conversations[callSid]) {
      return;
    }

    if (!conversations[callSid].qualityMetrics) {
      conversations[callSid].qualityMetrics = {
        responseLatencies: [],
        interruptions: [],
        toolExecutions: [],
        averageLatency: null,
        interruptionCount: 0,
        toolSuccessRate: null
      };
    }

    const metrics = conversations[callSid].qualityMetrics;
    metrics.responseLatencies.push({
      latency: latencyMs,
      timestamp: Date.now()
    });

    // Keep only last 100 latencies
    if (metrics.responseLatencies.length > 100) {
      metrics.responseLatencies.shift();
    }

    // Update average latency
    const sum = metrics.responseLatencies.reduce((acc, r) => acc + r.latency, 0);
    metrics.averageLatency = Math.round(sum / metrics.responseLatencies.length);

    console.log(`📊 [${callSid}] Response latency: ${latencyMs}ms (avg: ${metrics.averageLatency}ms)`);
  }

  /**
   * Track interruption (barge-in) event
   * @param {string} callSid - Call SID
   */
  trackInterruption(callSid) {
    if (!conversations[callSid]) {
      return;
    }

    if (!conversations[callSid].qualityMetrics) {
      conversations[callSid].qualityMetrics = {
        responseLatencies: [],
        interruptions: [],
        toolExecutions: [],
        averageLatency: null,
        interruptionCount: 0,
        toolSuccessRate: null
      };
    }

    const metrics = conversations[callSid].qualityMetrics;
    metrics.interruptions.push({
      timestamp: Date.now()
    });

    metrics.interruptionCount = metrics.interruptions.length;

    // Keep only last 50 interruptions
    if (metrics.interruptions.length > 50) {
      metrics.interruptions.shift();
    }

    console.log(`📊 [${callSid}] Interruption tracked (total: ${metrics.interruptionCount})`);
  }

  /**
   * Track tool execution
   * @param {string} callSid - Call SID
   * @param {string} toolName - Name of the tool
   * @param {boolean} success - Whether execution was successful
   * @param {number} durationMs - Execution duration in milliseconds
   */
  trackToolExecution(callSid, toolName, success, durationMs) {
    if (!conversations[callSid]) {
      return;
    }

    if (!conversations[callSid].qualityMetrics) {
      conversations[callSid].qualityMetrics = {
        responseLatencies: [],
        interruptions: [],
        toolExecutions: [],
        averageLatency: null,
        interruptionCount: 0,
        toolSuccessRate: null
      };
    }

    const metrics = conversations[callSid].qualityMetrics;
    metrics.toolExecutions.push({
      toolName,
      success,
      duration: durationMs,
      timestamp: Date.now()
    });

    // Keep only last 50 tool executions
    if (metrics.toolExecutions.length > 50) {
      metrics.toolExecutions.shift();
    }

    // Update success rate
    const successful = metrics.toolExecutions.filter(t => t.success).length;
    metrics.toolSuccessRate = metrics.toolExecutions.length > 0 
      ? Math.round((successful / metrics.toolExecutions.length) * 100) 
      : null;

    console.log(`📊 [${callSid}] Tool execution tracked: ${toolName} (success: ${success}, duration: ${durationMs}ms, success rate: ${metrics.toolSuccessRate}%)`);
  }

  /**
   * Get quality metrics for a call
   * @param {string} callSid - Call SID
   * @returns {Object|null} - Quality metrics or null
   */
  getQualityMetrics(callSid) {
    if (!conversations[callSid] || !conversations[callSid].qualityMetrics) {
      return null;
    }

    return conversations[callSid].qualityMetrics;
  }

  /**
   * Calculate overall quality score (0-100)
   * @param {string} callSid - Call SID
   * @returns {number|null} - Quality score or null if insufficient data
   */
  calculateQualityScore(callSid) {
    const metrics = this.getQualityMetrics(callSid);
    if (!metrics) {
      return null;
    }

    let score = 100;

    // Penalize high latency (target: < 2000ms)
    if (metrics.averageLatency) {
      if (metrics.averageLatency > 5000) {
        score -= 30;
      } else if (metrics.averageLatency > 3000) {
        score -= 20;
      } else if (metrics.averageLatency > 2000) {
        score -= 10;
      }
    }

    // Penalize high interruption rate (target: < 20% of responses)
    const responseCount = metrics.responseLatencies.length;
    if (responseCount > 0) {
      const interruptionRate = metrics.interruptionCount / responseCount;
      if (interruptionRate > 0.5) {
        score -= 25;
      } else if (interruptionRate > 0.3) {
        score -= 15;
      } else if (interruptionRate > 0.2) {
        score -= 10;
      }
    }

    // Penalize low tool success rate (target: > 90%)
    if (metrics.toolSuccessRate !== null) {
      if (metrics.toolSuccessRate < 70) {
        score -= 20;
      } else if (metrics.toolSuccessRate < 80) {
        score -= 10;
      } else if (metrics.toolSuccessRate < 90) {
        score -= 5;
      }
    }

    return Math.max(0, Math.min(100, score));
  }
}

export default new ConversationQualityService();

