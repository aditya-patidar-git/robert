import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import fs from 'fs';
import path from 'path';

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
 * Read file-based GDPR audit logs for backward compatibility
 * @param {Object} filters - Date and event type filters
 * @returns {Array} File-based audit logs
 */
const readFileBasedAuditLogs = (filters = {}) => {
    const auditLogPath = './audit-logs';
    const logs = [];
    
    try {
        if (!fs.existsSync(auditLogPath)) {
            return logs;
        }

        const files = fs.readdirSync(auditLogPath)
            .filter(f => f.startsWith('audit_') && f.endsWith('.json'));

        for (const file of files) {
            try {
                // Extract date from filename (audit_YYYY-MM-DD.json)
                const dateMatch = file.match(/audit_(\d{4}-\d{2}-\d{2})\.json/);
                if (!dateMatch) continue;

                const fileDate = new Date(dateMatch[1]);
                
                // Apply date filters at file level for efficiency
                if (filters.startDate && fileDate < new Date(filters.startDate)) continue;
                if (filters.endDate && fileDate > new Date(filters.endDate)) continue;

                const filePath = path.join(auditLogPath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const fileLogs = JSON.parse(content);

                for (const log of fileLogs) {
                    // Transform file-based log to match MongoDB schema
                    logs.push({
                        _id: log.id,
                        action: log.eventType,
                        eventType: log.eventType,
                        eventData: log.eventData,
                        targetType: mapEventTypeToTargetType(log.eventType),
                        actorType: 'system',
                        system: log.system || 'robert-ai',
                        createdAt: new Date(log.timestamp),
                        metadata: { source: 'file-based', fileLogId: log.id }
                    });
                }
            } catch (fileError) {
                console.error(`Error reading audit log file ${file}:`, fileError);
            }
        }
    } catch (error) {
        console.error('Error reading file-based audit logs:', error);
    }

    return logs;
};

/**
 * Map event type to target type for consistent filtering
 */
const mapEventTypeToTargetType = (eventType) => {
    const mapping = {
        'consent_recorded': 'consent',
        'dsar_created': 'dsar',
        'dsar_processed': 'dsar',
        'data_exported': 'gdpr',
        'data_deleted': 'gdpr',
        'retention_cleanup': 'retention',
        'pia_generated': 'compliance',
        'breach_reported': 'breach',
        'compliance_report_generated': 'compliance'
    };
    return mapping[eventType] || 'gdpr';
};

/**
 * Get audit logs with pagination and filters
 * Merges MongoDB and file-based logs for complete audit trail
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
            filter.action = { $regex: action, $options: 'i' };
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

        // Fetch from MongoDB
        const mongoLogs = await AuditLog.find(filter)
            .populate('actorId', 'email username role')
            .sort({ createdAt: -1 })
            .lean();

        // Get IDs of logs that were already synced from files to MongoDB
        const syncedFileLogIds = new Set(
            mongoLogs
                .filter(log => log.metadata?.fileLogId)
                .map(log => log.metadata.fileLogId)
        );

        // Fetch file-based logs (for historical GDPR events not yet in MongoDB)
        let fileLogs = readFileBasedAuditLogs({
            startDate: isValidValue(startDate) ? startDate : null,
            endDate: isValidValue(endDate) ? endDate : null
        });

        // Filter file logs by action if specified
        if (isValidValue(action)) {
            const actionRegex = new RegExp(action, 'i');
            fileLogs = fileLogs.filter(log => actionRegex.test(log.action));
        }

        // Remove duplicates (logs that exist in both file and MongoDB)
        fileLogs = fileLogs.filter(log => !syncedFileLogIds.has(log._id));

        // Merge and sort all logs by date descending
        const allLogs = [...mongoLogs, ...fileLogs].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        // Apply pagination
        const total = allLogs.length;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedLogs = allLogs.slice(skip, skip + parseInt(limit));

        res.json({
            auditLogs: paginatedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching audit logs:", error);
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

