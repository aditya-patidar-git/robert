/**
 * Verification Service
 * Handles client verification attempts (7 per field) and prompt generation
 */

/**
 * Get the exact verification prompt per CRM module requirements
 * @returns {string} - Exact verification prompt text
 */
export function getVerificationPrompt() {
  return "Thanks for this; I believe that I have found your profile with us; However, for data protection purposes, could you please confirm: (1) your full name, (2) your post code, and (3) your telephone number?";
}

/**
 * Get field-specific mismatch message per CRM module requirements
 * @param {string} field - Field name: 'fullName', 'postcode', or 'telephoneNumber'
 * @returns {string} - Exact error message for the field
 */
export function getFieldMismatchMessage(field) {
  const messages = {
    fullName: "Unfortunately, the full name that you have provided does not match the one that we hold on file for you; have you changed your name, or have you perhaps previously provided a different spelling of your name to us?",
    postcode: "Unfortunately, the post code that you have provided does not match the one that we hold on file for you; have you changed your address, or have you perhaps previously provided a different postcode to us?",
    telephoneNumber: "Unfortunately, the telephone number that you have provided does not match the one that we hold on file for you; have you changed your telephone number or have you ever provided us with an alternative telephone number?"
  };

  return messages[field] || `The ${field} you provided does not match our records.`;
}

/**
 * Get max attempts exceeded message per CRM module requirements
 * @returns {string} - Exact message when max attempts exceeded
 */
export function getMaxAttemptsExceededMessage() {
  return "Unfortunately, I am unable to gain access to your existing customer profile with us; however, I can create a new profile with us for you. Would you like me to proceed in creating a new customer profile with us?";
}

/**
 * Initialize verification attempts tracking in conversation state
 * @param {object} conversation - Conversation state object
 */
export function initializeVerificationAttempts(conversation) {
  if (!conversation.verificationAttempts) {
    conversation.verificationAttempts = {
      fullName: 0,
      postcode: 0,
      telephoneNumber: 0
    };
  }
}

/**
 * Increment verification attempt count for a specific field
 * @param {object} conversation - Conversation state object
 * @param {string} field - Field name: 'fullName', 'postcode', or 'telephoneNumber'
 */
export function incrementVerificationAttempt(conversation, field) {
  initializeVerificationAttempts(conversation);
  
  if (conversation.verificationAttempts[field] !== undefined) {
    conversation.verificationAttempts[field]++;
  } else {
    conversation.verificationAttempts[field] = 1;
  }
}

/**
 * Check if max attempts (7) exceeded for any field
 * @param {object} conversation - Conversation state object
 * @returns {boolean} - True if any field has exceeded 7 attempts
 */
export function isMaxAttemptsExceeded(conversation) {
  if (!conversation.verificationAttempts) {
    return false;
  }

  const maxAttempts = 7;
  return Object.values(conversation.verificationAttempts).some(count => count >= maxAttempts);
}

/**
 * Get fields that have exceeded max attempts
 * @param {object} conversation - Conversation state object
 * @returns {Array<string>} - Array of field names that exceeded max attempts
 */
export function getExceededFields(conversation) {
  if (!conversation.verificationAttempts) {
    return [];
  }

  const maxAttempts = 7;
  const exceeded = [];

  for (const [field, count] of Object.entries(conversation.verificationAttempts)) {
    if (count >= maxAttempts) {
      exceeded.push(field);
    }
  }

  return exceeded;
}

/**
 * Get current attempt count for a specific field
 * @param {object} conversation - Conversation state object
 * @param {string} field - Field name: 'fullName', 'postcode', or 'telephoneNumber'
 * @returns {number} - Current attempt count for the field
 */
export function getVerificationAttemptCount(conversation, field) {
  if (!conversation.verificationAttempts) {
    return 0;
  }
  return conversation.verificationAttempts[field] || 0;
}

/**
 * Mark client as verified in conversation state
 * @param {object} conversation - Conversation state object
 * @param {string} method - Verification method used
 */
export function markClientVerified(conversation, method = 'fullName_postcode_telephone') {
  conversation.clientVerified = true;
  conversation.clientVerifiedAt = new Date();
  conversation.verificationMethod = method;
}

