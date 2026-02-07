import Allowlist from "../models/Allowlist.js";
import User from "../models/User.js";
import { createAuditLog } from "./auditLogController.js";

/**
 * Get allowlist entries with pagination and filters
 * GET /admin/allowlist
 */
export const getAllowlist = async (req, res) => {
    try {
        const { type, page = 1, limit = 20, search } = req.query;
        const filter = {};

        if (type) {
            filter.type = type;
        }

        if (search) {
            filter.value = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const allowlist = await Allowlist.find(filter)
            .populate('createdBy', 'email username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Allowlist.countDocuments(filter);

        res.json({
            allowlist,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching allowlist:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Add entry to allowlist
 * POST /admin/allowlist
 */
export const addToAllowlist = async (req, res) => {
    try {
        const { type, value, notes } = req.body;
        const actorId = req.user._id;

        if (!type || !value) {
            return res.status(400).json({ message: "Type and value are required" });
        }

        if (!['email', 'domain', 'ip'].includes(type)) {
            return res.status(400).json({ message: "Type must be 'email', 'domain', or 'ip'" });
        }

        let normalizedValue = value.trim();
        if (type !== 'ip') normalizedValue = normalizedValue.toLowerCase();

        if (type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(normalizedValue)) {
                return res.status(400).json({ message: "Invalid email format" });
            }
        } else if (type === 'domain') {
            const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
            if (!domainRegex.test(normalizedValue)) {
                return res.status(400).json({ message: "Invalid domain format" });
            }
        } else if (type === 'ip') {
            const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
            if (!ipv4Regex.test(normalizedValue)) {
                return res.status(400).json({ message: "Invalid IPv4 format" });
            }
            const octets = normalizedValue.split('.').map(Number);
            if (octets.some(o => o < 0 || o > 255)) {
                return res.status(400).json({ message: "Invalid IPv4 octet range" });
            }
        }

        // Check if entry already exists
        const existing = await Allowlist.findOne({ type, value: normalizedValue });
        if (existing) {
            return res.status(400).json({ message: "Entry already exists in allowlist" });
        }

        const allowlistEntry = await Allowlist.create({
            type,
            value: normalizedValue,
            notes,
            createdBy: actorId
        });

        // Create audit log
        await createAuditLog({
            actorId,
            action: 'allowlist.add',
            targetType: 'allowlist',
            targetId: allowlistEntry._id.toString(),
            diff: { type, value: normalizedValue, notes },
            req
        });

        const populated = await Allowlist.findById(allowlistEntry._id)
            .populate('createdBy', 'email username');

        res.status(201).json(populated);
    } catch (error) {
        console.error("Error adding to allowlist:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: "Entry already exists in allowlist" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Remove entry from allowlist
 * DELETE /admin/allowlist/:id
 */
export const removeFromAllowlist = async (req, res) => {
    try {
        const { id } = req.params;
        const actorId = req.user._id;

        const allowlistEntry = await Allowlist.findById(id);
        if (!allowlistEntry) {
            return res.status(404).json({ message: "Allowlist entry not found" });
        }

        // Create audit log before deletion
        await createAuditLog({
            actorId,
            action: 'allowlist.remove',
            targetType: 'allowlist',
            targetId: id,
            diff: { type: allowlistEntry.type, value: allowlistEntry.value },
            req
        });

        await Allowlist.findByIdAndDelete(id);

        res.json({ message: "Allowlist entry removed successfully" });
    } catch (error) {
        console.error("Error removing from allowlist:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Check if email/domain is in allowlist
 * GET /admin/allowlist/check
 */
export const checkAllowlist = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Extract domain from email
        const domain = email.split('@')[1];

        // Check if email is directly allowed
        const emailAllowed = await Allowlist.findOne({ type: 'email', value: email });

        // Check if domain is allowed
        const domainAllowed = await Allowlist.findOne({ type: 'domain', value: domain });

        const isAllowed = !!(emailAllowed || domainAllowed);

        res.json({
            email,
            domain,
            isAllowed,
            matchedEntry: emailAllowed || domainAllowed || null
        });
    } catch (error) {
        console.error("Error checking allowlist:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

