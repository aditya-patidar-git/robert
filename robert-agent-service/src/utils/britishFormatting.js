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
 * Format number with British conventions
 * @param {number} number - Number to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted number
 */
export function formatNumber(number, options = {}) {
  const {
    decimals = 2,
    useCommas = true
  } = options;

  if (typeof number !== 'number' || isNaN(number)) {
    return 'Invalid number';
  }

  let formatted = number.toFixed(decimals);
  
  if (useCommas) {
    // Add thousand separators
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = parts.join('.');
  }

  return formatted;
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
 * Format UK address
 * @param {object} address - Address object
 * @returns {string} Formatted address
 */
export function formatAddress(address) {
  if (!address || typeof address !== 'object') {
    return '';
  }

  const parts = [];
  
  if (address.line1) parts.push(address.line1);
  if (address.line2) parts.push(address.line2);
  if (address.city) parts.push(address.city);
  if (address.county) parts.push(address.county);
  if (address.postcode) parts.push(formatPostcode(address.postcode));

  return parts.join(', ');
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

export default {
  formatDate,
  formatTime,
  formatNumber,
  formatCurrency,
  formatPostcode,
  formatAddress,
  formatPhoneNumber
};

