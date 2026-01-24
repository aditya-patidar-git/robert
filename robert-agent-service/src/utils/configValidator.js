/**
 * Configuration Validator
 * 
 * Single Responsibility: Centralized configuration validation
 * - Validate session configuration
 * - Validate browser pool configuration
 * - Validate distributed state (Twilio Sync) configuration
 * - Detect placeholder patterns
 * - Log warnings with remediation guidance
 * 
 * Consumers: sessionManagementService, twilioSyncService, browserPoolService
 */

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - List of error messages
 * @property {string[]} warnings - List of warning messages
 */

/**
 * Configuration validation rules
 */
const VALIDATION_RULES = {
  session: {
    MAX_SESSIONS: { min: 50, recommended: 100, description: 'Maximum concurrent sessions' },
    SESSION_TTL_MINUTES: { min: 5, max: 1440, recommended: 60, description: 'Session time-to-live in minutes' },
    SESSION_CLEANUP_INTERVAL_SECONDS: { min: 10, max: 300, recommended: 60, description: 'Session cleanup interval' }
  },
  browserPool: {
    BROWSER_POOL_SIZE: { min: 2, max: 10, recommended: 3, description: 'Browser pool size' },
    BROWSER_POOL_MAX_QUEUE_SIZE: { min: 5, max: 50, recommended: 10, description: 'Maximum queued browser requests' },
    BROWSER_ACQUIRE_TIMEOUT_MS: { min: 5000, max: 120000, recommended: 30000, description: 'Browser acquisition timeout' }
  },
  twilioSync: {
    TWILIO_SYNC_SERVICE_SID: { pattern: /^IS[a-f0-9]{32}$/i, description: 'Twilio Sync Service SID' }
  }
};

/**
 * Placeholder patterns that indicate configuration is not set
 */
const PLACEHOLDER_PATTERNS = [
  /^IS[x]{32}$/i,           // ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  /^ISx+$/i,                // ISxxx...
  /^placeholder$/i,         // placeholder
  /^your[-_].*[-_]here$/i,  // your-value-here, your_value_here
  /^<.*>$/,                 // <value>
  /^\[.*\]$/,               // [value]
  /^TODO/i,                 // TODO...
  /^CHANGE[-_]?ME/i         // CHANGEME, CHANGE_ME
];

/**
 * Check if a value matches placeholder patterns
 * @param {string} value - Value to check
 * @returns {boolean} - True if value appears to be a placeholder
 */
export function isPlaceholder(value) {
  if (!value || typeof value !== 'string') return true;
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value.trim()));
}

/**
 * Validate a numeric configuration value
 * @param {string} name - Configuration name
 * @param {number} value - Current value
 * @param {Object} rules - Validation rules
 * @returns {ValidationResult}
 */
export function validateNumericConfig(name, value, rules) {
  const result = { valid: true, errors: [], warnings: [] };
  
  if (value === undefined || value === null || isNaN(value)) {
    result.warnings.push(`${name}: Not configured, using default`);
    return result;
  }

  if (rules.min !== undefined && value < rules.min) {
    result.errors.push(`${name}: Value ${value} is below minimum ${rules.min}. ${rules.description}`);
    result.valid = false;
  }

  if (rules.max !== undefined && value > rules.max) {
    result.errors.push(`${name}: Value ${value} exceeds maximum ${rules.max}. ${rules.description}`);
    result.valid = false;
  }

  if (rules.recommended !== undefined && value !== rules.recommended) {
    if (rules.min !== undefined && value === rules.min) {
      result.warnings.push(`${name}: Value ${value} is at minimum. Recommended: ${rules.recommended}`);
    } else if (value < rules.recommended) {
      result.warnings.push(`${name}: Value ${value} is below recommended ${rules.recommended}`);
    }
  }

  return result;
}

/**
 * Validate session management configuration
 * @param {Object} [config] - Configuration object (defaults to process.env)
 * @returns {ValidationResult}
 */
export function validateSessionConfig(config = process.env) {
  const result = { valid: true, errors: [], warnings: [] };

  // Validate MAX_SESSIONS
  const maxSessions = parseInt(config.MAX_SESSIONS || '100', 10);
  const maxSessionsResult = validateNumericConfig('MAX_SESSIONS', maxSessions, VALIDATION_RULES.session.MAX_SESSIONS);
  result.errors.push(...maxSessionsResult.errors);
  result.warnings.push(...maxSessionsResult.warnings);
  if (!maxSessionsResult.valid) result.valid = false;

  // Validate SESSION_TTL_MINUTES
  const sessionTtl = parseInt(config.SESSION_TTL_MINUTES || '60', 10);
  const sessionTtlResult = validateNumericConfig('SESSION_TTL_MINUTES', sessionTtl, VALIDATION_RULES.session.SESSION_TTL_MINUTES);
  result.errors.push(...sessionTtlResult.errors);
  result.warnings.push(...sessionTtlResult.warnings);
  if (!sessionTtlResult.valid) result.valid = false;

  // Validate SESSION_CLEANUP_INTERVAL_SECONDS
  const cleanupInterval = parseInt(config.SESSION_CLEANUP_INTERVAL_SECONDS || '60', 10);
  const cleanupResult = validateNumericConfig('SESSION_CLEANUP_INTERVAL_SECONDS', cleanupInterval, VALIDATION_RULES.session.SESSION_CLEANUP_INTERVAL_SECONDS);
  result.errors.push(...cleanupResult.errors);
  result.warnings.push(...cleanupResult.warnings);
  if (!cleanupResult.valid) result.valid = false;

  return result;
}

/**
 * Validate browser pool configuration
 * @param {Object} [config] - Configuration object (defaults to process.env)
 * @returns {ValidationResult}
 */
export function validateBrowserPoolConfig(config = process.env) {
  const result = { valid: true, errors: [], warnings: [] };

  // Skip validation if pool is disabled
  if (config.BROWSER_POOL_ENABLED === 'false') {
    result.warnings.push('Browser pool is disabled via BROWSER_POOL_ENABLED=false');
    return result;
  }

  // Skip validation in VPN mode
  if (config.CHROME_USER_DATA_DIR && config.NODE_ENV !== 'production') {
    result.warnings.push('VPN mode detected - browser pool not applicable');
    return result;
  }

  // Validate BROWSER_POOL_SIZE
  const poolSize = parseInt(config.BROWSER_POOL_SIZE || '3', 10);
  const poolSizeResult = validateNumericConfig('BROWSER_POOL_SIZE', poolSize, VALIDATION_RULES.browserPool.BROWSER_POOL_SIZE);
  result.errors.push(...poolSizeResult.errors);
  result.warnings.push(...poolSizeResult.warnings);
  if (!poolSizeResult.valid) result.valid = false;

  // Validate BROWSER_POOL_MAX_QUEUE_SIZE
  const queueSize = parseInt(config.BROWSER_POOL_MAX_QUEUE_SIZE || '10', 10);
  const queueResult = validateNumericConfig('BROWSER_POOL_MAX_QUEUE_SIZE', queueSize, VALIDATION_RULES.browserPool.BROWSER_POOL_MAX_QUEUE_SIZE);
  result.errors.push(...queueResult.errors);
  result.warnings.push(...queueResult.warnings);
  if (!queueResult.valid) result.valid = false;

  // Validate BROWSER_ACQUIRE_TIMEOUT_MS
  const timeout = parseInt(config.BROWSER_ACQUIRE_TIMEOUT_MS || '30000', 10);
  const timeoutResult = validateNumericConfig('BROWSER_ACQUIRE_TIMEOUT_MS', timeout, VALIDATION_RULES.browserPool.BROWSER_ACQUIRE_TIMEOUT_MS);
  result.errors.push(...timeoutResult.errors);
  result.warnings.push(...timeoutResult.warnings);
  if (!timeoutResult.valid) result.valid = false;

  return result;
}

/**
 * Validate Twilio Sync configuration for distributed state
 * @param {Object} [config] - Configuration object (defaults to process.env)
 * @returns {ValidationResult}
 */
export function validateTwilioSyncConfig(config = process.env) {
  const result = { valid: true, errors: [], warnings: [] };

  const syncSid = config.TWILIO_SYNC_SERVICE_SID;
  
  // Check if SID is missing
  if (!syncSid) {
    result.warnings.push(
      'TWILIO_SYNC_SERVICE_SID: Not configured. Distributed state disabled (using in-memory fallback). ' +
      'For multi-instance deployments, create a Twilio Sync Service at https://console.twilio.com/sync/services'
    );
    return result;
  }

  // Check if SID is a placeholder
  if (isPlaceholder(syncSid)) {
    result.warnings.push(
      'TWILIO_SYNC_SERVICE_SID: Detected placeholder value. Distributed state disabled. ' +
      'Replace with actual Sync Service SID (format: ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx) from Twilio Console.'
    );
    return result;
  }

  // Validate SID format
  const pattern = VALIDATION_RULES.twilioSync.TWILIO_SYNC_SERVICE_SID.pattern;
  if (!pattern.test(syncSid)) {
    result.errors.push(
      `TWILIO_SYNC_SERVICE_SID: Invalid format "${syncSid}". ` +
      'Expected format: ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (IS followed by 32 hex characters)'
    );
    result.valid = false;
  }

  // Check for other required Twilio credentials
  if (!config.TWILIO_ACCOUNT_SID) {
    result.errors.push('TWILIO_ACCOUNT_SID: Required for Twilio Sync but not configured');
    result.valid = false;
  }

  if (!config.TWILIO_AUTH_TOKEN) {
    result.errors.push('TWILIO_AUTH_TOKEN: Required for Twilio Sync but not configured');
    result.valid = false;
  }

  return result;
}

/**
 * Validate all configurations
 * @param {Object} [config] - Configuration object (defaults to process.env)
 * @returns {Object} Validation results for each category
 */
export function validateAllConfigs(config = process.env) {
  return {
    session: validateSessionConfig(config),
    browserPool: validateBrowserPoolConfig(config),
    twilioSync: validateTwilioSyncConfig(config)
  };
}

/**
 * Log validation results with appropriate log levels
 * @param {ValidationResult} result - Validation result to log
 * @param {string} category - Category name for logging
 */
export function logValidationResult(result, category) {
  if (result.errors.length > 0) {
    console.error(`❌ [Config Validation] ${category} errors:`);
    result.errors.forEach(error => console.error(`   - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn(`⚠️ [Config Validation] ${category} warnings:`);
    result.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    console.log(`✅ [Config Validation] ${category}: All checks passed`);
  }
}

/**
 * Validate and log all configurations at startup
 * @param {Object} [config] - Configuration object (defaults to process.env)
 * @returns {boolean} True if all critical validations passed
 */
export function validateAndLogStartupConfig(config = process.env) {
  console.log('\n📋 [Config Validation] Validating configuration...');
  
  const results = validateAllConfigs(config);
  let allValid = true;

  for (const [category, result] of Object.entries(results)) {
    logValidationResult(result, category);
    if (!result.valid) {
      allValid = false;
    }
  }

  if (allValid) {
    console.log('✅ [Config Validation] All critical configuration checks passed\n');
  } else {
    console.error('❌ [Config Validation] Some configuration checks failed. Please review errors above.\n');
  }

  return allValid;
}

// Default export for convenient importing
export default {
  isPlaceholder,
  validateNumericConfig,
  validateSessionConfig,
  validateBrowserPoolConfig,
  validateTwilioSyncConfig,
  validateAllConfigs,
  logValidationResult,
  validateAndLogStartupConfig,
  VALIDATION_RULES
};
