import connectionTestService from './connectionTestService.js';
import credentialEncryptionService from './credentialEncryptionService.js';

/**
 * SIP Config Service
 * Handles SIP configuration validation, testing, and encryption
 */
class SIPConfigService {
  /**
   * Test SIP connection
   * @param {Object} config - SIP configuration
   * @returns {Promise<Object>} Test result
   */
  async testSipConnection(config) {
    return connectionTestService.testConnection('sip', config);
  }

  /**
   * Validate SIP configuration
   * @param {Object} config - SIP configuration
   * @returns {Object} Validation result
   */
  validateSipConfig(config) {
    const errors = [];

    if (config.openaiSipEnabled) {
      if (!config.openaiSipEndpoint) {
        errors.push('OpenAI SIP endpoint is required when SIP is enabled');
      }

      if (config.openaiSipWebhookUrl) {
        try {
          new URL(config.openaiSipWebhookUrl);
        } catch {
          errors.push('OpenAI SIP webhook URL must be a valid URL');
        }
      }

      if (config.twilioSipTrunkSid && !config.twilioSipUsername) {
        errors.push('Twilio SIP username is required when Twilio SIP Trunk SID is provided');
      }

      if (config.twilioSipUsername && !config.twilioSipPassword) {
        errors.push('Twilio SIP password is required when Twilio SIP username is provided');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Encrypt SIP password
   * @param {string} password - Plaintext password
   * @returns {string} Encrypted password
   */
  encryptSipPassword(password) {
    if (!password) {
      return null;
    }

    return credentialEncryptionService.encrypt(password);
  }

  /**
   * Decrypt SIP password (for testing only)
   * @param {string} encryptedPassword - Encrypted password
   * @returns {string} Decrypted password
   */
  decryptSipPassword(encryptedPassword) {
    if (!encryptedPassword) {
      return null;
    }

    return credentialEncryptionService.decrypt(encryptedPassword);
  }

  /**
   * Prepare SIP config for storage (encrypt sensitive fields)
   * @param {Object} config - SIP configuration
   * @returns {Object} Config with encrypted fields
   */
  prepareForStorage(config) {
    const prepared = { ...config };

    // Encrypt password if provided and not already encrypted
    if (prepared.twilioSipPassword && !credentialEncryptionService.isEncrypted(prepared.twilioSipPassword)) {
      prepared.twilioSipPassword = this.encryptSipPassword(prepared.twilioSipPassword);
    }

    return prepared;
  }

  /**
   * Prepare SIP config for display (mask sensitive fields)
   * @param {Object} config - SIP configuration
   * @returns {Object} Config with masked fields
   */
  prepareForDisplay(config) {
    const prepared = { ...config };

    // Mask password
    if (prepared.twilioSipPassword) {
      prepared.twilioSipPassword = credentialEncryptionService.mask(prepared.twilioSipPassword);
    }

    return prepared;
  }
}

export default new SIPConfigService();

