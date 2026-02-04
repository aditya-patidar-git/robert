/**
 * Integration tests: multilingual / language switch (Req 13).
 * Asserts greeting includes language question; optionally exercises language response.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { integrationConfig } from './config/integrationConfig.js';
import consentInstructionBuilder from '../../robert-agent-service/src/services/consentInstructionBuilder.js';

const shouldRun = integrationConfig.enabled;

describe('Language switch (Integration)', () => {
  beforeAll(() => {
    if (!shouldRun) console.warn('Skipping: set RUN_INTEGRATION_TESTS=1 and Twilio/OpenAI env to run');
  });

  it('greeting instructions include language question', () => {
    const out = consentInstructionBuilder.buildSessionInstructions({
      consentNotice: 'This call may be recorded.',
      consentQuestion: 'Do you consent?',
      baseInstructions: ''
    });
    expect(out.toLowerCase()).toMatch(/language|what language/);
  });

  it('call connects and accepts language response', async () => {
    if (!shouldRun) return;
    const { default: callSimulator } = await import('./helpers/callSimulator.js');
    const { default: testConfig } = await import('./helpers/config/testConfig.js');
    const callResult = await callSimulator.initiateCall('integration-language');
    await callSimulator.waitForAnswer(callResult.callSid, testConfig.timeouts.callPickup);
    await callSimulator.sendAudioInput(callResult.callSid, 'English', { language: 'en' });
    await new Promise(r => setTimeout(r, 2000));
    await callSimulator.hangup(callResult.callSid);
  });
});
