import User from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";
import { protect } from "../middleware/authMiddleware.js";
import { createAuditLog } from "./auditLogController.js";
import { createOtpForEmail, getAndClearOtp, clearOtp } from "../services/otpStore.js";
import emailService from "../services/emailService.js";

// POST /auth/send-otp - Send OTP to email for MFA login
export const sendOtp = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status !== "active") {
        return res.status(403).json({ message: "User is not active" });
    }

    if (!user.mfaEnabled) {
        return res.status(400).json({ message: "Two-factor authentication is not enabled for this account" });
    }

    const otp = createOtpForEmail(user.email, 'mfa');
    const result = await emailService.sendLoginOtp(user.email, otp);
    if (!result.success) {
        return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }

    res.json({ message: "OTP sent to your email" });
};

// POST /auth/invalidate-login-otp - Invalidate MFA OTP (e.g. on page refresh)
export const invalidateLoginOtp = async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
    }
    clearOtp(email.trim().toLowerCase(), 'mfa');
    res.json({ message: "OK" });
};

// POST /auth/send-signup-otp - Send OTP for email verification during signup
export const sendSignupOtp = async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
    }
    const otp = createOtpForEmail(normalizedEmail, 'signup');
    const result = await emailService.sendSignupOtp(normalizedEmail, otp);
    if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code. Please try again." });
    }
    res.json({ message: "Verification code sent to your email" });
};

// POST /auth/signup - Create user after OTP verification
export const signup = async (req, res) => {
    const { email, username, password, otp } = req.body;

    if (!email || !username || !password) {
        return res.status(400).json({ message: "Email, username and password are required" });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(400).json({ message: "Email already registered" });

    if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
        return res.status(400).json({ message: "Verification code is required" });
    }
    const storedOtp = getAndClearOtp(normalizedEmail, 'signup');
    if (!storedOtp || storedOtp !== otp.trim()) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    const passwordHash = await hashPassword(password);

    await User.create({
        email: normalizedEmail,
        username: username.trim(),
        passwordHash,
        role: "admin",
        status: "active"
    });

    res.status(201).json({ message: "User registered successfully. You can now log in." });
};

// POST /auth/login
export const login = async (req, res) => {
    const { email, password } = req.body;
    console.log('[LOGIN TRACE] authController.login: entered', { email: req.body?.email, hasPassword: !!req.body?.password });

    const user = await User.findOne({ email });
    console.log('[LOGIN TRACE] authController.login: user lookup', { found: !!user, email: req.body?.email });
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
        console.log('[LOGIN TRACE] authController.login: returning 401 (user not found)');
        return res.status(401).json({ message: "Invalid email or password" });
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    console.log('[LOGIN TRACE] authController.login: password check', { isValid });
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
        console.log('[LOGIN TRACE] authController.login: returning 401 (invalid password)');
        return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status === "pending") {
        await createAuditLog({
            actorId: user._id,
            action: 'auth.login_failed',
            targetType: 'user',
            targetId: user._id.toString(),
            diff: { reason: 'pending_verification_required', status: user.status },
            req
        });
        return res.status(403).json({ needEmailVerification: true, message: "Verify your email to activate your account." });
    }
    if (user.status !== "active") {
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

    if (user.mfaEnabled) {
        const { otp } = req.body;
        if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
            return res.status(403).json({ mfaRequired: true, message: "OTP required" });
        }
        const storedOtp = getAndClearOtp(user.email, 'mfa');
        if (!storedOtp || storedOtp !== otp.trim()) {
            await createAuditLog({
                actorId: user._id,
                action: 'auth.login_failed',
                targetType: 'user',
                targetId: user._id.toString(),
                diff: { reason: 'invalid_or_expired_otp' },
                req
            });
            return res.status(401).json({ message: "Invalid or expired OTP" });
        }
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

    console.log('[LOGIN TRACE] authController.login: success, sending token');
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

// POST /auth/send-pending-verification-otp - Send OTP to pending user for email verification
export const sendPendingVerificationOtp = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    if (user.status !== "pending") {
        return res.status(403).json({ message: "Account is not pending verification" });
    }
    const otp = createOtpForEmail(normalizedEmail, 'pending_verification');
    const result = await emailService.sendPendingVerificationOtp(normalizedEmail, otp);
    if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code. Please try again." });
    }
    res.json({ message: "Verification code sent to your email" });
};

// POST /auth/verify-pending-user - Verify OTP and activate pending user, return token
export const verifyPendingUser = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
    }
    if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
        return res.status(400).json({ message: "Verification code is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const storedOtp = getAndClearOtp(normalizedEmail, 'pending_verification');
    if (!storedOtp || storedOtp !== otp.trim()) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }
    if (user.status !== "pending") {
        return res.status(400).json({ message: "Account is already active" });
    }
    user.status = "active";
    user.lastLoginAt = new Date();
    await user.save();
    const { token } = generateToken(user);
    await createAuditLog({
        actorId: user._id,
        action: 'auth.login',
        targetType: 'user',
        targetId: user._id.toString(),
        diff: { email: user.email, pending_verified: true },
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

// PATCH /auth/mfa - Toggle MFA
export const toggleMFA = async (req, res) => {
    try {
        const { mfaEnabled } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.mfaEnabled = mfaEnabled === true;
        await user.save();

        res.json({
            message: "MFA settings updated",
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                status: user.status,
                mfaEnabled: user.mfaEnabled
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
