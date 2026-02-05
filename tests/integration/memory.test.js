/**
 * Integration test: Cross-call memory with consent (§14.8).
 * Call 1 set preference; call 2 ask for recall; assert call 2 receives outbound audio.
 * Verbatim consent/recall in transcript would require artefact API or DB.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { integrationConfig } from './config/integrationConfig.js';

const shouldRun = integrationConfig.enabled;

describe('Memory (Integration)', () => {
  beforeAll(() => {
    if (!shouldRun) console.warn('Skipping: set RUN_INTEGRATION_TESTS=1 and Twilio/OpenAI env to run');
  });

  it('call 2 receives outbound audio after preference set in call 1', async () => {
    if (!shouldRun) return;
    const { default: callSimulator } = await import('./helpers/callSimulator.js');
    try {
      const call1 = await callSimulator.initiateCall('integration-memory');
      await callSimulator.waitForAnswer(call1.callSid, integrationConfig.timeouts.callPickup);
      await new Promise((r) => setTimeout(r, 4000));
      await callSimulator.sendAudioInput(call1.callSid, 'Remember I prefer English for future calls.', { language: 'en' });
      await new Promise((r) => setTimeout(r, 3000));
      await callSimulator.hangup(call1.callSid);
      await new Promise((r) => setTimeout(r, 2000));

      const call2 = await callSimulator.initiateCall('integration-memory');
      await callSimulator.waitForAnswer(call2.callSid, integrationConfig.timeouts.callPickup);
      await new Promise((r) => setTimeout(r, 3000));
      await callSimulator.sendAudioInput(call2.callSid, 'Do you remember my preference?', { language: 'en' });
      let outboundCount = 0;
      const monitor = await callSimulator.monitorAudioOutput(call2.callSid, () => { outboundCount += 1; });
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline && outboundCount < 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
      monitor.stop();
      await callSimulator.hangup(call2.callSid);
      expect(outboundCount).toBeGreaterThanOrEqual(1);
    } finally {
      await callSimulator.cleanup();
    }
  }, 60000);
});
