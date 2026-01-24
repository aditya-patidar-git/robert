import crypto from 'crypto';
// dotenv is already loaded in index.js, no need to reload here

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
    this.vaultType = null; // 'aws' or 'vault'
    this.secretsPrefix = ''; // For AWS
    this.secretsPath = ''; // For HashiCorp Vault
    this.secretCache = new Map(); // Cache for vault secrets with TTL
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes default
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
      if (process.env.VAULT_ENABLED === 'true' || process.env.VAULT_TYPE) {
        await this.initializeVault();
        
        // If vault is enabled, try to load secrets from vault
        if (this.vaultEnabled) {
          await this.loadSecretsFromVault();
        }
      }

      // Validate all required secrets
      await this.validateSecrets();
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
        await this.initializeAWSSecretsManager();
      } else if (vaultType === 'vault') {
        await this.initializeHashiCorpVault();
      } else {
        console.log('🔐 No vault type specified, using environment variables only');
        this.vaultEnabled = false;
        return;
      }

      this.vaultEnabled = true;
      console.log('✅ Vault client initialized');
    } catch (error) {
      console.error('❌ Error initializing vault:', error);
      console.warn('⚠️ Falling back to environment variables');
      this.vaultEnabled = false;
      // Don't throw - allow fallback to environment variables
    }
  }

  /**
   * Initialize AWS Secrets Manager client
   * @returns {Promise<void>}
   */
  async initializeAWSSecretsManager() {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      
      const region = process.env.AWS_REGION || 'us-east-1';
      const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        : undefined; // Use IAM role if credentials not provided

      this.vaultClient = new SecretsManagerClient({
        region,
        credentials
      });

      this.vaultType = 'aws';
      this.secretsPrefix = process.env.AWS_SECRETS_PREFIX || 'robert-voice-agent/';
      
      console.log(`✅ AWS Secrets Manager initialized (region: ${region})`);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.warn('⚠️ @aws-sdk/client-secrets-manager not installed. Install with: npm install @aws-sdk/client-secrets-manager');
        throw new Error('AWS SDK not installed');
      }
      throw error;
    }
  }

  /**
   * Initialize HashiCorp Vault client
   * @returns {Promise<void>}
   */
  async initializeHashiCorpVault() {
    try {
      const vault = (await import('node-vault')).default;
      
      const endpoint = process.env.VAULT_ENDPOINT;
      if (!endpoint) {
        throw new Error('VAULT_ENDPOINT environment variable is required');
      }

      const vaultOptions = {
        endpoint: endpoint,
        apiVersion: 'v1'
      };

      // Authentication: token or AppRole
      if (process.env.VAULT_TOKEN) {
        vaultOptions.token = process.env.VAULT_TOKEN;
      } else if (process.env.VAULT_ROLE_ID && process.env.VAULT_SECRET_ID) {
        // AppRole authentication
        vaultOptions.approleRoleId = process.env.VAULT_ROLE_ID;
        vaultOptions.approleSecretId = process.env.VAULT_SECRET_ID;
      } else {
        throw new Error('VAULT_TOKEN or VAULT_ROLE_ID/VAULT_SECRET_ID required');
      }

      this.vaultClient = vault(vaultOptions);
      this.vaultType = 'vault';
      this.secretsPath = process.env.VAULT_SECRET_PATH || 'secret/robert-voice-agent';
      
      // Test connection
      try {
        await this.vaultClient.health();
        console.log(`✅ HashiCorp Vault initialized (endpoint: ${endpoint})`);
      } catch (healthError) {
        console.warn('⚠️ Vault health check failed, but continuing:', healthError.message);
      }
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.warn('⚠️ node-vault not installed. Install with: npm install node-vault');
        throw new Error('Vault SDK not installed');
      }
      throw error;
    }
  }

  /**
   * Get secret value (synchronous - from cache only)
   * @param {string} secretName - Secret name
   * @returns {string|null} Secret value or null
   */
  getSecret(secretName) {
    return this.secrets.get(secretName) || null;
  }

  /**
   * Get secret value (async - checks vault if not in cache)
   * @param {string} secretName - Secret name
   * @param {boolean} useCache - Use cached value if available (default: true)
   * @returns {Promise<string|null>|string|null} Secret value or null
   */
  async getSecretAsync(secretName, useCache = true) {
    // Check cache first
    if (useCache && this.secrets.has(secretName)) {
      return this.secrets.get(secretName);
    }

    // Try to get from vault if enabled
    if (this.vaultEnabled && this.vaultClient) {
      try {
        const vaultValue = await this.getSecretFromVault(secretName);
        if (vaultValue) {
          // Cache the value
          this.secrets.set(secretName, vaultValue);
          return vaultValue;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get secret ${secretName} from vault:`, error.message);
        // Fall through to environment variable
      }
    }

    // Fallback to environment variable
    const envValue = process.env[secretName];
    if (envValue) {
      this.secrets.set(secretName, envValue);
      return envValue;
    }

    return null;
  }

  /**
   * Get secret from vault (AWS or HashiCorp)
   * @param {string} secretName - Secret name
   * @returns {Promise<string|null>} Secret value or null
   */
  async getSecretFromVault(secretName) {
    if (!this.vaultEnabled || !this.vaultClient) {
      return null;
    }

    try {
      if (this.vaultType === 'aws') {
        return await this.getSecretFromAWS(secretName);
      } else if (this.vaultType === 'vault') {
        return await this.getSecretFromHashiCorpVault(secretName);
      }
    } catch (error) {
      console.error(`❌ Error getting secret ${secretName} from vault:`, error);
      throw error;
    }

    return null;
  }

  /**
   * Get secret from AWS Secrets Manager
   * @param {string} secretName - Secret name
   * @returns {Promise<string|null>} Secret value or null
   */
  async getSecretFromAWS(secretName) {
    try {
      const { GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      
      const fullSecretName = this.secretsPrefix + secretName.toLowerCase().replace(/_/g, '-');
      
      const command = new GetSecretValueCommand({
        SecretId: fullSecretName
      });

      const response = await this.vaultClient.send(command);
      
      // AWS Secrets Manager can store secrets as string or JSON
      if (response.SecretString) {
        try {
          // Try to parse as JSON (for structured secrets)
          const parsed = JSON.parse(response.SecretString);
          // If it's an object, look for the secret name as a key, or return the whole object as string
          if (typeof parsed === 'object' && parsed[secretName]) {
            return parsed[secretName];
          }
          // Otherwise return the string value
          return response.SecretString;
        } catch {
          // Not JSON, return as-is
          return response.SecretString;
        }
      } else if (response.SecretBinary) {
        // Binary secret - decode from base64
        return Buffer.from(response.SecretBinary, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.warn(`⚠️ Secret ${secretName} not found in AWS Secrets Manager`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Get secret from HashiCorp Vault
   * @param {string} secretName - Secret name
   * @returns {Promise<string|null>} Secret value or null
   */
  async getSecretFromHashiCorpVault(secretName) {
    try {
      const secretPath = `${this.secretsPath}/${secretName.toLowerCase().replace(/_/g, '-')}`;
      
      // Use KV v2 engine (mount path is usually 'secret')
      const response = await this.vaultClient.read(secretPath);
      
      if (response && response.data) {
        // KV v2 returns data in response.data.data
        const data = response.data.data || response.data;
        // If it's an object, look for the secret name as a key
        if (typeof data === 'object' && data[secretName]) {
          return data[secretName];
        }
        // Otherwise, if there's a 'value' key, use that
        if (data.value) {
          return data.value;
        }
        // If it's a string, return it
        if (typeof data === 'string') {
          return data;
        }
        // Last resort: stringify the object
        return JSON.stringify(data);
      }

      return null;
    } catch (error) {
      if (error.response && error.response.statusCode === 404) {
        console.warn(`⚠️ Secret ${secretName} not found in HashiCorp Vault`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Load all required secrets from vault
   * @returns {Promise<void>}
   */
  async loadSecretsFromVault() {
    if (!this.vaultEnabled) {
      return;
    }

    console.log('🔐 Loading secrets from vault...');
    let loadedCount = 0;

    for (const secretName of this.requiredSecrets) {
      try {
        const value = await this.getSecretFromVault(secretName);
        if (value) {
          this.secrets.set(secretName, value);
          loadedCount++;
          console.log(`✅ Loaded ${secretName} from vault`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load ${secretName} from vault:`, error.message);
        // Continue with other secrets
      }
    }

    console.log(`✅ Loaded ${loadedCount}/${this.requiredSecrets.length} secrets from vault`);
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
  async validateSecrets() {
    const missing = [];
    
    for (const secretName of this.requiredSecrets) {
      // Try to get secret (will check vault and env)
      const value = await this.getSecretAsync(secretName, false);
      if (!value) {
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
   * @param {string} newValue - New secret value (optional, for manual rotation)
   * @returns {Promise<boolean>} True if rotated successfully
   */
  async rotateSecret(secretName, newValue = null) {
    try {
      if (!this.vaultEnabled) {
        console.warn(`⚠️ Secret rotation not available (vault not enabled): ${secretName}`);
        return false;
      }

      if (this.vaultType === 'aws') {
        return await this.rotateAWSSecret(secretName, newValue);
      } else if (this.vaultType === 'vault') {
        return await this.rotateVaultSecret(secretName, newValue);
      }

      return false;
    } catch (error) {
      console.error(`❌ Error rotating secret ${secretName}:`, error);
      return false;
    }
  }

  /**
   * Rotate secret in AWS Secrets Manager
   * @param {string} secretName - Secret name
   * @param {string} newValue - New secret value
   * @returns {Promise<boolean>} True if rotated successfully
   */
  async rotateAWSSecret(secretName, newValue) {
    try {
      const { PutSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      
      const fullSecretName = this.secretsPrefix + secretName.toLowerCase().replace(/_/g, '-');
      
      // If newValue not provided, trigger automatic rotation (requires Lambda function)
      if (!newValue) {
        const { RotateSecretCommand } = await import('@aws-sdk/client-secrets-manager');
        const command = new RotateSecretCommand({
          SecretId: fullSecretName
        });
        await this.vaultClient.send(command);
        console.log(`🔄 Triggered automatic rotation for ${secretName}`);
        return true;
      }

      // Manual rotation with new value
      const command = new PutSecretValueCommand({
        SecretId: fullSecretName,
        SecretString: newValue
      });

      await this.vaultClient.send(command);
      
      // Update cache
      this.secrets.set(secretName, newValue);
      
      console.log(`✅ Secret ${secretName} rotated successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Error rotating AWS secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Rotate secret in HashiCorp Vault
   * @param {string} secretName - Secret name
   * @param {string} newValue - New secret value
   * @returns {Promise<boolean>} True if rotated successfully
   */
  async rotateVaultSecret(secretName, newValue) {
    try {
      if (!newValue) {
        console.warn('⚠️ Manual rotation requires newValue for HashiCorp Vault');
        return false;
      }

      const secretPath = `${this.secretsPath}/${secretName.toLowerCase().replace(/_/g, '-')}`;
      
      // Write new value (Vault handles versioning automatically)
      await this.vaultClient.write(secretPath, {
        value: newValue,
        updated_at: new Date().toISOString()
      });
      
      // Update cache
      this.secrets.set(secretName, newValue);
      
      console.log(`✅ Secret ${secretName} rotated successfully in Vault`);
      return true;
    } catch (error) {
      console.error(`❌ Error rotating Vault secret ${secretName}:`, error);
      throw error;
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
      const value = await this.getSecretAsync(secretName, false); // Don't use cache for testing
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
        const accountSid = await this.getSecretAsync('TWILIO_SID', false);
        const authToken = await this.getSecretAsync('TWILIO_AUTH_TOKEN', false);
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

