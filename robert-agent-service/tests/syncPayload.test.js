/**
 * Regression test: Sync payload stays under Twilio's 16 KiB Map item limit.
 * Builds a worst-case conversation (two workflows, many steps, large preferences)
 * and asserts buildSyncPayload() result is under 16 KB (and preferably under 10 KB).
 *
 * Run from repo root: node tests/syncPayload.test.js
 */

import assert from 'assert';
import { buildSyncPayload } from '../src/services/distributedStateService.js';

const LIMIT_BYTES = 16 * 1024;
const TARGET_BYTES = 10 * 1024;

function buildWorstCaseConversation() {
  const manySlots = Array.from({ length: 200 }, (_, i) => ({
    rowIndex: i,
    startDate: `2025-03-${String((i % 28) + 1).padStart(2, '0')}`,
    time: `${String(9 + (i % 8)).padStart(2, '0')}:00`,
    location: `Location ${i}`,
    notes: `Slot ${i} with some extra text to simulate real payload`
  }));
  const stepHistory = Array.from({ length: 25 }, (_, i) => ({
    step: i + 1,
    previousStep: i,
    timestamp: new Date(Date.now() - (25 - i) * 60000).toISOString(),
    action: `step_${i}_with_long_description`
  }));
  const knownPreferences = {
    preferredDates: Array.from({ length: 30 }, (_, i) => `2025-04-${String((i % 28) + 1).padStart(2, '0')}`),
    preferredTimes: ['09:00', '10:00', '11:00', '14:00', '15:00'],
    notes: 'A'.repeat(500)
  };
  return {
    _lastUpdated: new Date().toISOString(),
    from: '+15551234567',
    to: '+15559876543',
    workflowContext: 'booking',
    phase: 'booking',
    language: 'en-GB',
    clientVerified: true,
    clientDetails: { name: 'Test User', email: 'test@example.com', phone: '+15551234567' },
    bookingSession: {
      browserSessionId: `browser_CA123_${Date.now()}`,
      currentStep: 6,
      cancellationCurrentStep: 3,
      workflowType: 'existing',
      workflowTypeAsked: true,
      courseType: 'ITM',
      lastActivity: Date.now(),
      cancellationFee: 50,
      knownPreferences,
      sessionDetails: { id: 'sess-1', startDate: '2025-03-15', rowIndex: 0 },
      bookingDetails: { bookingId: 'bk-1', courseDate: '2025-03-15', courseType: 'ITM' },
      stepHistory,
      cancellationStepHistory: stepHistory.map((e, i) => ({ ...e, step: i + 1 }))
    },
    lastAvailabilityCheck: {
      allSlots: manySlots,
      selectedSlot: manySlots[0],
      sessionDetails: { id: 'sess-1', startDate: '2025-03-15', rowIndex: 0 },
      monthYear: '2025-03'
    }
  };
}

const sanitized = buildWorstCaseConversation();
const payload = buildSyncPayload(sanitized);
const aggressivePayload = buildSyncPayload(sanitized, { aggressive: true });

const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
const aggressiveSize = Buffer.byteLength(JSON.stringify(aggressivePayload), 'utf8');

assert(size < LIMIT_BYTES, `Sync payload size ${size} must be < ${LIMIT_BYTES}`);
assert(aggressiveSize < LIMIT_BYTES, `Aggressive Sync payload size ${aggressiveSize} must be < ${LIMIT_BYTES}`);
assert(size < TARGET_BYTES, `Sync payload size ${size} should be < ${TARGET_BYTES} (target)`);

console.log('syncPayload.test.js: OK (payload %d bytes, aggressive %d bytes, limit %d, target %d)', size, aggressiveSize, LIMIT_BYTES, TARGET_BYTES);
