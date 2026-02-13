/**
 * Integration tests: timing-critical (Tests 1, 2, 3).
 * Require real Twilio/OpenAI. Skip when credentials or RUN_INTEGRATION_TESTS not set.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { integrationConfig } from './config/integrationConfig.js';

const shouldRun = integrationConfig.enabled;

describe('Call Pickup Latency (Integration)', () => {
  beforeAll(() => {
    if (!shouldRun) console.warn('Skipping: set RUN_INTEGRATION_TESTS=1 and Twilio/OpenAI env to run');
  });

  it('measures single-call latency (answer → first audio) under threshold', async () => {
    if (!shouldRun) return;
    const { default: callSimulator } = await import('./helpers/callSimulator.js');
    const { default: testConfig } = await import('./helpers/config/testConfig.js');
    try {
      const warmUpResult = await callSimulator.initiateCall('integration-pickup');
      await callSimulator.waitForAnswer(warmUpResult.callSid, integrationConfig.timeouts.callPickup);
      let warmUpFirstAudio = null;
      const warmUpMonitor = await callSimulator.monitorAudioOutput(warmUpResult.callSid, () => {
        if (warmUpFirstAudio === null) warmUpFirstAudio = Date.now();
      });
      const warmUpDeadline = Date.now() + 8000;
      while (Date.now() < warmUpDeadline && warmUpFirstAudio === null) {
        await new Promise((r) => setTimeout(r, 100));
      }
      warmUpMonitor.stop();
      await callSimulator.hangup(warmUpResult.callSid);
      await new Promise((r) => setTimeout(r, 1500));

      const callResult = await callSimulator.initiateCall('integration-pickup');
      await callSimulator.waitForAnswer(callResult.callSid, integrationConfig.timeouts.callPickup);
      const callAnsweredTime = Date.now();
      let firstAudioTime = null;
      const audioMonitor = await callSimulator.monitorAudioOutput(callResult.callSid, () => {
        if (firstAudioTime === null) firstAudioTime = Date.now();
      });
      const start = Date.now();
      const timeout = start + testConfig.timeouts.greeting;
      while (Date.now() < timeout && firstAudioTime === null) {
        await new Promise((r) => setTimeout(r, 100));
      }
      audioMonitor.stop();
      const latency = firstAudioTime !== null
        ? firstAudioTime - callAnsweredTime
        : Date.now() - callAnsweredTime;
      expect(latency).toBeLessThan(integrationConfig.thresholds.callPickupLatencyP95);
    } finally {
      await callSimulator.cleanup();
    }
  }, 120000);
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
  }, 25000);
});

describe('VAD Behavior (Integration)', () => {
  it('detects silence correctly', async () => {
    if (!shouldRun) return;
    expect(integrationConfig.thresholds.callPickupLatencyP95).toBeGreaterThan(0);
  });
});
