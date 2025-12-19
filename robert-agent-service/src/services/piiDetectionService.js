/**
 * PII Detection Service
 * Detects and masks Personally Identifiable Information (PII) for UK patterns
 */

class PIIDetectionService {
  constructor() {
    // UK Phone number patterns
    this.phonePatterns = [
      /(\+44|0)[1-9]\d{8,9}/g, // UK mobile/landline
      /(\+44\s?)?(0)?\d{4}\s?\d{3}\s?\d{3}/g, // Formatted UK numbers
      /07\d{9}/g // UK mobile (11 digits starting with 07)
    ];

    // UK Postcode patterns
    this.postcodePatterns = [
      /[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/gi, // Standard UK postcode
      /[A-Z]{1,2}\d[A-Z]\s?\d[A-Z]{2}/gi // Alternative format
    ];

    // Email pattern
    this.emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // UK National Insurance Number pattern
    this.niPattern = /[A-Z]{2}\d{6}[A-Z]?/g;

    // UK Driving License pattern (simplified - actual format is complex)
    this.drivingLicensePattern = /[A-Z]{2}\d{6}[A-Z]\d{5}[A-Z]{2}/g;

    // Credit Card patterns (Luhn algorithm validation)
    this.cardPatterns = [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // 16 digits
      /\b\d{4}[\s-]?\d{6}[\s-]?\d{5}\b/g // 15 digits (Amex)
    ];
  }

  /**
   * Validate UK phone number format
   * @param {string} phone - Phone number
   * @returns {boolean} True if valid UK format
   */
  isValidUKPhone(phone) {
    // Remove spaces and dashes
    const cleaned = phone.replace(/[\s-]/g, '');
    // Check if it matches UK phone patterns
    return /^(\+44|0)[1-9]\d{8,9}$/.test(cleaned) || /^07\d{9}$/.test(cleaned);
  }

  /**
   * Validate UK postcode format
   * @param {string} postcode - Postcode
   * @returns {boolean} True if valid UK format
   */
  isValidUKPostcode(postcode) {
    const cleaned = postcode.replace(/\s/g, '').toUpperCase();
    return /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/.test(cleaned);
  }

  /**
   * Validate credit card using Luhn algorithm
   * @param {string} cardNumber - Card number
   * @returns {boolean} True if valid Luhn checksum
   */
  isValidLuhn(cardNumber) {
    const cleaned = cardNumber.replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(cleaned)) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Detect PII in text
   * @param {string} text - Text to analyze
   * @returns {Object} Detected PII with types and positions
   */
  detectPII(text) {
    if (!text || typeof text !== 'string') {
      return {
        detected: false,
        pii: []
      };
    }

    const detectedPII = [];

    // Detect phone numbers
    this.phonePatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const phone = match[0];
        if (this.isValidUKPhone(phone)) {
          detectedPII.push({
            type: 'phone',
            value: phone,
            startIndex: match.index,
            endIndex: match.index + phone.length
          });
        }
      }
    });

    // Detect postcodes
    this.postcodePatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const postcode = match[0];
        if (this.isValidUKPostcode(postcode)) {
          detectedPII.push({
            type: 'postcode',
            value: postcode,
            startIndex: match.index,
            endIndex: match.index + postcode.length
          });
        }
      }
    });

    // Detect emails
    const emailMatches = text.matchAll(this.emailPattern);
    for (const match of emailMatches) {
      detectedPII.push({
        type: 'email',
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // Detect NI numbers
    const niMatches = text.matchAll(this.niPattern);
    for (const match of niMatches) {
      detectedPII.push({
        type: 'nationalInsurance',
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // Detect credit cards
    this.cardPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const cardNumber = match[0].replace(/[\s-]/g, '');
        if (this.isValidLuhn(cardNumber)) {
          detectedPII.push({
            type: 'creditCard',
            value: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length
          });
        }
      }
    });

    // Sort by start index (ascending)
    detectedPII.sort((a, b) => a.startIndex - b.startIndex);

    // Remove overlaps (keep first occurrence)
    const uniquePII = [];
    let lastEndIndex = -1;
    detectedPII.forEach(pii => {
      if (pii.startIndex > lastEndIndex) {
        uniquePII.push(pii);
        lastEndIndex = pii.endIndex;
      }
    });

    return {
      detected: uniquePII.length > 0,
      pii: uniquePII,
      count: uniquePII.length
    };
  }

  /**
   * Mask PII in text
   * @param {string} text - Text to mask
   * @param {string} maskChar - Character to use for masking (default: '*')
   * @param {Array<string>} typesToMask - Types of PII to mask (default: all)
   * @returns {string} Masked text
   */
  maskPII(text, maskChar = '*', typesToMask = null) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    const detection = this.detectPII(text);
    if (!detection.detected) {
      return text;
    }

    // Filter PII types if specified
    let piiToMask = detection.pii;
    if (typesToMask && Array.isArray(typesToMask)) {
      piiToMask = detection.pii.filter(pii => typesToMask.includes(pii.type));
    }

    // Sort by start index (descending) to replace from end to start
    piiToMask.sort((a, b) => b.startIndex - a.startIndex);

    let maskedText = text;
    piiToMask.forEach(pii => {
      const originalValue = pii.value;
      let maskedValue;

      switch (pii.type) {
        case 'phone':
          // Keep first 3 and last 2 digits, mask middle
          if (originalValue.length >= 5) {
            const start = originalValue.substring(0, 3);
            const end = originalValue.substring(originalValue.length - 2);
            maskedValue = start + maskChar.repeat(Math.max(0, originalValue.length - 5)) + end;
          } else {
            maskedValue = maskChar.repeat(originalValue.length);
          }
          break;

        case 'email':
          // Keep first character and domain, mask username
          const [username, domain] = originalValue.split('@');
          if (username.length > 1) {
            maskedValue = username[0] + maskChar.repeat(Math.max(0, username.length - 1)) + '@' + domain;
          } else {
            maskedValue = maskChar + '@' + domain;
          }
          break;

        case 'postcode':
          // Keep first 2 characters, mask rest
          if (originalValue.length > 2) {
            maskedValue = originalValue.substring(0, 2) + maskChar.repeat(originalValue.length - 2);
          } else {
            maskedValue = maskChar.repeat(originalValue.length);
          }
          break;

        case 'creditCard':
          // Keep last 4 digits, mask rest
          if (originalValue.length >= 4) {
            const last4 = originalValue.replace(/[\s-]/g, '').substring(originalValue.replace(/[\s-]/g, '').length - 4);
            maskedValue = maskChar.repeat(originalValue.length - 4) + last4;
          } else {
            maskedValue = maskChar.repeat(originalValue.length);
          }
          break;

        case 'nationalInsurance':
        case 'drivingLicense':
        default:
          // Mask all but first 2 and last 2 characters
          if (originalValue.length > 4) {
            const start = originalValue.substring(0, 2);
            const end = originalValue.substring(originalValue.length - 2);
            maskedValue = start + maskChar.repeat(originalValue.length - 4) + end;
          } else {
            maskedValue = maskChar.repeat(originalValue.length);
          }
          break;
      }

      // Replace in text
      maskedText = maskedText.substring(0, pii.startIndex) + 
                   maskedValue + 
                   maskedText.substring(pii.endIndex);
    });

    return maskedText;
  }

  /**
   * Get PII summary (counts by type)
   * @param {string} text - Text to analyze
   * @returns {Object} PII summary
   */
  getPIISummary(text) {
    const detection = this.detectPII(text);
    const summary = {
      total: detection.count,
      byType: {}
    };

    detection.pii.forEach(pii => {
      summary.byType[pii.type] = (summary.byType[pii.type] || 0) + 1;
    });

    return summary;
  }
}

export default new PIIDetectionService();

