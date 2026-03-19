/**
 * British formatting utilities
 * Provides UK-specific formatting for dates, times, numbers, currency, and addresses
 */

/**
 * Format date in British format (DD/MM/YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid date';
  }
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format time in 24-hour format
 * @param {Date|string} date - Date/time to format
 * @returns {string} Formatted time (HH:MM)
 */
export function formatTime(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid time';
  }
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Format currency in GBP
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency (£X.XX)
 */
export function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '£0.00';
  }
  return `£${amount.toFixed(2)}`;
}

/**
 * Format UK postcode
 * @param {string} postcode - Postcode to format
 * @returns {string} Formatted postcode
 */
export function formatPostcode(postcode) {
  if (!postcode || typeof postcode !== 'string') {
    return '';
  }
  // UK postcode format: SW1A 1AA
  // Remove all spaces and convert to uppercase
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
  
  // Add space before last 3 characters if not already present
  if (cleaned.length > 3) {
    return cleaned.slice(0, -3) + ' ' + cleaned.slice(-3);
  }
  
  return cleaned;
}

/**
 * Format phone number in UK format
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return '';
  }

  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // UK numbers: +44 or 0 followed by area code
  if (cleaned.startsWith('+44')) {
    return cleaned.replace(/^\+44/, '0');
  }

  return cleaned;
}

/**
 * Format UK National Insurance number (2 letters, 6 digits, 1 letter, e.g. AB123456C).
 * Removes spaces and dashes; returns uppercase 9-character string if pattern matches.
 * @param {string} value - NI number as spoken or entered (spaces optional)
 * @returns {string} Formatted NI number or original trimmed value if pattern doesn't match
 */
export function formatNationalInsurance(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) return '';
  const cleaned = trimmed.replace(/[\s\-]/g, '').toUpperCase();
  // UK NI: 2 letters, 6 digits, 1 letter
  const match = cleaned.match(/^([A-Z]{2})(\d{6})([A-Z])$/);
  if (match) {
    return match[1] + match[2] + match[3];
  }
  return trimmed;
}

/**
 * Validate UK National Insurance number (2 letters, 6 digits, 1 letter, e.g. AB123456C).
 * Use before filling forms to reject invalid format and ask caller to repeat.
 * @param {string} value - NI number as spoken or entered
 * @returns {{ valid: boolean, formatted?: string, message?: string }}
 */
export function validateNationalInsurance(value) {
  const formatted = formatNationalInsurance(value);
  const cleaned = (value || '').trim().replace(/[\s\-]/g, '').toUpperCase();
  const valid = /^[A-Z]{2}\d{6}[A-Z]$/.test(cleaned);
  const message = 'UK National Insurance: 2 letters, 6 digits, 1 letter (e.g. AB123456C).';
  if (valid) {
    return { valid: true, formatted };
  }
  return { valid: false, message };
}

/**
 * Format UK driving licence number for form input (no spaces).
 * Removes spaces and dashes, uppercases letters. Many forms expect no spaces.
 * @param {string} value - Driving licence number as spoken or entered
 * @returns {string} Formatted licence number (no spaces)
 */
export function formatDrivingLicenceNumber(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/[\s\-]/g, '').toUpperCase();
}

/** Old UK format (CRM): exactly 16 chars — 5 letters, 5 digits, 6 alphanumeric, e.g. CARTD940315D9A8F. */
const UK_DRIVING_LICENCE_OLD = /^[A-Z]{5}\d{5}[A-Z0-9]{6}$/;

const DRIVING_LICENCE_MESSAGE =
  'UK driving licence: exactly 16 characters — 5 letters, 5 digits, then 6 letters or numbers (e.g. CARTD940315D9A8F), no spaces.';

/**
 * Validate UK driving licence number for this CRM: exactly 16 characters, old format only.
 * Use before filling forms to avoid CRM "Value is invalid" errors.
 * @param {string} value - Driving licence number as spoken or entered
 * @returns {{ valid: boolean, formatted?: string, message?: string }}
 */
export function validateDrivingLicenceNumber(value) {
  const formatted = formatDrivingLicenceNumber(value);
  if (!formatted) {
    return { valid: false, message: DRIVING_LICENCE_MESSAGE };
  }
  if (formatted.length !== 16) {
    return { valid: false, message: DRIVING_LICENCE_MESSAGE };
  }
  const valid = UK_DRIVING_LICENCE_OLD.test(formatted);
  if (valid) {
    return { valid: true, formatted };
  }
  return { valid: false, message: DRIVING_LICENCE_MESSAGE };
}

/** First half: 8 chars — new style 5 digits + 3 letters, or old style 5 letters + 3 digits. */
const UK_DRIVING_LICENCE_FIRST_HALF = /^(\d{5}[A-Z]{3}|[A-Z]{5}\d{3})$/;
/** Second half: new 7 chars (5 digits + 2 letters) or old 8 chars (3 digits + 5 alphanumeric). */
const UK_DRIVING_LICENCE_SECOND_HALF = /^(\d{5}[A-Z]{2}|\d{3}[A-Z0-9]{5})$/;

/**
 * Validate first half of UK driving licence (8 chars).
 * New format: 5 digits + 3 letters (e.g. 12345ABC). Old format: 5 letters + 3 digits (e.g. CARTD940).
 * @param {string} value - First half as spoken or entered
 * @returns {{ valid: boolean, formatted?: string, message?: string }}
 */
export function validateDrivingLicenceFirstHalf(value) {
  const formatted = formatDrivingLicenceNumber(value);
  if (!formatted || formatted.length !== 8) {
    return { valid: false, message: 'First half: 8 characters — either 5 digits then 3 letters (e.g. 12345ABC) or 5 letters then 3 digits (e.g. CARTD940), no spaces.' };
  }
  const valid = UK_DRIVING_LICENCE_FIRST_HALF.test(formatted);
  const message = 'First half: 8 characters — either 5 digits then 3 letters (e.g. 12345ABC) or 5 letters then 3 digits (e.g. CARTD940), no spaces.';
  if (valid) {
    return { valid: true, formatted };
  }
  return { valid: false, message };
}

/**
 * Validate second half of UK driving licence (7 or 8 chars).
 * New format: 7 chars = 5 digits + 2 letters (e.g. 67890CD). Old format: 8 chars = 3 digits + 5 alphanumeric (e.g. 315D9A8F).
 * @param {string} value - Second half as spoken or entered
 * @returns {{ valid: boolean, formatted?: string, message?: string }}
 */
export function validateDrivingLicenceSecondHalf(value) {
  const formatted = formatDrivingLicenceNumber(value);
  if (!formatted || (formatted.length !== 7 && formatted.length !== 8)) {
    return { valid: false, message: 'Second half: 7 characters (5 digits, 2 letters, e.g. 67890CD) or 8 (3 digits then 5 letters/numbers, e.g. 315D9A8F), no spaces.' };
  }
  const valid = UK_DRIVING_LICENCE_SECOND_HALF.test(formatted);
  const message = 'Second half: 7 characters (5 digits, 2 letters) or 8 (3 digits then 5 letters/numbers), no spaces.';
  if (valid) {
    return { valid: true, formatted };
  }
  return { valid: false, message };
}

export default {
  formatDate,
  formatTime,
  formatCurrency,
  formatPostcode,
  formatPhoneNumber,
  formatNationalInsurance,
  formatDrivingLicenceNumber,
  validateNationalInsurance,
  validateDrivingLicenceNumber,
  validateDrivingLicenceFirstHalf,
  validateDrivingLicenceSecondHalf
};

