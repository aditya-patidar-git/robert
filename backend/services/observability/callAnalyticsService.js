/**
 * Call Analytics Service
 * Handles call-related analytics and database queries
 */

import CallRecord from '../../models/callRecord.js';
import ConversationContext from '../../models/ConversationContext.js';
import loggingService from './loggingService.js';

class CallAnalyticsService {
  /**
   * Parse time range string to milliseconds
   * @private
   */
  _parseTimeRange(timeRange) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    return ranges[timeRange] || ranges['1h'];
  }

  /**
   * Calculate percentile
   * @private
   */
  _calculatePercentile(values, percentile) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Group calls by hour for chart data
   * @private
   * @param {Array} calls - Array of call records
   * @param {Date} since - Start date for time range
   * @returns {Array} - Hourly aggregated call data
   */
  _groupCallsByHour(calls, since) {
    const hourlyData = {};
    
    calls.forEach(call => {
      // Use createdAt for grouping
      const callDate = new Date(call.createdAt);
      const hour = callDate.toISOString().substring(0, 13) + ':00';
      
      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          time: hour,
          count: 0,
          errors: 0,
          latencies: []
        };
      }
      
      hourlyData[hour].count++;
      
      // Count errors (failed calls or calls with error result)
      if (call.callStatus === 'failed' || call.result === 'error') {
        hourlyData[hour].errors++;
      }
      
      // Extract latency: prefer audioQuality.latency, fallback to metrics.aiResponseTime
      const latency = call.audioQuality?.latency || call.metrics?.aiResponseTime;
      if (latency != null) {
        hourlyData[hour].latencies.push(latency);
      }
    });

    // Calculate percentiles and format for charts
    return Object.values(hourlyData).map(hour => {
      const sortedLatencies = [...hour.latencies].sort((a, b) => a - b);
      const avgLatency = hour.latencies.length > 0
        ? Math.round(hour.latencies.reduce((sum, l) => sum + l, 0) / hour.latencies.length)
        : 0;
      
      return {
        time: hour.time.substring(11, 16), // HH:MM format for display
        count: hour.count,
        errors: hour.errors,
        avgLatency: avgLatency,
        p95Latency: this._calculatePercentile(sortedLatencies, 95),
        p99Latency: this._calculatePercentile(sortedLatencies, 99)
      };
    }).sort((a, b) => a.time.localeCompare(b.time));
  }

  /**
   * Group errors by component
   * @private
   */
  _groupErrorsByComponent(errorLogs) {
    const byComponent = {};
    errorLogs.forEach(log => {
      const component = log.context?.component || 'unknown';
      byComponent[component] = (byComponent[component] || 0) + 1;
    });
    return byComponent;
  }

  /**
   * Get system metrics with time range filtering
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @param {Object} inMemoryMetrics - In-memory metrics object
   * @returns {Object} - System metrics aggregated by time range
   */
  async getSystemMetrics(timeRange = '1h', inMemoryMetrics = {}) {
    const timeRangeMs = this._parseTimeRange(timeRange);
    const since = new Date(Date.now() - timeRangeMs);

    try {
      // Get call metrics from database
      const calls = await CallRecord.find({
        createdAt: { $gte: since }
      }).select('callStatus result metrics audioQuality duration createdAt');

      const totalCalls = calls.length;
      const completedCalls = calls.filter(c => c.callStatus === 'completed').length;
      const failedCalls = calls.filter(c => c.callStatus === 'failed' || c.result === 'error').length;
      const errorRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;

      // Calculate average latency
      const latencies = calls
        .map(c => c.audioQuality?.latency || c.metrics?.aiResponseTime)
        .filter(l => l != null);
      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
        : 0;

      // Calculate average MOS score
      const mosScores = calls
        .map(c => c.audioQuality?.mosScore)
        .filter(m => m != null);
      const avgMOS = mosScores.length > 0
        ? (mosScores.reduce((sum, m) => sum + m, 0) / mosScores.length).toFixed(1)
        : '0.0';

      return {
        calls: {
          total: totalCalls,
          completed: completedCalls,
          failed: failedCalls,
          errorRate: errorRate.toFixed(2) + '%'
        },
        performance: {
          avgLatency: avgLatency,
          avgMOS: avgMOS,
          p95Latency: this._calculatePercentile(latencies, 95),
          p99Latency: this._calculatePercentile(latencies, 99)
        },
        system: inMemoryMetrics,
        timeRange: timeRange,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      loggingService.error('Error getting system metrics', { error: error.message });
      return {
        calls: { total: 0, completed: 0, failed: 0, errorRate: '0%' },
        performance: { avgLatency: 0, avgMOS: '0.0', p95Latency: 0, p99Latency: 0 },
        system: inMemoryMetrics,
        timeRange: timeRange,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get performance metrics by operation
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @param {string} operation - Optional operation name filter (not used for call-based metrics)
   * @returns {Object} - Performance metrics with hourly call data
   */
  async getPerformanceMetrics(timeRange = '1h', operation = null) {
    const timeRangeMs = this._parseTimeRange(timeRange);
    const since = new Date(Date.now() - timeRangeMs);

    try {
      // Get call records from database for the time range
      const calls = await CallRecord.find({
        createdAt: { $gte: since }
      }).select('callStatus result metrics audioQuality duration createdAt').lean();

      // Group calls by hour for chart data
      const hourlyData = this._groupCallsByHour(calls, since);

      // Calculate overall performance metrics
      const latencies = calls
        .map(c => c.audioQuality?.latency || c.metrics?.aiResponseTime)
        .filter(l => l != null);
      
      const completedCalls = calls.filter(c => c.callStatus === 'completed');
      const failedCalls = calls.filter(c => c.callStatus === 'failed' || c.result === 'error');

      return {
        traces: {
          total: calls.length,
          completed: completedCalls.length,
          failed: failedCalls.length
        },
        performance: {
          avgDuration: latencies.length > 0
            ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
            : 0,
          p95Duration: this._calculatePercentile(latencies, 95),
          p99Duration: this._calculatePercentile(latencies, 99)
        },
        hourlyData: hourlyData,
        operation: operation,
        timeRange: timeRange
      };
    } catch (error) {
      loggingService.error('Error getting performance metrics', { error: error.message });
      return {
        traces: { total: 0, completed: 0, failed: 0 },
        performance: { avgDuration: 0, p95Duration: 0, p99Duration: 0 },
        hourlyData: [],
        operation: operation,
        timeRange: timeRange
      };
    }
  }

  /**
   * Get live/active calls
   * @returns {Array} - Array of active call records
   */
  async getLiveCalls() {
    try {
      const activeStatuses = ['queued', 'ringing', 'in-progress'];
      const calls = await CallRecord.find({
        callStatus: { $in: activeStatuses }
      })
        .select('callSid from to callStatus createdAt duration metrics audioQuality language')
        .sort({ createdAt: -1 })
        .limit(100);

      return calls.map(call => ({
        callSid: call.callSid,
        from: call.from,
        to: call.to,
        status: call.callStatus,
        duration: call.duration || Math.floor((Date.now() - call.createdAt.getTime()) / 1000),
        latency: call.audioQuality?.latency || call.metrics?.aiResponseTime || null,
        mosScore: call.audioQuality?.mosScore || null,
        language: call.language,
        startedAt: call.createdAt
      }));
    } catch (error) {
      loggingService.error('Error getting live calls', { error: error.message });
      return [];
    }
  }

  /**
   * Get per-call timeline
   * @param {string} callSid - Call SID
   * @returns {Object} - Call timeline with events
   */
  async getCallTimeline(callSid) {
    try {
      const call = await CallRecord.findOne({ callSid }).select(
        'callSid from to callStatus createdAt updatedAt transcript duration metrics audioQuality escalation complaint toolsUsed provenance'
      );

      if (!call) {
        return null;
      }

      const context = await ConversationContext.findOne({ callSid }).select('messages summaries truncationHistory');

      const timeline = [];

      // Call start
      timeline.push({
        timestamp: call.createdAt,
        type: 'call_start',
        data: { from: call.from, to: call.to, entryPath: call.entryPath }
      });

      // Transcript events
      if (call.transcript && call.transcript.length > 0) {
        call.transcript.forEach((turn, index) => {
          timeline.push({
            timestamp: turn.timestamp,
            type: 'transcript',
            data: {
              role: turn.role,
              text: turn.text.substring(0, 100) + (turn.text.length > 100 ? '...' : ''),
              confidence: turn.confidence
            }
          });
        });
      }

      // Tool executions
      if (call.toolsUsed && call.toolsUsed.length > 0) {
        call.toolsUsed.forEach(tool => {
          timeline.push({
            timestamp: tool.timestamp,
            type: 'tool_execution',
            data: {
              toolName: tool.toolName,
              executionTime: tool.executionTime,
              success: tool.success
            }
          });
        });
      }

      // KB retrievals
      if (call.provenance && call.provenance.length > 0) {
        call.provenance.forEach(prov => {
          timeline.push({
            timestamp: prov.timestamp,
            type: 'kb_retrieval',
            data: {
              fileName: prov.fileName,
              similarityScore: prov.similarityScore
            }
          });
        });
      }

      // Escalation
      if (call.escalation && call.escalation.escalated) {
        timeline.push({
          timestamp: call.escalation.escalatedAt,
          type: 'escalation',
          data: {
            reason: call.escalation.reason,
            targetNumber: call.escalation.targetNumber
          }
        });
      }

      // Complaint
      if (call.complaint && call.complaint.hasComplaint) {
        timeline.push({
          timestamp: call.complaint.complaintSubmittedAt,
          type: 'complaint',
          data: {
            status: call.complaint.complaintStatus
          }
        });
      }

      // Context truncations
      if (context && context.truncationHistory) {
        context.truncationHistory.forEach(trunc => {
          timeline.push({
            timestamp: trunc.timestamp,
            type: 'context_truncation',
            data: {
              tokensBefore: trunc.tokensBefore,
              tokensAfter: trunc.tokensAfter,
              strategy: trunc.strategy
            }
          });
        });
      }

      // Call end
      if (call.callStatus === 'completed' || call.callStatus === 'failed') {
        timeline.push({
          timestamp: call.updatedAt,
          type: 'call_end',
          data: {
            status: call.callStatus,
            result: call.result,
            duration: call.duration
          }
        });
      }

      // Sort by timestamp
      timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return {
        callSid: call.callSid,
        from: call.from,
        to: call.to,
        status: call.callStatus,
        duration: call.duration,
        timeline: timeline,
        summary: {
          totalEvents: timeline.length,
          transcriptTurns: call.transcript?.length || 0,
          toolExecutions: call.toolsUsed?.length || 0,
          kbRetrievals: call.provenance?.length || 0
        }
      };
    } catch (error) {
      loggingService.error('Error getting call timeline', { callSid, error: error.message });
      return null;
    }
  }

  /**
   * Get tool execution traces for a call
   * @param {string} callSid - Call SID
   * @returns {Array} - Array of tool execution traces
   */
  async getCallToolTraces(callSid) {
    try {
      const call = await CallRecord.findOne({ callSid }).select('toolsUsed toolTraceId');
      const context = await ConversationContext.findOne({ callSid }).select('messages');

      const traces = [];

      // Get tool executions from call record
      if (call && call.toolsUsed) {
        call.toolsUsed.forEach(tool => {
          traces.push({
            toolName: tool.toolName,
            timestamp: tool.timestamp,
            executionTime: tool.executionTime,
            success: tool.success,
            source: 'call_record'
          });
        });
      }

      // Get tool calls from conversation context
      if (context && context.messages) {
        context.messages.forEach((msg, index) => {
          if (msg.role === 'tool' || (msg.toolCalls && msg.toolCalls.length > 0)) {
            const toolCalls = msg.toolCalls || [{ name: 'unknown', id: msg.toolCallId }];
            toolCalls.forEach(toolCall => {
              traces.push({
                toolName: toolCall.name || toolCall.function?.name || 'unknown',
                timestamp: msg.timestamp,
                toolCallId: toolCall.id || msg.toolCallId,
                content: msg.content?.substring(0, 200),
                source: 'conversation_context',
                messageIndex: index
              });
            });
          }
        });
      }

      // Sort by timestamp
      traces.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return traces;
    } catch (error) {
      loggingService.error('Error getting call tool traces', { callSid, error: error.message });
      return [];
    }
  }

  /**
   * Get error budgets
   * @param {string} timeRange - Time range (1h, 6h, 24h, 7d)
   * @param {Function} getLogsFn - Function to get logs (from loggingService)
   * @returns {Object} - Error budget information
   */
  async getErrorBudgets(timeRange = '24h', getLogsFn) {
    const timeRangeMs = this._parseTimeRange(timeRange);
    const since = new Date(Date.now() - timeRangeMs);

    try {
      const calls = await CallRecord.find({
        createdAt: { $gte: since }
      }).select('callStatus result metrics errorCount');

      const totalCalls = calls.length;
      const failedCalls = calls.filter(c => 
        c.callStatus === 'failed' || c.result === 'error'
      ).length;
      const errorRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;

      // Error budget: 99% success rate target
      const targetErrorRate = 1.0; // 1% error rate target
      const errorBudget = targetErrorRate - errorRate;
      const budgetRemaining = Math.max(0, errorBudget);
      const budgetConsumed = Math.max(0, errorRate - targetErrorRate);

      // Get error logs
      const errorLogs = getLogsFn ? getLogsFn({ level: 'error', since: since.toISOString() }) : [];
      const errorCount = errorLogs.length;

      return {
        timeRange: timeRange,
        calls: {
          total: totalCalls,
          successful: totalCalls - failedCalls,
          failed: failedCalls,
          errorRate: errorRate.toFixed(2) + '%'
        },
        errorBudget: {
          target: targetErrorRate + '%',
          current: errorRate.toFixed(2) + '%',
          remaining: budgetRemaining.toFixed(2) + '%',
          consumed: budgetConsumed.toFixed(2) + '%',
          status: errorRate <= targetErrorRate ? 'within_budget' : 'exceeded'
        },
        errors: {
          total: errorCount,
          byComponent: this._groupErrorsByComponent(errorLogs)
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      loggingService.error('Error getting error budgets', { error: error.message });
      return {
        timeRange: timeRange,
        calls: { total: 0, successful: 0, failed: 0, errorRate: '0%' },
        errorBudget: {
          target: '1%',
          current: '0%',
          remaining: '1%',
          consumed: '0%',
          status: 'within_budget'
        },
        errors: { total: 0, byComponent: {} },
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default new CallAnalyticsService();

