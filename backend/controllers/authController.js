import User from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";
import { protect } from "../middleware/authMiddleware.js";
import { createAuditLog } from "./auditLogController.js";

// POST /auth/signup
export const signup = async (req, res) => {
    const { email, username, password } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already registered" });

    const passwordHash = await hashPassword(password);

    await User.create({
        email,
        username,
        passwordHash,
        role: "admin",     // default role for self-registration
        status: "pending"  // needs approval by admin
    });

    res.status(201).json({ message: "User registered successfully. Await admin approval." });
};

// POST /auth/login
export const login = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        // Log failed login attempt (unknown email)
        await createAuditLog({
            actorId: null,
            action: 'auth.login_failed',
            targetType: 'user',
            targetId: null,
            diff: { email, reason: 'unknown_email' },
            req
        });
        return res.status(401).json({ message: "Invalid email or password" });
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
        // Log failed login attempt (wrong password)
        await createAuditLog({
            actorId: user._id,
            action: 'auth.login_failed',
            targetType: 'user',
            targetId: user._id.toString(),
            diff: { reason: 'invalid_password' },
            req
        });
        return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status !== "active") {
        // Log failed login attempt (inactive user)
        await createAuditLog({
            actorId: user._id,
            action: 'auth.login_failed',
            targetType: 'user',
            targetId: user._id.toString(),
            diff: { reason: 'inactive_user', status: user.status },
            req
        });
        return res.status(403).json({ message: `User is not active. Current status: ${user.status}` });
    }

    const { token } = generateToken(user);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Log successful login
    await createAuditLog({
        actorId: user._id,
        action: 'auth.login',
        targetType: 'user',
        targetId: user._id.toString(),
        diff: { email: user.email },
        req
    });

    res.json({
        token,
        user: {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status
        }
    });
};

// GET /auth/me - Get current user profile
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Convert _id to id for consistency
        const userData = {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status,
            mfaEnabled: user.mfaEnabled,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        
        res.json({ user: userData });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// POST /auth/logout - Logout user (client-side token removal)
export const logout = async (req, res) => {
    // Log logout event
    if (req.user) {
        await createAuditLog({
            actorId: req.user._id,
            action: 'auth.logout',
            targetType: 'user',
            targetId: req.user._id.toString(),
            req
        });
    }
    
    // Since we're using JWT tokens, logout is handled client-side
    // In a more secure setup, you might want to maintain a token blacklist
    res.json({ message: "Logged out successfully" });
};

// PUT /auth/me - Update user profile
export const updateProfile = async (req, res) => {
    try {
        const { username, email } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Update fields if provided
        if (username) user.username = username;
        if (email) user.email = email;

        await user.save();

        res.json({ 
            message: "Profile updated successfully",
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// PUT /auth/change-password - Change user password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isValid = await verifyPassword(user.passwordHash, currentPassword);
        if (!isValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);
        user.passwordHash = newPasswordHash;
        await user.save();

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /auth/mfa - Toggle MFA (placeholder for future implementation)
export const toggleMFA = async (req, res) => {
    try {
        const { mfaEnabled } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // For now, just return success (MFA implementation would go here)
        res.json({ 
            message: "MFA settings updated",
            mfaEnabled: mfaEnabled || false
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
