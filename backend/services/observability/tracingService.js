/**
 * Tracing Service
 * Handles in-memory trace management
 * Note: OpenTelemetry traces are handled separately
 */

class TracingService {
  constructor() {
    this.traces = new Map();
    this.traceCounter = 0;
    this.config = {
      maxTraces: 1000, // Maximum number of traces to keep in memory
      enableConsole: process.env.NODE_ENV !== 'production' // Console logging in dev
    };
  }

  /**
   * Start a new trace for performance monitoring
   * @param {string} traceName - Name of the trace
   * @param {Object} metadata - Additional metadata for the trace
   * @returns {string} - Trace ID for correlation
   */
  startTrace(traceName, metadata = {}) {
    const traceId = `trace_${Date.now()}_${++this.traceCounter}`;
    const trace = {
      id: traceId,
      name: traceName,
      startTime: Date.now(),
      metadata: metadata,
      endTime: null,
      duration: null,
      success: null,
      error: null
    };
    
    this.traces.set(traceId, trace);
    
    // Cleanup old traces if we exceed the limit
    if (this.traces.size > this.config.maxTraces) {
      const oldestTrace = Array.from(this.traces.values())
        .sort((a, b) => a.startTime - b.startTime)[0];
      this.traces.delete(oldestTrace.id);
    }
    
    if (this.config.enableConsole) {
      console.log(`🔍 TRACE START: ${traceName} [${traceId}]`, metadata);
    }
    
    return traceId;
  }

  /**
   * End a trace with results
   * @param {string} traceId - Trace ID returned from startTrace
   * @param {Object} result - Result object with success status and optional error
   */
  endTrace(traceId, result = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      console.warn(`⚠️ Trace not found: ${traceId}`);
      return;
    }
    
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.success = result.success !== false; // Default to true unless explicitly false
    trace.error = result.error || null;
    
    if (this.config.enableConsole) {
      const status = trace.success ? '✅' : '❌';
      console.log(`${status} TRACE END: ${trace.name} [${traceId}] - ${trace.duration}ms`, {
        success: trace.success,
        error: trace.error
      });
    }
  }

  /**
   * Get all traces
   * @returns {Array} - Array of trace objects
   */
  getTraces() {
    return Array.from(this.traces.values());
  }

  /**
   * Get traces by name pattern
   * @param {string} pattern - Pattern to match trace names
   * @returns {Array} - Filtered traces
   */
  getTracesByPattern(pattern) {
    return Array.from(this.traces.values())
      .filter(trace => trace.name.includes(pattern));
  }

  /**
   * Get trace by ID
   * @param {string} traceId - Trace ID
   * @returns {Object|null} - Trace object or null if not found
   */
  getTrace(traceId) {
    return this.traces.get(traceId) || null;
  }

  /**
   * Reset all traces
   */
  resetTraces() {
    this.traces.clear();
    if (this.config.enableConsole) {
      console.log('🔄 TRACES RESET');
    }
  }
}

export default new TracingService();

