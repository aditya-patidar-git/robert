/**
 * Mobile Search Service
 * Handles mobile number validation and 3-attempt retry logic for client search
 */

/**
 * Validate UK mobile number format
 * UK mobile numbers: 11 digits starting with 07 (excluding country code +44)
 * @param {string} mobileNumber - Mobile number to validate
 * @returns {boolean} - True if valid UK mobile format
 */
export function validateUKMobile(mobileNumber) {
  if (!mobileNumber || typeof mobileNumber !== 'string') {
    return false;
  }

  // Remove spaces, dashes, parentheses, and country code
  const cleaned = mobileNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+44/, '0');
  
  // Must be 11 digits starting with 07
  const ukMobilePattern = /^07\d{9}$/;
  return ukMobilePattern.test(cleaned);
}

/**
 * Normalize UK mobile number to standard format (07XXXXXXXXX)
 * @param {string} mobileNumber - Mobile number to normalize
 * @returns {string|null} - Normalized mobile number or null if invalid
 */
export function normalizeUKMobile(mobileNumber) {
  if (!mobileNumber || typeof mobileNumber !== 'string') {
    return null;
  }

  // Remove spaces, dashes, parentheses, and country code
  const cleaned = mobileNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+44/, '0');
  
  // Validate format
  if (!/^07\d{9}$/.test(cleaned)) {
    return null;
  }

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

