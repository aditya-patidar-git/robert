import connectionTestService from './connectionTestService.js';
import credentialEncryptionService from './credentialEncryptionService.js';

/**
 * Payment Gateway Service
 * Handles payment gateway configuration, testing, and encryption
 */
class PaymentGatewayService {
  /**
   * Test payment gateway connection
   * @param {string} gatewayType - Gateway type ('stripe', 'paypal', 'square')
   * @param {Object} config - Gateway configuration
   * @returns {Promise<Object>} Test result
   */
  async testConnection(gatewayType, config) {
    return connectionTestService.testConnection(gatewayType, config);
  }

  /**
   * Encrypt gateway credentials
   * @param {Object} credentials - Gateway credentials
   * @returns {Object} Encrypted credentials
   */
  encryptCredentials(credentials) {
    const encrypted = { ...credentials };

    // Encrypt sensitive fields based on gateway type
    if (encrypted.stripeSecretKey && !credentialEncryptionService.isEncrypted(encrypted.stripeSecretKey)) {
      encrypted.stripeSecretKey = credentialEncryptionService.encrypt(encrypted.stripeSecretKey);
    }

    if (encrypted.stripeWebhookSecret && !credentialEncryptionService.isEncrypted(encrypted.stripeWebhookSecret)) {
      encrypted.stripeWebhookSecret = credentialEncryptionService.encrypt(encrypted.stripeWebhookSecret);
    }

    if (encrypted.paypalClientId && !credentialEncryptionService.isEncrypted(encrypted.paypalClientId)) {
      encrypted.paypalClientId = credentialEncryptionService.encrypt(encrypted.paypalClientId);
    }

    if (encrypted.paypalClientSecret && !credentialEncryptionService.isEncrypted(encrypted.paypalClientSecret)) {
      encrypted.paypalClientSecret = credentialEncryptionService.encrypt(encrypted.paypalClientSecret);
    }

    if (encrypted.squareApplicationId && !credentialEncryptionService.isEncrypted(encrypted.squareApplicationId)) {
      encrypted.squareApplicationId = credentialEncryptionService.encrypt(encrypted.squareApplicationId);
    }

    if (encrypted.squareAccessToken && !credentialEncryptionService.isEncrypted(encrypted.squareAccessToken)) {
      encrypted.squareAccessToken = credentialEncryptionService.encrypt(encrypted.squareAccessToken);
    }

    return encrypted;
  }

  /**
   * Decrypt gateway credentials (for testing only)
   * @param {Object} encryptedCredentials - Encrypted credentials
   * @returns {Object} Decrypted credentials
   */
  decryptCredentials(encryptedCredentials) {
    const decrypted = { ...encryptedCredentials };

    // Decrypt sensitive fields
    if (decrypted.stripeSecretKey) {
      try {
        decrypted.stripeSecretKey = credentialEncryptionService.decrypt(decrypted.stripeSecretKey);
      } catch {
        // Might not be encrypted yet
      }
    }

    if (decrypted.stripeWebhookSecret) {
      try {
        decrypted.stripeWebhookSecret = credentialEncryptionService.decrypt(decrypted.stripeWebhookSecret);
      } catch {
        // Might not be encrypted yet
      }
    }

    if (decrypted.paypalClientId) {
      try {
        decrypted.paypalClientId = credentialEncryptionService.decrypt(decrypted.paypalClientId);
      } catch {
        // Might not be encrypted yet
      }
    }

    if (decrypted.paypalClientSecret) {
      try {
        decrypted.paypalClientSecret = credentialEncryptionService.decrypt(decrypted.paypalClientSecret);
      } catch {
        // Might not be encrypted yet
      }
    }

    if (decrypted.squareApplicationId) {
      try {
        decrypted.squareApplicationId = credentialEncryptionService.decrypt(decrypted.squareApplicationId);
      } catch {
        // Might not be encrypted yet
      }
    }

    if (decrypted.squareAccessToken) {
      try {
        decrypted.squareAccessToken = credentialEncryptionService.decrypt(decrypted.squareAccessToken);
      } catch {
        // Might not be encrypted yet
      }
    }

    return decrypted;
  }

  /**
   * Prepare config for storage (encrypt sensitive fields)
   * @param {Object} config - Payment gateway configuration
   * @returns {Object} Config with encrypted fields
   */
  prepareForStorage(config) {
    const prepared = { ...config };

    if (prepared.credentials) {
      prepared.credentials = this.encryptCredentials(prepared.credentials);
    }

    return prepared;
  }

  /**
   * Prepare config for display (mask sensitive fields)
   * @param {Object} config - Payment gateway configuration
   * @returns {Object} Config with masked fields
   */
  prepareForDisplay(config) {
    const prepared = { ...config };

    if (prepared.credentials) {
      const masked = { ...prepared.credentials };

      if (masked.stripeSecretKey) {
        masked.stripeSecretKey = credentialEncryptionService.mask(masked.stripeSecretKey);
      }

      if (masked.stripeWebhookSecret) {
        masked.stripeWebhookSecret = credentialEncryptionService.mask(masked.stripeWebhookSecret);
      }

      if (masked.paypalClientId) {
        masked.paypalClientId = credentialEncryptionService.mask(masked.paypalClientId);
      }

      if (masked.paypalClientSecret) {
        masked.paypalClientSecret = credentialEncryptionService.mask(masked.paypalClientSecret);
      }

      if (masked.squareApplicationId) {
        masked.squareApplicationId = credentialEncryptionService.mask(masked.squareApplicationId);
      }

      if (masked.squareAccessToken) {
        masked.squareAccessToken = credentialEncryptionService.mask(masked.squareAccessToken);
      }

      prepared.credentials = masked;
    }

    return prepared;
  }

  /**
   * Get supported gateways
   * @returns {Array} List of supported gateways
   */
  getSupportedGateways() {
    return [
      {
        id: 'stripe',
        name: 'Stripe',
        description: 'Stripe payment processing',
        features: ['Credit cards', 'Debit cards', 'Bank transfers', 'Digital wallets']
      },
      {
        id: 'paypal',
        name: 'PayPal',
        description: 'PayPal payment processing',
        features: ['PayPal accounts', 'Credit cards', 'Debit cards']
      },
      {
        id: 'square',
        name: 'Square',
        description: 'Square payment processing',
        features: ['Credit cards', 'Debit cards', 'Digital wallets']
      }
    ];
  }
}

export default new PaymentGatewayService();

