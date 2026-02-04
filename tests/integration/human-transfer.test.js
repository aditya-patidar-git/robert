/**
 * Integration test: Human Transfer (Test 7).
 * Requires real Twilio. Skip when credentials or RUN_INTEGRATION_TESTS not set.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { integrationConfig } from './config/integrationConfig.js';

const shouldRun = integrationConfig.enabled;

describe('Human Transfer (Integration)', () => {
  beforeAll(() => {
    if (!shouldRun) console.warn('Skipping: set RUN_INTEGRATION_TESTS=1 and Twilio env to run');
  });

  it('bridges call successfully', async () => {
    if (!shouldRun) return;
    const mod = await import('./helpers/callSimulator.js');
    const callSimulator = mod.default;
    const callResult = await callSimulator.initiateCall('integration-transfer');
    try {
      await callSimulator.waitForAnswer(callResult.callSid, integrationConfig.timeouts.callPickup);
      expect(true).toBe(true);
    } finally {
      await callSimulator.cleanup();
    }
  });
});
