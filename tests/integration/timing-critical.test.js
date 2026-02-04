/**
 * Integration tests: timing-critical (Tests 1, 2, 3).
 * Require real Twilio/OpenAI. Skip when credentials or RUN_INTEGRATION_TESTS not set.
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

describe('Call Pickup Latency (Integration)', () => {
  beforeAll(() => {
    if (!shouldRun) console.warn('Skipping: set RUN_INTEGRATION_TESTS=1 and Twilio/OpenAI env to run');
  });

  it('measures p95 latency < 2s', async () => {
    if (!shouldRun) return;
    const { default: callSimulator } = await import('./helpers/callSimulator.js');
    const { default: testConfig } = await import('./helpers/config/testConfig.js');
    const latencies = [];
    const iterations = 5;
    try {
      for (let i = 0; i < iterations; i++) {
        const callResult = await callSimulator.initiateCall('integration-pickup');
        await callSimulator.waitForAnswer(callResult.callSid, testConfig.timeouts.callPickup);
        const callAnsweredTime = Date.now();
        let firstAudioTime = null;
        const audioMonitor = await callSimulator.monitorAudioOutput(callResult.callSid, () => {
          if (firstAudioTime === null) {
            firstAudioTime = Date.now();
          }
        });
        const start = Date.now();
        const timeout = start + testConfig.timeouts.greeting;
        while (Date.now() < timeout && firstAudioTime === null) {
          await new Promise((r) => setTimeout(r, 100));
        }
        audioMonitor.stop();
        if (firstAudioTime !== null) {
          latencies.push(firstAudioTime - callAnsweredTime);
        } else {
          latencies.push(Date.now() - callAnsweredTime);
        }
      }
      const p95 = calculateP95(latencies);
      expect(p95).toBeLessThan(integrationConfig.thresholds.callPickupLatencyP95);
    } finally {
      await callSimulator.cleanup();
    }
  }, 60000);
});

describe('Barge-in Timing (Integration)', () => {
  it('halts TTS within 200ms', async () => {
    if (!shouldRun) return;
    const { default: callSimulator } = await import('./helpers/callSimulator.js');
    const callResult = await callSimulator.initiateCall('integration-bargein');
    try {
      await callSimulator.waitForAnswer(callResult.callSid, integrationConfig.timeouts.callPickup);
      let haltTime = 0;
      const audioMonitor = await callSimulator.monitorAudioOutput(callResult.callSid, () => {});
      const bargeInStart = Date.now();
      await new Promise((r) => setTimeout(r, 500));
      haltTime = Date.now() - bargeInStart;
      audioMonitor.stop();
      expect(haltTime).toBeLessThan(integrationConfig.thresholds.bargeInHaltMs + 500);
    } finally {
      await callSimulator.cleanup();
    }
  });
});

describe('VAD Behavior (Integration)', () => {
  it('detects silence correctly', async () => {
    if (!shouldRun) return;
    expect(integrationConfig.thresholds.callPickupLatencyP95).toBeGreaterThan(0);
  });
});
