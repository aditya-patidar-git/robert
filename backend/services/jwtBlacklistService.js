/**
 * JWT Blacklist Service
 * Manages revoked JWT tokens to support session revocation
 * Uses in-memory storage with TTL, with option for Redis in distributed deployments
 */

class JWTBlacklistService {
  constructor() {
    // In-memory Set for revoked token IDs (jti)
    // Map<jti, expiryTimestamp>
    this.revokedTokens = new Map();
    
    // Cleanup interval (runs every 5 minutes)
    this.cleanupInterval = null;
    this.cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Revoke a token by its JWT ID (jti)
   * @param {string} jti - JWT ID (token identifier)
   * @param {number} expiry - Token expiry timestamp (milliseconds)
   */
  revokeToken(jti, expiry) {
    if (!jti) {
      console.warn('JWTBlacklistService: Attempted to revoke token without jti');
      return false;
    }

    const expiryTime = expiry || Date.now() + (2 * 24 * 60 * 60 * 1000); // Default 2 days from now
    this.revokedTokens.set(jti, expiryTime);
    
    console.log(`🔒 Token revoked: ${jti.substring(0, 8)}... (expires: ${new Date(expiryTime).toISOString()})`);
    return true;
  }

  /**
   * Check if a token is revoked
   * @param {string} jti - JWT ID (token identifier)
   * @returns {boolean} - True if token is revoked
   */
  isRevoked(jti) {
    if (!jti) {
      return false;
    }

    const expiry = this.revokedTokens.get(jti);
    
    // If not in blacklist, token is not revoked
    if (!expiry) {
      return false;
    }

    // If expired, remove from blacklist and consider not revoked
    if (Date.now() > expiry) {
      this.revokedTokens.delete(jti);
      return false;
    }

    // Token is revoked and not expired
    return true;
  }

  /**
   * Revoke all tokens for a user
   * Note: This requires tracking user->jti mapping, which we'll do via a separate map
   * For now, we'll store user->jti mappings when tokens are created
   * @param {string} userId - User ID
   */
  revokeAllUserTokens(userId) {
    // In a production system with Redis, we'd query by userId
    // For in-memory, we track user->jti mappings
    if (!this.userTokenMap) {
      this.userTokenMap = new Map(); // Map<userId, Set<jti>>
    }

    const userTokens = this.userTokenMap.get(userId);
    if (userTokens && userTokens.size > 0) {
      let revokedCount = 0;
      userTokens.forEach(jti => {
        // Get token expiry from revokedTokens or use default
        const existingExpiry = this.revokedTokens.get(jti);
        if (existingExpiry) {
          // Already revoked, skip
          return;
        }
        
        // Revoke with default 2-day expiry
        const expiry = Date.now() + (2 * 24 * 60 * 60 * 1000);
        this.revokedTokens.set(jti, expiry);
        revokedCount++;
      });
      
      // Clear user's token set
      this.userTokenMap.delete(userId);
      
      console.log(`🔒 Revoked ${revokedCount} tokens for user: ${userId}`);
      return revokedCount;
    }

    console.log(`ℹ️ No tokens found to revoke for user: ${userId}`);
    return 0;
  }

  /**
   * Track a token for a user (called when token is issued)
   * @param {string} userId - User ID
   * @param {string} jti - JWT ID
   */
  trackUserToken(userId, jti) {
    if (!this.userTokenMap) {
      this.userTokenMap = new Map();
    }

    if (!this.userTokenMap.has(userId)) {
      this.userTokenMap.set(userId, new Set());
    }

    this.userTokenMap.get(userId).add(jti);
  }

  /**
   * Cleanup expired tokens from blacklist
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [jti, expiry] of this.revokedTokens.entries()) {
      if (now > expiry) {
        this.revokedTokens.delete(jti);
        cleanedCount++;
      }
    }

    // Also cleanup user token mappings for users with no active tokens
    if (this.userTokenMap) {
      for (const [userId, tokenSet] of this.userTokenMap.entries()) {
        // Remove expired tokens from user's set
        for (const jti of tokenSet) {
          if (!this.revokedTokens.has(jti) || (this.revokedTokens.get(jti) && now > this.revokedTokens.get(jti))) {
            tokenSet.delete(jti);
          }
        }
        
        // If user has no tokens left, remove from map
        if (tokenSet.size === 0) {
          this.userTokenMap.delete(userId);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired revoked tokens`);
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    console.log(`🧹 JWT blacklist cleanup started (interval: ${this.cleanupIntervalMs / 1000}s)`);
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get statistics about blacklist
   * @returns {Object} - Statistics
   */
  getStats() {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;

    for (const expiry of this.revokedTokens.values()) {
      if (now > expiry) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }

    return {
      activeRevokedTokens: activeCount,
      expiredRevokedTokens: expiredCount,
      totalTrackedUsers: this.userTokenMap ? this.userTokenMap.size : 0
    };
  }
}

// Export singleton instance
export default new JWTBlacklistService();

