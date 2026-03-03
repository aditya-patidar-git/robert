import User from "../models/User.js";
import { hashPassword } from "../utils/hash.js";
import jwtBlacklistService from "../services/jwtBlacklistService.js";
import { createAuditLog } from "./auditLogController.js";

const OWNER_PROTECTION_MESSAGE = "Only owners can modify or manage other owner accounts.";

function isValidUserId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

function cannotActOnOwner(actorRole, targetUser) {
    return actorRole !== "owner" && targetUser?.role === "owner";
}

// GET /admin/users
export const getUsers = async (req, res) => {
    const { status, role, page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (role) filter.role = role;
    
    // Exclude deleted users from results unless specifically filtering by deleted status
    if (status) {
        filter.status = status;
    } else {
        filter.status = { $ne: 'deleted' };
    }

    const users = await User.find(filter)
        .skip((page - 1) * limit)
        .limit(Number(limit));

    res.json(users);
};

// POST /admin/users
export const createUser = async (req, res) => {
    try {
        const { email, username, role, password } = req.body;
        const actorId = req.user._id;
        const passwordHash = await hashPassword(password);
        const newUser = await User.create({ email, username, role, passwordHash });
        
        // Create audit log
        await createAuditLog({
            actorId,
            action: 'user.create',
            targetType: 'user',
            targetId: newUser._id.toString(),
            diff: { email, username, role, status: newUser.status },
            req
        });
        
        res.status(201).json(newUser);
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// PATCH /admin/users/:id/approve
export const approveUser = async (req, res) => {
    try {
        if (!isValidUserId(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (cannotActOnOwner(req.user.role, user)) {
            return res.status(403).json({ message: OWNER_PROTECTION_MESSAGE });
        }

        const oldStatus = user.status;
        user.status = "active";
        await user.save();

        // Create audit log
        await createAuditLog({
            actorId: req.user._id,
            action: 'user.approve',
            targetType: 'user',
            targetId: user._id.toString(),
            diff: { status: { from: oldStatus, to: 'active' } },
            req
        });
        
        res.json(user);
    } catch (error) {
        console.error("Error approving user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// PATCH /admin/users/:id/block
export const blockUser = async (req, res) => {
    try {
        if (!isValidUserId(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (cannotActOnOwner(req.user.role, user)) {
            return res.status(403).json({ message: OWNER_PROTECTION_MESSAGE });
        }

        const oldStatus = user.status;
        user.status = "suspended";
        await user.save();

        // Revoke all user tokens
        jwtBlacklistService.revokeAllUserTokens(user._id.toString());

        // Create audit log
        await createAuditLog({
            actorId: req.user._id,
            action: 'user.block',
            targetType: 'user',
            targetId: user._id.toString(),
            diff: { status: { from: oldStatus, to: 'suspended' } },
            req
        });
        
        res.json(user);
    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// PATCH /admin/users/:id/exclude
export const excludeUser = async (req, res) => {
    try {
        if (!isValidUserId(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (cannotActOnOwner(req.user.role, user)) {
            return res.status(403).json({ message: OWNER_PROTECTION_MESSAGE });
        }

        const oldStatus = user.status;
        user.status = "suspended";
        await user.save();

        // Revoke all user tokens
        jwtBlacklistService.revokeAllUserTokens(user._id.toString());

        // Create audit log
        await createAuditLog({
            actorId: req.user._id,
            action: 'user.exclude',
            targetType: 'user',
            targetId: user._id.toString(),
            diff: { status: { from: oldStatus, to: 'suspended' } },
            req
        });
        
        res.json(user);
    } catch (error) {
        console.error("Error excluding user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// PUT /admin/users/:id
export const updateUser = async (req, res) => {
    try {
        if (!isValidUserId(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Prevent users from modifying their own status
        const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
        const targetUserId = user._id.toString();
        if (currentUserId === targetUserId && req.body.status !== undefined) {
            return res.status(403).json({ message: "You cannot modify your own status" });
        }
        if (cannotActOnOwner(req.user.role, user)) {
            return res.status(403).json({ message: OWNER_PROTECTION_MESSAGE });
        }

        const { email, username, role, status, password } = req.body;
        
        // Track changes for audit log
        const diff = {};
        const oldValues = {};

        // Update fields if provided
        if (email !== undefined && email !== user.email) {
            oldValues.email = user.email;
            user.email = email;
            diff.email = { from: oldValues.email, to: email };
        }
        if (username !== undefined && username !== user.username) {
            oldValues.username = user.username;
            user.username = username;
            diff.username = { from: oldValues.username, to: username };
        }
        if (role !== undefined && role !== user.role) {
            oldValues.role = user.role;
            user.role = role;
            diff.role = { from: oldValues.role, to: role };
        }
        if (status !== undefined && status !== user.status) {
            oldValues.status = user.status;
            user.status = status;
            diff.status = { from: oldValues.status, to: status };
            
            // If status changed to suspended/deleted, revoke tokens
            if (['suspended', 'deleted'].includes(status)) {
                jwtBlacklistService.revokeAllUserTokens(user._id.toString());
            }
        }
        if (password !== undefined) {
            user.passwordHash = await hashPassword(password);
            diff.password = 'changed'; // Don't log actual password
        }

        await user.save();
        
        // Create audit log if there were changes
        if (Object.keys(diff).length > 0) {
            await createAuditLog({
                actorId: req.user._id,
                action: 'user.update',
                targetType: 'user',
                targetId: user._id.toString(),
                diff,
                req
            });
            if (diff.role) {
                await createAuditLog({
                    actorId: req.user._id,
                    action: 'rbac.role_change',
                    targetType: 'user',
                    targetId: user._id.toString(),
                    diff: { role: diff.role },
                    req
                });
            }
        }
        
        res.json(user);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// DELETE /admin/users/:id
export const deleteUser = async (req, res) => {
    try {
        if (!isValidUserId(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Prevent users from deleting themselves
        const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
        const targetUserId = user._id.toString();
        if (currentUserId === targetUserId) {
            return res.status(403).json({ message: "You cannot delete yourself" });
        }

        // Check for hard delete flag
        const hardDelete = req.query.hard === 'true';
        const actorRole = req.user.role;
        
        // Only owners can perform hard delete
        if (hardDelete && actorRole !== 'owner') {
            return res.status(403).json({ message: "Only owners can perform hard delete" });
        }
        if (cannotActOnOwner(req.user.role, user)) {
            return res.status(403).json({ message: OWNER_PROTECTION_MESSAGE });
        }

        // Revoke all user tokens before deletion
        jwtBlacklistService.revokeAllUserTokens(user._id.toString());
        
        // Create audit log before deletion
        await createAuditLog({
            actorId: req.user._id,
            action: hardDelete ? 'user.delete.hard' : 'user.delete',
            targetType: 'user',
            targetId: user._id.toString(),
            diff: { 
                email: user.email, 
                username: user.username, 
                role: user.role,
                status: user.status 
            },
            req
        });

        if (hardDelete) {
            // Perform hard delete - actually remove from database
            await User.findByIdAndDelete(req.params.id);
        } else {
            // Soft delete - mark as deleted
            user.status = 'deleted';
            await user.save();
        }

        res.json({ message: `User ${hardDelete ? 'permanently deleted' : 'deleted'} successfully` });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
