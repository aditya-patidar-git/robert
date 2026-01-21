/**
 * Email and Field Validators
 * Validates email addresses and field values
 * Preserves all validation logic
 */

/**
 * Validate email - reject example/test emails
 * @param {string} clientEmail - Email to validate
 * @throws {Error} If email is invalid
 */
export function validateEmail(clientEmail) {
  if (!clientEmail) {
    return;
  }
  
  const invalidEmailPatterns = [
    /@example\.com/i,
    /test@/i,
    /robert@example/i,
    /john@example/i,
    /placeholder@/i,
    /default@/i
  ];
  
  const isInvalid = invalidEmailPatterns.some(pattern => pattern.test(clientEmail));
  if (isInvalid) {
    throw new Error(`Invalid email detected: ${clientEmail}. Email must come from booking_step_search_client result (result.clientDetails.email) or be explicitly provided by the caller. Never use example, test, or placeholder emails.`);
  }
}
