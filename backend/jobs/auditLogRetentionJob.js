/**
 * Audit Log Retention Job
 * Deletes audit log entries older than AUDIT_LOG_RETENTION_DAYS (default 365).
 * Run via POST /api/admin/audit/retention-run or external cron.
 */

import AuditLog from '../models/AuditLog.js';

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
    const results = { deleted: 0, errors: [] };

    const deleteResult = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
    results.deleted = deleteResult.deletedCount;

    return results;
  }
}

export default new AuditLogRetentionJob();
