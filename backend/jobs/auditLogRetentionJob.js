/**
 * Audit Log Retention Job
 * Deletes audit log entries older than AUDIT_LOG_RETENTION_DAYS (default 365).
 * Run via POST /api/admin/audit/retention-run or external cron.
 */

import AuditLog from '../models/AuditLog.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_RETENTION_DAYS = 365;

class AuditLogRetentionJob {
  constructor() {
    this.name = 'audit-log-retention';
    this.schedule = '0 3 * * *';
  }

  getRetentionDays() {
    const env = process.env.AUDIT_LOG_RETENTION_DAYS;
    const n = parseInt(env, 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_DAYS;
  }

  async run() {
    const retentionDays = this.getRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const results = { deleted: 0, fileDeleted: 0, errors: [] };

    const deleteResult = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
    results.deleted = deleteResult.deletedCount;

    const auditLogPath = path.join(process.cwd(), 'audit-logs');
    if (fs.existsSync(auditLogPath)) {
      const files = fs.readdirSync(auditLogPath).filter(f => f.startsWith('audit_') && f.endsWith('.json'));
      for (const file of files) {
        try {
          const dateMatch = file.match(/audit_(\d{4}-\d{2}-\d{2})\.json/);
          if (!dateMatch) continue;
          const fileDate = new Date(dateMatch[1]);
          if (fileDate < cutoff) {
            fs.unlinkSync(path.join(auditLogPath, file));
            results.fileDeleted++;
          }
        } catch (err) {
          results.errors.push(`File ${file}: ${err.message}`);
        }
      }
    }

    return results;
  }
}

export default new AuditLogRetentionJob();
