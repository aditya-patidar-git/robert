import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";

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
 * Get audit logs with pagination and filters
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

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const auditLogs = await AuditLog.find(filter)
            .populate('actorId', 'email username role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await AuditLog.countDocuments(filter);

        res.json({
            auditLogs,
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

