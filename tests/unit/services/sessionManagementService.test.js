/**
 * Unit tests for SessionManagementService (Req 20: session revocation on user status change).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import sessionManagementService from '../../../robert-agent-service/src/services/sessionManagementService.js';
import { conversations } from '../../../robert-agent-service/src/shared/state.js';

describe('SessionManagementService', () => {
  const testSid = 'revoke-test-' + Date.now();

  beforeEach(() => {
    delete conversations[testSid];
  });

  it('deleteSession revokes session and removes it from storage', () => {
    conversations[testSid] = { from: '+441234', transcript: [] };
    const existed = sessionManagementService.deleteSession(testSid);
    expect(existed).toBe(true);
    expect(conversations[testSid]).toBeUndefined();
  });
});
