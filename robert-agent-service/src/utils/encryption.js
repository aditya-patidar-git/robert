import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.saltLength = 64;
    this.tagLength = 16;
    this.masterSecret = process.env.ENCRYPTION_KEY || this.generateMasterSecret();
  }

  /**
   * Generate master secret if not provided
   * @returns {string} Master secret
   */
  generateMasterSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Derive encryption key from master secret
   * @param {string} salt - Salt for key derivation
   * @returns {Buffer} Derived key
   */
  deriveKey(salt) {
    return crypto.pbkdf2Sync(this.masterSecret, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt data
   * @param {string} plaintext - Data to encrypt
   * @returns {string} Encrypted data (base64 encoded)
   */
  encrypt(plaintext) {
    try {
      const salt = crypto.randomBytes(this.saltLength);
      const key = this.deriveKey(salt);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const tag = cipher.getAuthTag();

      // Combine salt, iv, tag, and encrypted data
      const combined = Buffer.concat([
        salt,
        iv,
        tag,
        encrypted
      ]);

      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   * @param {string} ciphertext - Encrypted data (base64 encoded)
   * @returns {string} Decrypted data
   */
  decrypt(ciphertext) {
    try {
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract components
      const salt = combined.slice(0, this.saltLength);
      const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
      const tag = combined.slice(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);

      const key = this.deriveKey(salt);
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash data (one-way)
   * @param {string} data - Data to hash
   * @returns {string} Hashed data (hex)
   */
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export default new EncryptionService();

