/**
 * Unit tests for SummaryService (Req 17: post-call structured record).
 */

import { describe, it, expect } from '@jest/globals';
import summaryService from '../../../robert-agent-service/src/services/summaryService.js';

describe('SummaryService', () => {
  it('produces structured call record with outcome and keyFacts for empty transcript', async () => {
    const result = await summaryService.generateCallSummary([], { callSid: 'test' });
    expect(result).toHaveProperty('purpose');
    expect(result).toHaveProperty('outcome');
    expect(result).toHaveProperty('nextSteps');
    expect(result).toHaveProperty('keyFacts');
    expect(Array.isArray(result.keyFacts)).toBe(true);
    const validOutcomes = ['resolved', 'escalated', 'needs-follow-up', 'voicemail', 'error'];
    expect(validOutcomes).toContain(result.outcome);
  });

  it('validateOutcome returns only allowed outcome values', () => {
    expect(summaryService.validateOutcome('resolved')).toBe('resolved');
    expect(summaryService.validateOutcome('voicemail')).toBe('voicemail');
    expect(summaryService.validateOutcome('invalid')).toBe('resolved');
  });
});
