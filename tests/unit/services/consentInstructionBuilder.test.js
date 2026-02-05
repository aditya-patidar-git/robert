/**
 * Unit tests for ConsentInstructionBuilder (Req 14: recording consent, opt-out).
 */

import { describe, it, expect } from '@jest/globals';
import consentInstructionBuilder from '../../../robert-agent-service/src/services/consentInstructionBuilder.js';

const recordingNotice = 'This call may be recorded for quality and training purposes.';
const consentQuestion = 'Do you consent to being recorded?';

describe('ConsentInstructionBuilder', () => {
  it('buildConsentFlowInstructions includes recording notice and opt-out question when consent not given', () => {
    const out = consentInstructionBuilder.buildConsentFlowInstructions({
      consentNotice: recordingNotice,
      consentQuestion,
      languageSelected: true,
      consentGiven: false,
      requireExplicitConsent: true,
      baseInstructions: ''
    });
    expect(out).toContain(recordingNotice);
    expect(out).toContain(consentQuestion);
  });

  it('buildSessionInstructions includes recording notice and consent question', () => {
    const out = consentInstructionBuilder.buildSessionInstructions({
      consentNotice: recordingNotice,
      consentQuestion,
      baseInstructions: ''
    });
    expect(out).toContain(recordingNotice);
    expect(out).toContain(consentQuestion);
  });
});
