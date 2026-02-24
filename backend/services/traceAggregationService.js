/**
 * Trace Aggregation Service
 * Aggregates OpenTelemetry traces into per-call timelines
 */

import { trace } from '@opentelemetry/api';
import CallRecord from '../models/CallRecord.js';

const tracer = trace.getTracer('trace-aggregation-service', '1.0.0');

/**
 * Trace Aggregation Service
 * Collects and aggregates traces for per-call timelines
 */
class TraceAggregationService {
  constructor() {
    this.traceCache = new Map(); // In-memory cache for traces
    this.cacheTTL = 3600000; // 1 hour TTL
  }

  /**
   * Get trace timeline for a call
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Trace timeline
   */
  async getCallTimeline(callSid) {
    const span = tracer.startSpan('get_call_timeline');
    span.setAttribute('call.sid', callSid);

    try {
      // Get call record
      const callRecord = await CallRecord.findOne({ callSid });
      if (!callRecord) {
        span.setStatus({ code: 2, message: 'Call not found' });
        span.end();
        return null;
      }

      // Build timeline from call record and traces
      const timeline = {
        callSid,
        callStartTime: callRecord.createdAt,
        callEndTime: callRecord.updatedAt,
        duration: callRecord.duration,
        entryPath: callRecord.entryPath,
        status: callRecord.callStatus,
        events: []
      };

      // Add call lifecycle events
      timeline.events.push({
        timestamp: callRecord.createdAt,
        type: 'call_started',
        service: 'robert-agent-service',
        details: {
          from: callRecord.from,
          to: callRecord.to,
          entryPath: callRecord.entryPath
        }
      });

      // Add SIP events if applicable
      if (callRecord.entryPath === 'SIP') {
        timeline.events.push({
          timestamp: callRecord.createdAt,
          type: 'sip_connected',
          service: 'robert-agent-service',
          details: {
            method: 'SIP'
          }
        });
      }

      // Add Media Streams events if applicable
      if (callRecord.entryPath === 'Streams') {
        timeline.events.push({
          timestamp: callRecord.createdAt,
          type: 'media_stream_started',
          service: 'robert-agent-service',
          details: {
            method: 'Media Streams'
          }
        });
      }

      // Add tool execution events
      if (callRecord.toolsUsed && callRecord.toolsUsed.length > 0) {
        callRecord.toolsUsed.forEach(tool => {
          timeline.events.push({
            timestamp: tool.timestamp || callRecord.createdAt,
            type: 'tool_executed',
            service: 'robert-agent-service',
            details: {
              toolName: tool.toolName,
              executionTime: tool.executionTime,
              success: tool.success
            }
          });
        });
      }

      // Add KB query events from provenance
      if (callRecord.provenance && callRecord.provenance.length > 0) {
        callRecord.provenance.forEach(provenance => {
          timeline.events.push({
            timestamp: provenance.timestamp || callRecord.createdAt,
            type: 'kb_query',
            service: 'robert-agent-service',
            details: {
              fileId: provenance.fileId,
              fileName: provenance.fileName,
              similarityScore: provenance.similarityScore
            }
          });
        });
      }

      // Add transcript events
      if (callRecord.transcript && callRecord.transcript.length > 0) {
        callRecord.transcript.forEach((entry, index) => {
          timeline.events.push({
            timestamp: entry.timestamp || callRecord.createdAt,
            type: 'transcript_entry',
            service: 'robert-agent-service',
            details: {
              role: entry.role,
              textLength: entry.text?.length || 0,
              confidence: entry.confidence
            }
          });
        });
      }

      // Add escalation events
      if (callRecord.escalation && callRecord.escalation.escalated) {
        timeline.events.push({
          timestamp: callRecord.escalation.escalatedAt || callRecord.updatedAt,
          type: 'call_escalated',
          service: 'robert-agent-service',
          details: {
            reason: callRecord.escalation.reason,
            targetNumber: callRecord.escalation.targetNumber
          }
        });
      }

      // Add call completion event
      timeline.events.push({
        timestamp: callRecord.updatedAt,
        type: 'call_completed',
        service: 'robert-agent-service',
        details: {
          status: callRecord.callStatus,
          result: callRecord.result,
          duration: callRecord.duration
        }
      });

      // Sort events by timestamp
      timeline.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Calculate metrics
      timeline.metrics = this.calculateTimelineMetrics(timeline);

      span.setStatus({ code: 1 });
      span.end();
      return timeline;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Calculate metrics from timeline
   * @param {Object} timeline - Timeline object
   * @returns {Object} Calculated metrics
   */
  calculateTimelineMetrics(timeline) {
    const metrics = {
      totalEvents: timeline.events.length,
      toolExecutions: 0,
      kbQueries: 0,
      transcriptEntries: 0,
      averageToolExecutionTime: 0,
      averageKBSimilarityScore: 0,
      totalToolExecutionTime: 0
    };

    let totalToolTime = 0;
    let totalKBScore = 0;
    let kbCount = 0;

    timeline.events.forEach(event => {
      switch (event.type) {
        case 'tool_executed':
          metrics.toolExecutions++;
          if (event.details.executionTime) {
            totalToolTime += event.details.executionTime;
          }
          break;
        case 'kb_query':
          metrics.kbQueries++;
          if (event.details.similarityScore) {
            totalKBScore += event.details.similarityScore;
            kbCount++;
          }
          break;
        case 'transcript_entry':
          metrics.transcriptEntries++;
          break;
      }
    });

    if (metrics.toolExecutions > 0) {
      metrics.averageToolExecutionTime = totalToolTime / metrics.toolExecutions;
      metrics.totalToolExecutionTime = totalToolTime;
    }

    if (kbCount > 0) {
      metrics.averageKBSimilarityScore = totalKBScore / kbCount;
    }

    return metrics;
  }

  /**
   * Get aggregated traces for multiple calls (paginated)
   * @param {Object} filters - Filter criteria (dateRange, status, entryPath)
   * @param {number} limit - Maximum number of calls to return per page
   * @param {number} page - Page number (1-based)
   * @returns {Promise<{ traces: Array, total: number }>} Traces for the page and total count
   */
  async getAggregatedTraces(filters = {}, limit = 100, page = 1) {
    const span = tracer.startSpan('get_aggregated_traces');
    const skip = Math.max(0, (page - 1) * limit);

    try {
      const query = {};

      // Apply filters
      if (filters.dateRange) {
        query.createdAt = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end)
        };
      }

      if (filters.status) {
        query.callStatus = filters.status;
      }

      if (filters.entryPath) {
        query.entryPath = filters.entryPath;
      }

      const [total, callRecords] = await Promise.all([
        CallRecord.countDocuments(query),
        CallRecord.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('callSid createdAt updatedAt duration entryPath callStatus')
      ]);

      // Get timelines for each call
      const timelines = await Promise.all(
        callRecords.map(record => this.getCallTimeline(record.callSid))
      );

      const traces = timelines.filter(t => t !== null);
      span.setStatus({ code: 1 });
      span.end();
      return { traces, total };
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Get trace statistics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Trace statistics
   */
  async getTraceStatistics(filters = {}) {
    const span = tracer.startSpan('get_trace_statistics');
    
    try {
      const query = {};

      if (filters.dateRange) {
        query.createdAt = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end)
        };
      }

      const callRecords = await CallRecord.find(query);

      const stats = {
        totalCalls: callRecords.length,
        callsByEntryPath: {},
        callsByStatus: {},
        averageDuration: 0,
        totalToolExecutions: 0,
        totalKBQueries: 0,
        averageToolExecutionTime: 0,
        averageKBSimilarityScore: 0
      };

      let totalDuration = 0;
      let totalToolTime = 0;
      let totalKBScore = 0;
      let kbCount = 0;

      for (const record of callRecords) {
        // Count by entry path
        const entryPath = record.entryPath || 'Unknown';
        stats.callsByEntryPath[entryPath] = (stats.callsByEntryPath[entryPath] || 0) + 1;

        // Count by status
        const status = record.callStatus || 'unknown';
        stats.callsByStatus[status] = (stats.callsByStatus[status] || 0) + 1;

        // Sum duration
        if (record.duration) {
          totalDuration += record.duration;
        }

        // Count tools
        if (record.toolsUsed) {
          stats.totalToolExecutions += record.toolsUsed.length;
          record.toolsUsed.forEach(tool => {
            if (tool.executionTime) {
              totalToolTime += tool.executionTime;
            }
          });
        }

        // Count KB queries
        if (record.provenance) {
          stats.totalKBQueries += record.provenance.length;
          record.provenance.forEach(prov => {
            if (prov.similarityScore) {
              totalKBScore += prov.similarityScore;
              kbCount++;
            }
          });
        }
      }

      // Calculate averages
      if (callRecords.length > 0) {
        stats.averageDuration = totalDuration / callRecords.length;
      }

      if (stats.totalToolExecutions > 0) {
        stats.averageToolExecutionTime = totalToolTime / stats.totalToolExecutions;
      }

      if (kbCount > 0) {
        stats.averageKBSimilarityScore = totalKBScore / kbCount;
      }

      span.setStatus({ code: 1 });
      span.end();
      return stats;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Get traces with combined search and filter support (paginated)
   * @param {Object} filters - Filter criteria (dateRange, search, status, entryPath)
   * @param {number} limit - Maximum number of traces to return per page
   * @param {number} page - Page number (1-based)
   * @returns {Promise<{ traces: Array, total: number }>} Traces for the page and total count
   */
  async getTraces(filters = {}, limit = 100, page = 1) {
    const span = tracer.startSpan('get_traces');

    try {
      // If there's a search term, use searchTraces
      if (filters.search) {
        return await this.searchTraces(filters.search, filters, limit, page);
      }

      // Otherwise use getAggregatedTraces
      return await this.getAggregatedTraces(filters, limit, page);
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Search traces by criteria (paginated)
   * @param {string} searchTerm - Search term
   * @param {Object} filters - Additional filters
   * @param {number} limit - Maximum number of traces per page
   * @param {number} page - Page number (1-based)
   * @returns {Promise<{ traces: Array, total: number }>} Matching trace timelines and total count
   */
  async searchTraces(searchTerm, filters = {}, limit = 50, page = 1) {
    const span = tracer.startSpan('search_traces');
    span.setAttribute('search.term', searchTerm);
    const skip = Math.max(0, (page - 1) * limit);

    try {
      const query = {
        $or: [
          { callSid: { $regex: searchTerm, $options: 'i' } },
          { from: { $regex: searchTerm, $options: 'i' } },
          { to: { $regex: searchTerm, $options: 'i' } },
          { summary: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      // Apply additional filters
      if (filters.dateRange) {
        query.createdAt = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end)
        };
      }

      if (filters.status) {
        query.callStatus = filters.status;
      }

      const [total, callRecords] = await Promise.all([
        CallRecord.countDocuments(query),
        CallRecord.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('callSid')
      ]);

      const timelines = await Promise.all(
        callRecords.map(record => this.getCallTimeline(record.callSid))
      );

      const traces = timelines.filter(t => t !== null);
      span.setStatus({ code: 1 });
      span.end();
      return { traces, total };
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      span.end();
      throw error;
    }
  }
}

// Export singleton instance
export default new TraceAggregationService();

