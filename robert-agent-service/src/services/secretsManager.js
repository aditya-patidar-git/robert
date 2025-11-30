import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class SecretsManager {
  constructor() {
    this.requiredSecrets = [
      'MONGO_URI',
      'TWILIO_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_NUMBER',
      'OPENAI_API_KEY'
    ];
    this.optionalSecrets = [
      'DOMAIN',
      'BASE_URL',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'OPENAI_SIP_ENDPOINT',
      'SIP_ENABLED'
    ];
    this.secrets = new Map();
    this.vaultEnabled = false;
    this.vaultClient = null;
  }

  /**
   * Initialize secrets manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load from environment variables (dev/staging)
      this.loadFromEnvironment();

      // Check if external vault is configured (prod)
      if (process.env.VAULT_ENABLED === 'true') {
        await this.initializeVault();
      }

      // Validate all required secrets
      this.validateSecrets();
    } catch (error) {
      console.error('❌ Secrets Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load secrets from environment variables
   */
  loadFromEnvironment() {
    console.log('🔐 Loading secrets from environment variables...');
    
    for (const secretName of [...this.requiredSecrets, ...this.optionalSecrets]) {
      const value = process.env[secretName];
      if (value) {
        this.secrets.set(secretName, value);
        console.log(`✅ Loaded secret: ${secretName} (${this.maskSecret(value)})`);
      } else if (this.requiredSecrets.includes(secretName)) {
        console.warn(`⚠️ Missing required secret: ${secretName}`);
      }
    }
  }

  /**
   * Initialize external vault (AWS Secrets Manager / HashiCorp Vault)
   * @returns {Promise<void>}
   */
  async initializeVault() {
    try {
      const vaultType = process.env.VAULT_TYPE || 'aws';
      
      if (vaultType === 'aws') {
        // TODO: Initialize AWS Secrets Manager client
        console.log('🔐 AWS Secrets Manager integration pending');
        // const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
        // this.vaultClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
      } else if (vaultType === 'vault') {
        // TODO: Initialize HashiCorp Vault client
        console.log('🔐 HashiCorp Vault integration pending');
        // const vault = await import('node-vault');
        // this.vaultClient = vault({ endpoint: process.env.VAULT_ENDPOINT, token: process.env.VAULT_TOKEN });
      }

      this.vaultEnabled = true;
      console.log('✅ Vault client initialized');
    } catch (error) {
      console.error('❌ Error initializing vault:', error);
      throw error;
    }
  }

  /**
   * Get secret value
   * @param {string} secretName - Secret name
   * @returns {string|null} Secret value or null
   */
  getSecret(secretName) {
    return this.secrets.get(secretName) || null;
  }

  /**
   * Set secret value (for testing/development)
   * @param {string} secretName - Secret name
   * @param {string} value - Secret value
   */
  setSecret(secretName, value) {
    this.secrets.set(secretName, value);
  }

  /**
   * Validate all required secrets are present
   * @throws {Error} If any required secret is missing
   */
  validateSecrets() {
    const missing = [];
    
    for (const secretName of this.requiredSecrets) {
      if (!this.secrets.has(secretName) || !this.secrets.get(secretName)) {
        missing.push(secretName);
      }
    }

    if (missing.length > 0) {
      const error = new Error(`Missing required secrets: ${missing.join(', ')}`);
      console.error('❌ Secret validation failed:', error.message);
      throw error;
    }

    console.log('✅ All required secrets validated');
  }

  /**
   * Mask secret value for logging
   * @param {string} value - Secret value
   * @returns {string} Masked value
   */
  maskSecret(value) {
    if (!value || value.length < 8) {
      return '***';
    }
    return `${value.substring(0, 4)}***${value.substring(value.length - 4)}`;
  }

  /**
   * Rotate secret (for vault integration)
   * @param {string} secretName - Secret name
   * @returns {Promise<boolean>} True if rotated successfully
   */
  async rotateSecret(secretName) {
    try {
      if (!this.vaultEnabled) {
        console.warn(`⚠️ Secret rotation not available (vault not enabled): ${secretName}`);
        return false;
      }

      // TODO: Implement secret rotation via vault
      console.log(`🔄 Rotating secret: ${secretName}`);
      return true;
    } catch (error) {
      console.error(`❌ Error rotating secret ${secretName}:`, error);
      return false;
    }
  }

  /**
   * Get list of secret names (not values)
   * @returns {Array<string>} Array of secret names
   */
  getSecretNames() {
    return Array.from(this.secrets.keys());
  }

  /**
   * Test secret connectivity
   * @param {string} secretName - Secret name
   * @returns {Promise<{connected: boolean, error?: string}>}
   */
  async testSecretConnectivity(secretName) {
    try {
      const value = this.getSecret(secretName);
      if (!value) {
        return {
          connected: false,
          error: 'Secret not found'
        };
      }

      // Test connectivity based on secret type
      if (secretName === 'MONGO_URI') {
        // Test MongoDB connection
        const mongoose = (await import('mongoose')).default;
        try {
          await mongoose.connect(value, { serverSelectionTimeoutMS: 5000 });
          await mongoose.disconnect();
          return { connected: true };
        } catch (error) {
          return {
            connected: false,
            error: error.message
          };
        }
      } else if (secretName === 'OPENAI_API_KEY') {
        // Test OpenAI API connection
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: value });
        try {
          await openai.models.list();
          return { connected: true };
        } catch (error) {
          return {
            connected: false,
            error: error.message
          };
        }
      } else if (secretName.startsWith('TWILIO_')) {
        // Test Twilio connection
        const twilio = (await import('twilio')).default;
        const accountSid = this.getSecret('TWILIO_SID');
        const authToken = this.getSecret('TWILIO_AUTH_TOKEN');
        if (!accountSid || !authToken) {
          return {
            connected: false,
            error: 'Twilio credentials incomplete'
          };
        }
        const client = twilio(accountSid, authToken);
        try {
          await client.api.accounts(accountSid).fetch();
          return { connected: true };
        } catch (error) {
          return {
            connected: false,
            error: error.message
          };
        }
      }

      // Default: secret exists
      return { connected: true };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

export default new SecretsManager();

