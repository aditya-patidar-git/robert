/**
 * OpenTelemetry Metrics Service
 * Collects and exports metrics for calls, tools, KB, and SIP
 */

import { metrics } from '@opentelemetry/api';
import { getMeterProvider } from '../utils/telemetry.js';

let meter = null;
let callMetrics = null;
let toolMetrics = null;
let kbMetrics = null;
let sipMetrics = null;

/**
 * Initialize metrics
 */
export function initializeMetrics() {
  try {
    const meterProvider = getMeterProvider();
    if (!meterProvider) {
      console.warn('⚠️ Meter provider not available, metrics will not be collected');
      return;
    }

    meter = metrics.getMeter('robert-backend', '1.0.0');

    // Call metrics
    callMetrics = {
      totalCalls: meter.createCounter('robert_calls_total', {
        description: 'Total number of calls',
        unit: '1'
      }),
      activeCalls: meter.createUpDownCounter('robert_calls_active', {
        description: 'Number of active calls',
        unit: '1'
      }),
      callDuration: meter.createHistogram('robert_call_duration_seconds', {
        description: 'Call duration in seconds',
        unit: 's'
      }),
      callErrors: meter.createCounter('robert_calls_errors_total', {
        description: 'Total number of call errors',
        unit: '1'
      }),
      callsByStatus: meter.createCounter('robert_calls_by_status_total', {
        description: 'Calls by status',
        unit: '1'
      }),
      callsByEntryPath: meter.createCounter('robert_calls_by_entry_path_total', {
        description: 'Calls by entry path (SIP, Streams)',
        unit: '1'
      })
    };

    // Tool metrics
    toolMetrics = {
      toolInvocations: meter.createCounter('robert_tool_invocations_total', {
        description: 'Total number of tool invocations',
        unit: '1'
      }),
      toolDuration: meter.createHistogram('robert_tool_duration_seconds', {
        description: 'Tool execution duration in seconds',
        unit: 's'
      }),
      toolErrors: meter.createCounter('robert_tool_errors_total', {
        description: 'Total number of tool errors',
        unit: '1'
      }),
      toolByType: meter.createCounter('robert_tool_by_type_total', {
        description: 'Tool invocations by type',
        unit: '1'
      })
    };

    // Knowledge Base metrics
    kbMetrics = {
      kbQueries: meter.createCounter('robert_kb_queries_total', {
        description: 'Total number of KB queries',
        unit: '1'
      }),
      kbQueryDuration: meter.createHistogram('robert_kb_query_duration_seconds', {
        description: 'KB query duration in seconds',
        unit: 's'
      }),
      kbQueryErrors: meter.createCounter('robert_kb_query_errors_total', {
        description: 'Total number of KB query errors',
        unit: '1'
      }),
      kbResultsCount: meter.createHistogram('robert_kb_results_count', {
        description: 'Number of results returned by KB queries',
        unit: '1'
      })
    };

    // SIP metrics
    sipMetrics = {
      sipCalls: meter.createCounter('robert_sip_calls_total', {
        description: 'Total number of SIP calls',
        unit: '1'
      }),
      sipCallDuration: meter.createHistogram('robert_sip_call_duration_seconds', {
        description: 'SIP call duration in seconds',
        unit: 's'
      }),
      sipErrors: meter.createCounter('robert_sip_errors_total', {
        description: 'Total number of SIP errors',
        unit: '1'
      }),
      sipConnections: meter.createUpDownCounter('robert_sip_connections', {
        description: 'Number of active SIP connections',
        unit: '1'
      }),
      sipRetries: meter.createCounter('robert_sip_retries_total', {
        description: 'Total number of SIP retries',
        unit: '1'
      })
    };

    console.log('✅ Metrics service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize metrics service:', error);
  }
}

/**
 * Record call metrics
 */
export function recordCallMetrics(callData) {
  if (!callMetrics) return;

  try {
    const { status, entryPath, duration, error } = callData;
    const labels = {};

    // Increment total calls
    callMetrics.totalCalls.add(1, labels);

    // Record status
    if (status) {
      callMetrics.callsByStatus.add(1, { ...labels, status });
    }

    // Record entry path
    if (entryPath) {
      callMetrics.callsByEntryPath.add(1, { ...labels, entry_path: entryPath });
    }

    // Record duration
    if (duration !== undefined) {
      callMetrics.callDuration.record(duration, labels);
    }

    // Record errors
    if (error) {
      callMetrics.callErrors.add(1, { ...labels, error_type: error.type || 'unknown' });
    }
  } catch (error) {
    console.error('Error recording call metrics:', error);
  }
}

/**
 * Increment active calls
 */
export function incrementActiveCalls(labels = {}) {
  if (!callMetrics) return;
  callMetrics.activeCalls.add(1, labels);
}

/**
 * Decrement active calls
 */
export function decrementActiveCalls(labels = {}) {
  if (!callMetrics) return;
  callMetrics.activeCalls.add(-1, labels);
}

/**
 * Record tool metrics
 */
export function recordToolMetrics(toolData) {
  if (!toolMetrics) return;

  try {
    const { toolName, duration, error, success } = toolData;
    const labels = { tool: toolName };

    // Increment total invocations
    toolMetrics.toolInvocations.add(1, labels);

    // Record by type
    toolMetrics.toolByType.add(1, labels);

    // Record duration
    if (duration !== undefined) {
      toolMetrics.toolDuration.record(duration, labels);
    }

    // Record errors
    if (error) {
      toolMetrics.toolErrors.add(1, { ...labels, error_type: error.type || 'unknown' });
    }
  } catch (error) {
    console.error('Error recording tool metrics:', error);
  }
}

/**
 * Record KB metrics
 */
export function recordKBMetrics(kbData) {
  if (!kbMetrics) return;

  try {
    const { query, duration, error, resultsCount } = kbData;
    const labels = {};

    // Increment total queries
    kbMetrics.kbQueries.add(1, labels);

    // Record duration
    if (duration !== undefined) {
      kbMetrics.kbQueryDuration.record(duration, labels);
    }

    // Record results count
    if (resultsCount !== undefined) {
      kbMetrics.kbResultsCount.record(resultsCount, labels);
    }

    // Record errors
    if (error) {
      kbMetrics.kbQueryErrors.add(1, { ...labels, error_type: error.type || 'unknown' });
    }
  } catch (error) {
    console.error('Error recording KB metrics:', error);
  }
}

/**
 * Record SIP metrics
 */
export function recordSIPMetrics(sipData) {
  if (!sipMetrics) return;

  try {
    const { event, duration, error, retry } = sipData;
    const labels = {};

    // Record SIP call
    if (event === 'call_started' || event === 'call_connected') {
      sipMetrics.sipCalls.add(1, labels);
    }

    // Record duration
    if (duration !== undefined) {
      sipMetrics.sipCallDuration.record(duration, labels);
    }

    // Record errors
    if (error) {
      sipMetrics.sipErrors.add(1, { ...labels, error_type: error.type || 'unknown' });
    }

    // Record retries
    if (retry) {
      sipMetrics.sipRetries.add(1, labels);
    }
  } catch (error) {
    console.error('Error recording SIP metrics:', error);
  }
}

/**
 * Increment SIP connections
 */
export function incrementSIPConnections(labels = {}) {
  if (!sipMetrics) return;
  sipMetrics.sipConnections.add(1, labels);
}

/**
 * Decrement SIP connections
 */
export function decrementSIPConnections(labels = {}) {
  if (!sipMetrics) return;
  sipMetrics.sipConnections.add(-1, labels);
}

export default {
  initializeMetrics,
  recordCallMetrics,
  incrementActiveCalls,
  decrementActiveCalls,
  recordToolMetrics,
  recordKBMetrics,
  recordSIPMetrics,
  incrementSIPConnections,
  decrementSIPConnections
};

