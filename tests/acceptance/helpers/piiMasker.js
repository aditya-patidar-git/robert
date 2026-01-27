/**
 * PII Masker
 * Reusable utility for masking PII in test logs
 * Single responsibility: PII masking only
 */

class PIIMasker {
  /**
   * Mask PII in text
   * @param {string} text - Text containing PII
   * @param {string} maskType - 'partial' or 'full' (default: 'partial')
   * @returns {string} - Masked text
   */
  maskPII(text, maskType = 'partial') {
    if (typeof text !== 'string') {
      return text || '';
    }

    let maskedText = text;

    const patterns = {
      phone: /\b(?:\+44|0)[0-9]{10,11}\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
      postcode: /\b[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}\b/g
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      maskedText = maskedText.replace(pattern, (match) => {
        switch (maskType) {
          case 'full':
            return `[${type.toUpperCase()}_REDACTED]`;
          case 'partial':
            return this.partialMask(match, type);
          default:
            return match;
        }
      });
    }

    return maskedText;
  }

  /**
   * Partially mask PII value
   * @param {string} text - PII value
   * @param {string} type - PII type
   * @returns {string} - Partially masked value
   */
  partialMask(text, type) {
    switch (type) {
      case 'phone':
        // Keep first 3 and last 2 digits
        if (text.length >= 5) {
          const cleaned = text.replace(/[^\d]/g, '');
          const start = cleaned.substring(0, 3);
          const end = cleaned.substring(cleaned.length - 2);
          return start + '***' + end;
        }
        return '***';
      
      case 'email':
        // Keep first character and domain
        const [username, domain] = text.split('@');
        if (username.length > 1) {
          return username[0] + '***@' + domain;
        }
        return '***@' + domain;
      
      case 'postcode':
        // Keep first 2 characters
        if (text.length > 2) {
          return text.substring(0, 2) + '***';
        }
        return '***';
      
      case 'creditCard':
        // Keep last 4 digits
        const cleaned = text.replace(/[\s-]/g, '');
        if (cleaned.length >= 4) {
          const last4 = cleaned.substring(cleaned.length - 4);
          return '****' + last4;
        }
        return '****';
      
      default:
        return text;
    }
  }
}

export const piiMasker = new PIIMasker();
export default piiMasker;
