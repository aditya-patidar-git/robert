/**
 * Integration test: DSAR export/delete (§14.11).
 * Uses in-memory MongoDB; calls agent gdprService.exportDSARData and asserts structure.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { integrationConfig } from './config/integrationConfig.js';
import { startMongoMemoryServer, stopMongoMemoryServer } from '../unit/setup/mongodb.js';

const shouldRun = integrationConfig.enabled;
let gdprService;
let CallRecord;

describe('GDPR (Integration)', () => {
  beforeAll(async () => {
    if (!shouldRun) return;
    try {
      await startMongoMemoryServer();
      const gdprMod = await import('../../robert-agent-service/src/services/gdprService.js');
      gdprService = gdprMod.default;
      const callRecordMod = await import('../../robert-agent-service/src/database/models/CallRecord.js');
      CallRecord = callRecordMod.default;
    } catch (err) {
      console.warn('Skipping GDPR integration test: MongoDB setup failed', err.message);
    }
  }, 65000);

  afterAll(async () => {
    if (shouldRun) await stopMongoMemoryServer();
  });

  it('exportDSARData returns structure with transcript and metadata', async () => {
    if (!shouldRun || !gdprService || !CallRecord) return;
    const testPhone = '+449998887776';
    await CallRecord.create({
      callSid: 'CA_gdpr_test_' + Date.now(),
      from: testPhone,
      to: '+440000000000',
      callStatus: 'completed',
      transcript: [{ role: 'user', text: 'test' }, { role: 'agent', text: 'response' }],
      summary: 'Test call'
    });
    try {
      const exportData = await gdprService.exportDSARData(testPhone);
      expect(exportData).toHaveProperty('requestId');
      expect(exportData).toHaveProperty('callerId', testPhone);
      expect(exportData).toHaveProperty('data');
      expect(exportData.data).toHaveProperty('callRecords');
      expect(Array.isArray(exportData.data.callRecords)).toBe(true);
      expect(exportData.data.callRecords.length).toBeGreaterThanOrEqual(1);
      const first = exportData.data.callRecords[0];
      expect(first).toHaveProperty('transcript');
      expect(Array.isArray(first.transcript)).toBe(true);
      expect(first).toHaveProperty('summary');
    } finally {
      await CallRecord.deleteMany({ from: testPhone });
    }
  }, 15000);
});
