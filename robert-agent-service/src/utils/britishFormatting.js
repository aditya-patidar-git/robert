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

/** Photocard: 5 surname (A–Z and 9 padding) + 6 DOB digits + 2 initials + 3 security = 16. */
const UK_DL_SURNAME = /^[A-Z9]{5}$/;
/** First 8 chars: surname + first 3 digits of the 6-digit DOB block. */
const UK_DL_FIRST_HALF = /^[A-Z9]{5}\d{3}$/;
/** Second 8 chars: last 3 digits of DOB + 2 initials + 3 security. */
const UK_DL_SECOND_HALF = /^\d{3}[A-Z9]{2}[A-Z0-9]{3}$/;

const DRIVING_LICENCE_MESSAGE =
  'UK photocard driving licence number: exactly 16 characters (not the 2-digit issue number on the card). ' +
  'Structure: 5 characters (surname, padded with 9 if needed), 6 digits (encoded date of birth), 2 initials (second may be 9), 3 security characters. No spaces.';

const DRIVING_LICENCE_DOB_MESSAGE =
  'The 6-digit date section in the driving licence number is not valid (check encoded month/day/year).';

const MSG_FIRST_HALF =
  'First half: exactly 8 characters — surname (5 letters or 9 padding) plus the first 3 digits of the 6-digit date section. No spaces.';
const MSG_SECOND_HALF =
  'Second half: exactly 8 characters — last 3 digits of the date section, then 2 initials (second may be 9), then 3 security characters. No spaces.';

/**
 * Validate the 6-digit date-of-birth block in a UK photocard licence number (chars 6–11 of 16).
 * Encoding: digit0 = tens of birth year (mod 100); digits1–2 = month (01–12 male, 51–62 female = 50+month);
 * digits3–4 = day; digit5 = units of birth year (mod 100).
 * @param {string} sixDigits - Exactly 6 digits
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateUkLicenceDobBlock(sixDigits) {
  if (!sixDigits || sixDigits.length !== 6 || !/^\d{6}$/.test(sixDigits)) {
    return { valid: false, message: DRIVING_LICENCE_DOB_MESSAGE };
  }
  const d0 = parseInt(sixDigits[0], 10);
  const mEnc = parseInt(sixDigits.slice(1, 3), 10);
  const day = parseInt(sixDigits.slice(3, 5), 10);
  const d5 = parseInt(sixDigits[5], 10);

  let month;
  if (mEnc >= 1 && mEnc <= 12) {
    month = mEnc;
  } else if (mEnc >= 51 && mEnc <= 62) {
    month = mEnc - 50;
  } else {
    return { valid: false, message: DRIVING_LICENCE_DOB_MESSAGE };
  }
  if (month < 1 || month > 12) {
    return { valid: false, message: DRIVING_LICENCE_DOB_MESSAGE };
  }
  if (day < 1 || day > 31) {
    return { valid: false, message: DRIVING_LICENCE_DOB_MESSAGE };
  }

  const yearMod100 = d0 * 10 + d5;
  const candidates = [2000 + yearMod100, 1900 + yearMod100];
  for (const fullYear of candidates) {
    const trial = new Date(fullYear, month - 1, day);
    if (trial.getFullYear() === fullYear && trial.getMonth() === month - 1 && trial.getDate() === day) {
      return { valid: true };
    }
  }
  return { valid: false, message: DRIVING_LICENCE_DOB_MESSAGE };
}

/**
 * Validate UK photocard driving licence number (16 characters).
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

  const surname = formatted.slice(0, 5);
  const dobBlock = formatted.slice(5, 11);
  const initials = formatted.slice(11, 13);
  const security = formatted.slice(13, 16);

  if (!UK_DL_SURNAME.test(surname)) {
    return { valid: false, message: DRIVING_LICENCE_MESSAGE };
  }
  const dobR = validateUkLicenceDobBlock(dobBlock);
  if (!dobR.valid) {
    return { valid: false, message: dobR.message || DRIVING_LICENCE_MESSAGE };
  }
  if (!/^[A-Z9]{2}$/.test(initials)) {
    return { valid: false, message: DRIVING_LICENCE_MESSAGE };
  }
  if (!/^[A-Z0-9]{3}$/.test(security)) {
    return { valid: false, message: DRIVING_LICENCE_MESSAGE };
  }

  return { valid: true, formatted };
}

/**
 * Validate first half of UK photocard driving licence (8 chars: surname + first 3 DOB digits).
 * @param {string} value - First half as spoken or entered
 * @returns {{ valid: boolean, formatted?: string, message?: string }}
 */
export function validateDrivingLicenceFirstHalf(value) {
  const formatted = formatDrivingLicenceNumber(value);
  if (!formatted || formatted.length !== 8) {
    return { valid: false, message: MSG_FIRST_HALF };
  }
  if (!UK_DL_FIRST_HALF.test(formatted)) {
    return { valid: false, message: MSG_FIRST_HALF };
  }
  return { valid: true, formatted };
}

/**
 * Validate second half of UK photocard driving licence (8 chars: last 3 DOB digits + initials + security).
 * @param {string} value - Second half as spoken or entered
 * @returns {{ valid: boolean, formatted?: string, message?: string }}
 */
export function validateDrivingLicenceSecondHalf(value) {
  const formatted = formatDrivingLicenceNumber(value);
  if (!formatted || formatted.length !== 8) {
    return { valid: false, message: MSG_SECOND_HALF };
  }
  if (!UK_DL_SECOND_HALF.test(formatted)) {
    return { valid: false, message: MSG_SECOND_HALF };
  }
  return { valid: true, formatted };
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
  validateDrivingLicenceSecondHalf,
  validateUkLicenceDobBlock
};
