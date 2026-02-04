/**
 * Unit tests for Cross-Call Memory (Category A: Test 8 - Memory).
 * Service is imported after DB is ready so Mongoose models bind to the memory server connection.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startMongoMemoryServer, stopMongoMemoryServer } from '../setup/mongodb.js';

let crossCallMemoryService;
let skipSuite = process.env.RUN_MONGO_UNIT_TESTS !== '1';

describe('Cross-Call Memory', () => {
  beforeAll(async () => {
    if (skipSuite) return;
    try {
      await startMongoMemoryServer();
      const mod = await import('../../../robert-agent-service/src/services/crossCallMemoryService.js');
      crossCallMemoryService = mod.default;
    } catch (err) {
      skipSuite = true;
      console.warn('Skipping Cross-Call Memory tests: MongoMemoryServer failed to start:', err.message);
    }
  }, 65000);

  afterAll(async () => {
    if (!skipSuite && crossCallMemoryService) await stopMongoMemoryServer();
  });

  it('stores call summary and retrieves previous calls', async () => {
    if (skipSuite) return;
    const callSid1 = 'call-mem-1-' + Date.now();
    const callerId = '+44123456789';
    await crossCallMemoryService.storeCallSummary(
      callSid1,
      callerId,
      { purpose: 'booking', outcome: 'resolved', nextSteps: '', keyFacts: [] },
      { language: 'en-GB', consentGiven: true }
    );
    const memories = await crossCallMemoryService.retrievePreviousCalls(callerId, 5);
    expect(Array.isArray(memories)).toBe(true);
    expect(memories.length).toBeGreaterThanOrEqual(1);
    const found = memories.find(m => m.callSid === callSid1);
    expect(found).toBeDefined();
    expect(found.summary).toHaveProperty('purpose', 'booking');
    expect(found.summary).toHaveProperty('outcome', 'resolved');
  }, 15000);

  it('recalls preferences across calls', async () => {
    if (skipSuite) return;
    const callSid1 = 'call-pref-1-' + Date.now();
    const callSid2 = 'call-pref-2-' + Date.now();
    const callerId = '+44987654321';
    await crossCallMemoryService.storeCallSummary(
      callSid1,
      callerId,
      { purpose: 'inquiry', outcome: 'resolved', nextSteps: '', keyFacts: ['language: French'] },
      { language: 'fr-FR', consentGiven: true }
    );
    const memories = await crossCallMemoryService.retrievePreviousCalls(callerId, 5);
    const lastCall = memories[0];
    expect(lastCall).toBeDefined();
    expect(lastCall.language).toBe('fr-FR');
    expect(lastCall.keyFacts).toContain('language: French');
    expect(lastCall.summary.outcome).toBe('resolved');
  }, 15000);
});
