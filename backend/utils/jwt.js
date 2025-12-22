import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import jwtBlacklistService from "../services/jwtBlacklistService.js";

/**
 * Generate JWT token with jti (JWT ID) claim
 * @param {Object} user - User object
 * @returns {Object} - { token, jti }
 */
export const generateToken = (user) => {
    // Generate unique JWT ID (jti) for token revocation
    const jti = randomUUID();
    
    // Token will be valid for 2 days
    const token = jwt.sign(
        { 
            id: user._id, 
            role: user.role,
            jti: jti  // JWT ID for revocation
        },
        process.env.JWT_SECRET,
        { expiresIn: "2d" }
    );

    // Track token for user (for bulk revocation)
    jwtBlacklistService.trackUserToken(user._id.toString(), jti);

    return { token, jti };
};

/**
 * Verify JWT token and check blacklist
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or revoked
 */
export const verifyToken = (token) => {
    // Verify token signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is revoked
    if (decoded.jti && jwtBlacklistService.isRevoked(decoded.jti)) {
        throw new Error("Token has been revoked");
    }
    
    return decoded;
};

/**
 * Revoke a token by its JWT ID
 * @param {string} jti - JWT ID
 * @param {number} expiry - Token expiry timestamp (optional)
 * @returns {boolean} - True if revoked successfully
 */
export const revokeToken = (jti, expiry) => {
    return jwtBlacklistService.revokeToken(jti, expiry);
};
