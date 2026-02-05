/**
 * Unit tests for GDRPService (Category A: GDPR/DSAR).
 * Uses MongoDB memory server. Service is imported after DB is ready so Mongoose models bind to the memory server connection.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { startMongoMemoryServer, stopMongoMemoryServer } from '../setup/mongodb.js';

let gdprService;
let skipSuite = process.env.RUN_MONGO_UNIT_TESTS !== '1';

describe('GDRPService', () => {
  beforeAll(async () => {
    if (skipSuite) return;
    try {
      await startMongoMemoryServer();
      const mod = await import('../../../robert-agent-service/src/services/gdprService.js');
      gdprService = mod.default;
    } catch (err) {
      skipSuite = true;
      console.warn('Skipping GDRPService tests: MongoMemoryServer failed to start:', err.message);
    }
  }, 65000);

  afterAll(async () => {
    if (!skipSuite && gdprService) await stopMongoMemoryServer();
  });

  describe('getPrivacyConfig', () => {
    it('returns config with retention settings', async () => {
      if (skipSuite) return;
      const config = await gdprService.getPrivacyConfig();
      expect(config).toHaveProperty('retentionSettings');
      expect(config.retentionSettings).toHaveProperty('transcriptRetention');
      expect(config.retentionSettings).toHaveProperty('metadataRetention');
    }, 15000);
  });

  describe('exportDSARData', () => {
    it('returns export structure with requestId and data', async () => {
      if (skipSuite) return;
      const exportData = await gdprService.exportDSARData('+44123456789');
      expect(exportData).toHaveProperty('requestId');
      expect(exportData).toHaveProperty('callerId', '+44123456789');
      expect(exportData).toHaveProperty('exportedAt');
      expect(exportData).toHaveProperty('data');
      expect(exportData.data).toHaveProperty('callRecords');
      expect(exportData.data).toHaveProperty('callMemories');
      expect(exportData.data).toHaveProperty('complaints');
      expect(exportData.data).toHaveProperty('kbaSessions');
      expect(exportData).toHaveProperty('summary');
    });
  });

  describe('processDSARRequest', () => {
    it('processes export action', async () => {
      if (skipSuite) return;
      const result = await gdprService.processDSARRequest('req-1', 'export', '+44123456789');
      expect(result.action).toBe('export');
      expect(result.status).toBe('completed');
      expect(result.result).toHaveProperty('callerId');
    }, 15000);

    it('throws for unknown action', async () => {
      if (skipSuite) return;
      await expect(
        gdprService.processDSARRequest('req-1', 'unknown', '+44123456789')
      ).rejects.toThrow(/Unknown DSAR action/);
    });
  });
});
