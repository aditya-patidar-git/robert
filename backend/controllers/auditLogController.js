import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import auditLogRetentionJob from "../jobs/auditLogRetentionJob.js";
import { escapeRegex } from "../utils/regexUtils.js";

/**
 * Create audit log entry
 * This is a helper function used by other controllers
 * @param {Object} params - Audit log parameters
 * @param {string} params.actorId - User ID who performed the action
 * @param {string} params.action - Action performed (e.g., 'user.create', 'user.block')
 * @param {string} params.targetType - Type of target (e.g., 'user', 'config')
 * @param {string} params.targetId - ID of target (optional)
 * @param {Object} params.diff - Changes made (optional)
 * @param {Object} params.req - Express request object (for IP and userAgent)
 * @param {Object} params.metadata - Additional metadata (optional)
 */
export const createAuditLog = async ({ actorId, action, targetType, targetId, diff, req, metadata }) => {
    try {
        const auditLog = await AuditLog.create({
            actorId,
            action,
            targetType,
            targetId: targetId || null,
            ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
            userAgent: req?.get('user-agent') || 'unknown',
            diff: diff || null,
            metadata: metadata || null
        });

        return auditLog;
    } catch (error) {
        // Don't throw - audit logging should not break the main flow
        console.error("Error creating audit log:", error);
        return null;
    }
};

/**
 * Get audit logs with pagination and filters (MongoDB only)
 * GET /admin/audit
 */
export const getAuditLogs = async (req, res) => {
    try {
        const { 
            actorId, 
            action, 
            targetType, 
            targetId,
            startDate,
            endDate,
            page = 1, 
            limit = 50 
        } = req.query;

        const filter = {};

        // Helper function to check if a value is valid (not undefined/null strings)
        const isValidValue = (value) => {
            return value && value !== 'undefined' && value !== 'null' && value.trim() !== '';
        };

        if (isValidValue(actorId)) {
            filter.actorId = actorId;
        }

        if (isValidValue(action)) {
            filter.action = { $regex: escapeRegex(action), $options: 'i' };
        }

        if (isValidValue(targetType)) {
            filter.targetType = targetType;
        }

        if (isValidValue(targetId)) {
            filter.targetId = targetId;
        }

        // Handle date filters - only add if valid dates are provided
        if (isValidValue(startDate) || isValidValue(endDate)) {
            filter.createdAt = {};
            
            if (isValidValue(startDate)) {
                const start = new Date(startDate);
                if (!isNaN(start.getTime())) {
                    filter.createdAt.$gte = start;
                }
            }
            
            if (isValidValue(endDate)) {
                const end = new Date(endDate);
                if (!isNaN(end.getTime())) {
                    filter.createdAt.$lte = end;
                }
            }
            
            // Remove createdAt filter if no valid dates were added
            if (Object.keys(filter.createdAt).length === 0) {
                delete filter.createdAt;
            }
        }

        // Fetch from MongoDB only (no file-based audit logs)
        const limitNum = Math.min(parseInt(limit, 10) || 50, 500);
        const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitNum;

        const [paginatedLogs, total] = await Promise.all([
            AuditLog.find(filter)
                .populate('actorId', 'email username role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            AuditLog.countDocuments(filter)
        ]);

        res.json({
            auditLogs: paginatedLogs,
            pagination: {
                page: Math.max(parseInt(page, 10) || 1, 1),
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum) || 1
            }
        });
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const MAX_EXPORT_LIMIT = 10000;
const SENSITIVE_KEYS = ['password', 'token', 'credentials', 'apiKey', 'secret', 'passwordHash'];

const sanitizeForExport = (obj) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const lower = k.toLowerCase();
        if (SENSITIVE_KEYS.some(s => lower.includes(s))) continue;
        out[k] = typeof v === 'object' && v !== null && !(v instanceof Date) ? sanitizeForExport(v) : v;
    }
    return out;
};

const buildAuditFilter = (query) => {
    const { actorId, action, targetType, targetId, startDate, endDate } = query;
    const filter = {};
    const isValidValue = (v) => v && v !== 'undefined' && v !== 'null' && (typeof v !== 'string' || v.trim() !== '');
    if (isValidValue(actorId)) filter.actorId = actorId;
    if (isValidValue(action)) filter.action = { $regex: escapeRegex(action), $options: 'i' };
    if (isValidValue(targetType)) filter.targetType = targetType;
    if (isValidValue(targetId)) filter.targetId = targetId;
    if (isValidValue(startDate) || isValidValue(endDate)) {
        filter.createdAt = {};
        if (isValidValue(startDate)) {
            const start = new Date(startDate);
            if (!isNaN(start.getTime())) filter.createdAt.$gte = start;
        }
        if (isValidValue(endDate)) {
            const end = new Date(endDate);
            if (!isNaN(end.getTime())) filter.createdAt.$lte = end;
        }
        if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }
    return { filter, isValidValue };
};

/**
 * Export audit logs as CSV or JSON
 * GET /admin/audit/export?format=csv|json&actorId=&action=&startDate=&endDate=...
 */
export const exportAuditLogs = async (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const { filter, isValidValue } = buildAuditFilter(req.query);

        const allLogs = await AuditLog.find(filter)
            .populate('actorId', 'email username role')
            .sort({ createdAt: -1 })
            .limit(MAX_EXPORT_LIMIT)
            .lean();

        if (format === 'csv') {
            const header = 'timestamp,actor_email,actor_username,action,targetType,targetId,ip,userAgent,diff_summary';
            const escapeCsv = (v) => {
                const s = v == null ? '' : String(v);
                return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const rows = allLogs.map(log => {
                const ts = log.createdAt ? new Date(log.createdAt).toISOString() : '';
                const actor = log.actorId || {};
                const email = actor.email || '';
                const username = actor.username || '';
                const diffSummary = log.diff ? JSON.stringify(sanitizeForExport(log.diff)) : '';
                return [ts, email, username, log.action || '', log.targetType || '', log.targetId || '', log.ip || '', (log.userAgent || '').replace(/\r?\n/g, ' '), diffSummary].map(escapeCsv).join(',');
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
            res.send([header, ...rows].join('\n'));
            return;
        }

        const safeLogs = allLogs.map(log => ({
            ...log,
            diff: sanitizeForExport(log.diff),
            metadata: sanitizeForExport(log.metadata)
        }));
        res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
        res.json(safeLogs);
    } catch (error) {
        console.error("Error exporting audit logs:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Get single audit log entry
 * GET /admin/audit/:id
 */
export const getAuditLog = async (req, res) => {
    try {
        const { id } = req.params;

        const auditLog = await AuditLog.findById(id)
            .populate('actorId', 'email username role');

        if (!auditLog) {
            return res.status(404).json({ message: "Audit log not found" });
        }

        res.json(auditLog);
    } catch (error) {
        console.error("Error fetching audit log:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Run audit log retention job (admin only). Call via cron or manually.
 * POST /admin/audit/retention-run
 */
export const runAuditRetention = async (req, res) => {
    try {
        const results = await auditLogRetentionJob.run();
        res.json({ success: true, results });
    } catch (error) {
        console.error("Error running audit retention:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

