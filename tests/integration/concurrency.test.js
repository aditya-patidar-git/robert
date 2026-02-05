/**
 * Integration test: Concurrency / Load (Test 9).
 * Requires real Twilio. Skip when credentials or RUN_INTEGRATION_TESTS not set.
 * No cross-talk is verified by manual/observability; each call uses distinct Media Streams and call SID.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { integrationConfig } from './config/integrationConfig.js';

const shouldRun = integrationConfig.enabled;

function calculateP95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

describe('Concurrency (Load Test)', () => {
  beforeAll(() => {
    if (!shouldRun) console.warn('Skipping: set RUN_INTEGRATION_TESTS=1 and Twilio env to run');
  });

  it(
    'handles 20 simultaneous calls',
    async () => {
      if (!shouldRun) return;
      const { default: callSimulator } = await import('./helpers/callSimulator.js');
      const n = Math.min(integrationConfig.concurrency.numCalls, 20);
      const latencies = [];
      const start = Date.now();
      try {
        const promises = Array.from({ length: n }, () =>
          callSimulator.initiateCall('integration-concurrency').then((r) => {
            latencies.push(Date.now() - start);
            return r;
          })
        );
        await Promise.all(promises);
        const p95 = calculateP95(latencies);
        expect(p95).toBeLessThan(integrationConfig.thresholds.p95LatencyConcurrency);
      } finally {
        await callSimulator.cleanup();
      }
    },
    integrationConfig.timeouts.concurrency
  );
});
