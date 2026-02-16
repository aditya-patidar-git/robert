import crypto from 'crypto';
// dotenv is already loaded in server.js, no need to reload here

/**
 * Credential Encryption Service
 * Provides reusable encryption/decryption for sensitive credentials
 * Used by SIP configuration, Payment Gateway configuration, etc.
 */
class CredentialEncryptionService {
  constructor() {
    this.algorithm = null;
    this.key = null;
    this._keyReady = false;
  }

  /**
   * Ensure encryption key is set (lazy init after env is loaded).
   */
  _ensureKey() {
    if (this._keyReady) return;
    this._keyReady = true;
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey || String(encryptionKey).trim() === '') {
      console.warn('⚠️ ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION)');
      this.algorithm = 'aes-256-gcm';
      this.key = crypto.scryptSync('default-key-change-in-production', 'salt', 32);
    } else {
      this.algorithm = 'aes-256-gcm';
      this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    }
  }

  /**
   * Encrypt a plaintext value
   * @param {string} plaintext - Value to encrypt
   * @returns {string} Encrypted value (base64 encoded)
   */
  encrypt(plaintext) {
    if (!plaintext) {
      return null;
    }
    this._ensureKey();

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, authTag, and encrypted data
      const combined = {
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        encrypted: encrypted
      };
      
      return Buffer.from(JSON.stringify(combined)).toString('base64');
    } catch (error) {
      console.error('Error encrypting credential:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt an encrypted value
   * @param {string} encryptedValue - Encrypted value (base64 encoded)
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedValue) {
    if (!encryptedValue) {
      return null;
    }
    this._ensureKey();

    try {
      const combined = JSON.parse(Buffer.from(encryptedValue, 'base64').toString('utf8'));
      
      const iv = Buffer.from(combined.iv, 'base64');
      const authTag = Buffer.from(combined.authTag, 'base64');
      const encrypted = combined.encrypted;
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting credential:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Mask a value for display (never show full value)
   * @param {string} value - Value to mask
   * @param {Object} options - Masking options
   * @param {number} options.showFirst - Number of characters to show at start (default: 4)
   * @param {number} options.showLast - Number of characters to show at end (default: 4)
   * @param {string} options.maskChar - Character to use for masking (default: '*')
   * @returns {string} Masked value
   */
  mask(value, options = {}) {
    if (!value || typeof value !== 'string') {
      return '••••••••';
    }

    const {
      showFirst = 4,
      showLast = 4,
      maskChar = '•'
    } = options;

    if (value.length <= showFirst + showLast) {
      return maskChar.repeat(value.length);
    }

    const first = value.substring(0, showFirst);
    const last = value.substring(value.length - showLast);
    const masked = maskChar.repeat(Math.max(0, value.length - showFirst - showLast));

    return `${first}${masked}${last}`;
  }

  /**
   * Check if a value is encrypted (has the expected structure)
   * @param {string} value - Value to check
   * @returns {boolean} True if value appears to be encrypted
   */
  isEncrypted(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    try {
      const combined = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
      return combined.iv && combined.authTag && combined.encrypted;
    } catch {
      return false;
    }
  }
}

export default new CredentialEncryptionService();

