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

export default {
  formatDate,
  formatTime,
  formatCurrency,
  formatPostcode,
  formatPhoneNumber,
  formatNationalInsurance,
  formatDrivingLicenceNumber
};

