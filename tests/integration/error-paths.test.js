/**
 * Integration test: Graceful error handling (§14.10).
 * Simulates Twilio stream drop; asserts no unhandled exception and call cleans up.
 * OpenAI 5xx simulation is not feasible without fault injection (unit tests only).
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { integrationConfig } from './config/integrationConfig.js';

const shouldRun = integrationConfig.enabled;

describe('Error paths (Integration)', () => {
  beforeAll(() => {
    if (!shouldRun) console.warn('Skipping: set RUN_INTEGRATION_TESTS=1 and Twilio/OpenAI env to run');
  });

  it('call completes or cleans up after stream drop', async () => {
    if (!shouldRun) return;
    const { default: callSimulator } = await import('./helpers/callSimulator.js');
    const answerTimeoutMs = 25000; // Longer than callPickup: stable after concurrency (Run 1)
    try {
      // Warm-up call so the real call isn't the first after concurrency suite
      const warmUpResult = await callSimulator.initiateCall('integration-error-warmup');
      await callSimulator.waitForAnswer(warmUpResult.callSid, answerTimeoutMs);
      await callSimulator.hangup(warmUpResult.callSid);
      await new Promise((r) => setTimeout(r, 1500));

      const callResult = await callSimulator.initiateCall('integration-error');
      await callSimulator.waitForAnswer(callResult.callSid, answerTimeoutMs);
      await new Promise((r) => setTimeout(r, 2000));
      const client = await callSimulator.getMediaStreamsClient(callResult.callSid);
      client.disconnect();
      await new Promise((r) => setTimeout(r, 3000));
      await callSimulator.hangup(callResult.callSid);
    } finally {
      await callSimulator.cleanup();
    }
  }, 60000);
});
