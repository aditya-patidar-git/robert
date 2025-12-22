/**
 * OpenTelemetry Initialization for Agent Service
 * Sets up tracing, metrics, and auto-instrumentation
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

let sdk = null;
let meterProvider = null;

/**
 * Initialize OpenTelemetry SDK
 */
export function initializeTelemetry() {
  if (sdk) {
    console.log('⚠️ Telemetry already initialized');
    return;
  }

  try {
    // Resource attributes
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'robert-agent-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
    });

    // Jaeger exporter for traces
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      tags: {
        service: 'robert-agent-service'
      }
    });

    // Prometheus exporter for metrics
    const prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.PROMETHEUS_PORT || '9465', 10),
      endpoint: '/metrics'
    });

    // Initialize SDK
    sdk = new NodeSDK({
      resource,
      traceExporter: jaegerExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable fs instrumentation to reduce noise
          '@opentelemetry/instrumentation-fs': {
            enabled: false
          }
        }),
        new HttpInstrumentation(),
        new ExpressInstrumentation({
          ignoreIncomingRequestHook: (req) => {
            // Ignore health checks and metrics endpoints
            return req.url === '/' || req.url === '/metrics';
          }
        })
      ]
    });

    // Initialize metrics
    meterProvider = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: prometheusExporter,
          exportIntervalMillis: 60000 // Export every minute
        })
      ]
    });

    // Start SDK
    sdk.start();
    
    console.log('✅ OpenTelemetry initialized for agent service');
    console.log(`   - Traces: Jaeger (${process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'})`);
    console.log(`   - Metrics: Prometheus (port ${process.env.PROMETHEUS_PORT || '9465'})`);

    return { sdk, meterProvider };
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    // Don't throw - allow service to continue without telemetry
    return null;
  }
}

/**
 * Shutdown telemetry SDK
 */
export async function shutdownTelemetry() {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    console.log('✅ OpenTelemetry shutdown complete');
  }
  if (meterProvider) {
    await meterProvider.shutdown();
    meterProvider = null;
  }
}

/**
 * Get meter provider for creating custom metrics
 */
export function getMeterProvider() {
  return meterProvider;
}

export default {
  initializeTelemetry,
  shutdownTelemetry,
  getMeterProvider
};

