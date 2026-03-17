/**
 * Mobile Search Service
 * Handles mobile number validation and 3-attempt retry logic for client search
 */

/**
 * Normalize input so 10-digit UK numbers (from JSON number or stripped leading 0) become 11-digit 07 format.
 * Model/API may send 7223456789 (number or string); we convert to 07123456789.
 * @param {string|number} mobileNumber - Raw mobile value (may be number, so leading 0 is lost)
 * @returns {string} - Digits only; 10 digits starting with 7 become 0 + digits
 */
function toUKMobileString(mobileNumber) {
  if (mobileNumber == null) return '';
  const str = String(mobileNumber).trim();
  const cleaned = str.replace(/[\s\-\(\)]/g, '').replace(/^\+44/, '0').replace(/\D/g, '');
  // 10 digits starting with 7 → UK mobile without leading 0 (e.g. from JSON number)
  if (cleaned.length === 10 && cleaned.startsWith('7')) {
    return '0' + cleaned;
  }
  return cleaned;
}

/**
 * Validate UK mobile number format
 * UK mobile numbers: 11 digits starting with 07 (excluding country code +44)
 * Accepts string or number (model may send number, losing leading 0).
 * @param {string|number} mobileNumber - Mobile number to validate
 * @returns {boolean} - True if valid UK mobile format
 */
export function validateUKMobile(mobileNumber) {
  const cleaned = toUKMobileString(mobileNumber);
  if (!cleaned) return false;
  const ukMobilePattern = /^07\d{9}$/;
  return ukMobilePattern.test(cleaned);
}

/**
 * Normalize UK mobile number to standard format (07XXXXXXXXX)
 * Accepts string or number (model may send number, losing leading 0).
 * @param {string|number} mobileNumber - Mobile number to normalize
 * @returns {string|null} - Normalized mobile number or null if invalid
 */
export function normalizeUKMobile(mobileNumber) {
  const cleaned = toUKMobileString(mobileNumber);
  if (!cleaned) return null;
  if (!/^07\d{9}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Get retry prompt message based on attempt count
 * @param {number} attemptCount - Current attempt count (1-3)
 * @returns {string} - Exact prompt message per CRM module requirements
 */
export function getMobileSearchRetryPrompt(attemptCount) {
  switch (attemptCount) {
    case 1:
      return "Unfortunately, I could not locate your profile with us with the provided mobile number, could you please repeat your full mobile number to me so that I can try again?";
    case 2:
      return "Unfortunately, I could not locate your profile with us with the provided mobile number, do you have or did you have an alternative phone number so that I can try again?";
    case 3:
      return "I could not locate your customer profile with us with the provided mobile phone number, could you please provide me with your full email address?";
    default:
      return "I could not locate your customer profile with us with the provided mobile phone number, could you please provide me with your full email address?";
  }
}

/**
 * Track mobile search attempt in conversation state
 * @param {object} conversation - Conversation state object
 * @param {string} mobileNumber - Mobile number attempted
 */
export function trackMobileSearchAttempt(conversation, mobileNumber) {
  if (!conversation.mobileSearchAttempts) {
    conversation.mobileSearchAttempts = {
      count: 0,
      lastAttempt: null,
      values: [],
      lastAttemptTime: null
    };
  }

  conversation.mobileSearchAttempts.count++;
  conversation.mobileSearchAttempts.lastAttempt = mobileNumber;
  conversation.mobileSearchAttempts.values.push(mobileNumber);
  conversation.mobileSearchAttempts.lastAttemptTime = new Date();
}

/**
 * Check if mobile search attempts are exhausted (3 attempts)
 * @param {object} conversation - Conversation state object
 * @returns {boolean} - True if 3 attempts have been made
 */
export function isMobileSearchExhausted(conversation) {
  if (!conversation.mobileSearchAttempts) {
    return false;
  }
  return conversation.mobileSearchAttempts.count >= 3;
}

/**
 * Get current mobile search attempt count
 * @param {object} conversation - Conversation state object
 * @returns {number} - Current attempt count (0-3)
 */
export function getMobileSearchAttemptCount(conversation) {
  if (!conversation.mobileSearchAttempts) {
    return 0;
  }
  return conversation.mobileSearchAttempts.count;
}

