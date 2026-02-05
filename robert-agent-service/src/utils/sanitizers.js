/**
 * Sanitizer Utility Functions
 * Reusable functions for sanitizing user input and preventing injection attacks.
 * 
 * These utilities are extracted for reuse across services:
 * - templateEngine.js (prompt injection prevention)
 * - API input validation
 * - Logging (PII masking)
 * 
 * @module utils/sanitizers
 */

/**
 * Characters and patterns that could be used for prompt injection.
 */
const DANGEROUS_PATTERNS = [
  /\{\{[^}]*\}\}/g,     // Nested template syntax
  /<\/?script/gi,       // Script tags
  /javascript:/gi,      // JavaScript protocol
  /on\w+\s*=/gi,        // Event handlers
  /\bsystem\s*:/gi,     // System prompt markers
  /\buser\s*:/gi,       // User prompt markers
  /\bassistant\s*:/gi,  // Assistant prompt markers
  /\bfunction\s*:/gi,   // Function markers
  /\btool\s*:/gi,       // Tool markers
  /```[\s\S]*?```/g,    // Code blocks
  /\[INST\]/gi,         // Instruction markers
  /\[\/INST\]/gi,
  /<<SYS>>/gi,          // System markers
  /<\/SYS>>/gi,
];

/**
 * PII patterns for masking sensitive data in logs.
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:(?:\+44|0044|0)?\s*(?:7\d{3}|\d{4})\s*\d{3}\s*\d{3})\b/g,
  ukPostcode: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi,
  niNumber: /\b[A-Z]{2}\s*\d{2}\s*\d{2}\s*\d{2}\s*[A-Z]\b/gi,
  cardNumber: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  sortCode: /\b\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/g,
};

/**
 * Sanitize a string for use in prompts.
 * Removes patterns that could be used for prompt injection.
 * 
 * @param {string} value - Value to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} [options.removeCodeBlocks=true] - Remove code blocks
 * @param {boolean} [options.limitNewlines=true] - Limit consecutive newlines
 * @param {boolean} [options.trim=true] - Trim whitespace
 * @returns {string} Sanitized value
 */
export function sanitizeForPrompt(value, options = {}) {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  
  const {
    removeCodeBlocks = true,
    limitNewlines = true,
    trim = true
  } = options;
  
  let sanitized = value;
  
  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  // Limit consecutive newlines
  if (limitNewlines) {
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  }
  
  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }
  
  return sanitized;
}

/**
 * Mask PII data in a string for safe logging.
 * 
 * @param {string} value - Value to mask
 * @param {Object} options - Masking options
 * @param {boolean} [options.maskEmail=true] - Mask email addresses
 * @param {boolean} [options.maskPhone=true] - Mask phone numbers
 * @param {boolean} [options.maskPostcode=true] - Mask UK postcodes
 * @param {boolean} [options.maskNI=true] - Mask NI numbers
 * @param {boolean} [options.maskCard=true] - Mask card numbers
 * @returns {string} Value with PII masked
 */
export function maskPII(value, options = {}) {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  
  const {
    maskEmail = true,
    maskPhone = true,
    maskPostcode = true,
    maskNI = true,
    maskCard = true
  } = options;
  
  let masked = value;
  
  if (maskEmail) {
    masked = masked.replace(PII_PATTERNS.email, '[EMAIL]');
  }
  
  if (maskPhone) {
    masked = masked.replace(PII_PATTERNS.phone, '[PHONE]');
  }
  
  if (maskPostcode) {
    masked = masked.replace(PII_PATTERNS.ukPostcode, '[POSTCODE]');
  }
  
  if (maskNI) {
    masked = masked.replace(PII_PATTERNS.niNumber, '[NI_NUMBER]');
  }
  
  if (maskCard) {
    masked = masked.replace(PII_PATTERNS.cardNumber, '[CARD_NUMBER]');
    masked = masked.replace(PII_PATTERNS.sortCode, '[SORT_CODE]');
  }
  
  return masked;
}

/**
 * Sanitize HTML to prevent XSS attacks.
 * Escapes HTML special characters.
 * 
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
export function escapeHtml(value) {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  
  return value.replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
}

/**
 * Sanitize a string for use in SQL queries.
 * Note: Always prefer parameterized queries over string sanitization.
 * This is a fallback for cases where parameterized queries aren't possible.
 * 
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
export function escapeSQL(value) {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  
  return value
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\x00/g, '')
    .replace(/\x1a/g, '');
}

/**
 * Sanitize a string for use in regular expressions.
 * Escapes special regex characters.
 * 
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
export function escapeRegex(value) {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate and sanitize an email address.
 * 
 * @param {string} email - Email to validate
 * @returns {Object} { isValid: boolean, sanitized: string }
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return { isValid: false, sanitized: '' };
  }
  
  const trimmed = email.trim().toLowerCase();
  const isValid = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed);
  
  return {
    isValid,
    sanitized: isValid ? trimmed : ''
  };
}

/**
 * Validate and sanitize a UK phone number.
 * Normalizes to 11-digit format (e.g., 07123456789).
 * 
 * @param {string} phone - Phone number to validate
 * @returns {Object} { isValid: boolean, sanitized: string }
 */
export function sanitizeUKPhone(phone) {
  if (typeof phone !== 'string') {
    return { isValid: false, sanitized: '' };
  }
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle +44 or 0044 prefix
  if (digits.startsWith('44')) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('0044')) {
    digits = '0' + digits.slice(4);
  }
  
  // Validate: should be 11 digits starting with 0
  const isValid = digits.length === 11 && digits.startsWith('0');
  
  return {
    isValid,
    sanitized: isValid ? digits : ''
  };
}

/**
 * Validate and sanitize a UK postcode.
 * Normalizes to uppercase with space (e.g., 'SW1A 1AA').
 * 
 * @param {string} postcode - Postcode to validate
 * @returns {Object} { isValid: boolean, sanitized: string }
 */
export function sanitizeUKPostcode(postcode) {
  if (typeof postcode !== 'string') {
    return { isValid: false, sanitized: '' };
  }
  
  // Remove all spaces and convert to uppercase
  const normalized = postcode.replace(/\s/g, '').toUpperCase();
  
  // UK postcode regex (simplified)
  const pattern = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/;
  const match = normalized.match(pattern);
  
  if (!match) {
    return { isValid: false, sanitized: '' };
  }
  
  // Format with space
  const sanitized = `${match[1]} ${match[2]}`;
  
  return {
    isValid: true,
    sanitized
  };
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 * 
 * @param {string} value - Value to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} [suffix='...'] - Suffix to add when truncated
 * @returns {string} Truncated value
 */
export function truncate(value, maxLength, suffix = '...') {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  
  if (value.length <= maxLength) {
    return value;
  }
  
  return value.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Remove control characters from a string.
 * Keeps printable ASCII and common Unicode characters.
 * 
 * @param {string} value - Value to clean
 * @returns {string} Cleaned value
 */
export function removeControlChars(value) {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  
  // Remove control characters except newlines and tabs
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Normalize whitespace in a string.
 * Collapses multiple spaces and trims.
 * 
 * @param {string} value - Value to normalize
 * @returns {string} Normalized value
 */
export function normalizeWhitespace(value) {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  
  return value.replace(/\s+/g, ' ').trim();
}

// Export all PII patterns for external use
export { PII_PATTERNS };
