/**
 * Unit tests for KBAService (Category A: CRM tasking - KBA).
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import kbaService from '../../../robert-agent-service/src/services/kbaService.js';
import { conversations } from '../../../robert-agent-service/src/shared/state.js';

describe('KBAService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requiresKBA', () => {
    it('returns true for update_customer', () => {
      expect(kbaService.requiresKBA('update_customer', {})).toBe(true);
    });

    it('returns true for transfer_call', () => {
      expect(kbaService.requiresKBA('transfer_call', {})).toBe(true);
    });

    it('returns false for file_search', () => {
      expect(kbaService.requiresKBA('file_search', {})).toBe(false);
    });

    it('returns false for web_search', () => {
      expect(kbaService.requiresKBA('web_search', {})).toBe(false);
    });
  });

  describe('isKBAVerified', () => {
    it('returns false when no conversation for callSid', () => {
      expect(kbaService.isKBAVerified('nonexistent-call')).toBe(false);
    });

    it('returns false when conversation has no kba', () => {
      const callSid = 'test-no-kba-' + Date.now();
      conversations[callSid] = { transcript: [] };
      expect(kbaService.isKBAVerified(callSid)).toBe(false);
      delete conversations[callSid];
    });

    it('returns false when kba.verified is false', () => {
      const callSid = 'test-kba-false-' + Date.now();
      conversations[callSid] = { kba: { verified: false } };
      expect(kbaService.isKBAVerified(callSid)).toBe(false);
      delete conversations[callSid];
    });

    it('returns true when kba.verified is true', () => {
      const callSid = 'test-kba-true-' + Date.now();
      conversations[callSid] = { kba: { verified: true } };
      expect(kbaService.isKBAVerified(callSid)).toBe(true);
      delete conversations[callSid];
    });
  });
});
