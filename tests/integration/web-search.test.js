/**
 * Integration test: Web search with announcement (§14.5).
 * Minimal check: call + time-sensitive question + outbound audio received.
 * Announcement/grounded result would require artefact API.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { integrationConfig } from './config/integrationConfig.js';

const shouldRun = integrationConfig.enabled;

describe('Web search (Integration)', () => {
  beforeAll(() => {
    if (!shouldRun) console.warn('Skipping: set RUN_INTEGRATION_TESTS=1 and Twilio/OpenAI env to run');
  });

  it('completes call and receives outbound audio when asking time-sensitive question', async () => {
    if (!shouldRun) return;
    const { default: callSimulator } = await import('./helpers/callSimulator.js');
    const callResult = await callSimulator.initiateCall('integration-websearch');
    try {
      await callSimulator.waitForAnswer(callResult.callSid, integrationConfig.timeouts.callPickup);
      await new Promise((r) => setTimeout(r, 3000));
      await callSimulator.sendAudioInput(callResult.callSid, "What's the current time in London?", { language: 'en' });
      let outboundCount = 0;
      const monitor = await callSimulator.monitorAudioOutput(callResult.callSid, () => { outboundCount += 1; });
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline && outboundCount < 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
      monitor.stop();
      await callSimulator.hangup(callResult.callSid);
      expect(outboundCount).toBeGreaterThanOrEqual(1);
    } finally {
      await callSimulator.cleanup();
    }
  }, 45000);
});
