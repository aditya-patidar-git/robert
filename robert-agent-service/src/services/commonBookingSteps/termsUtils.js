/**
 * Terms and Conditions Utility
 * Single-responsibility: Handle all terms-related constants and validation logic
 * Reusable module to avoid duplication of terms text and validation logic
 */

/**
 * Terms and Conditions Text (from CRM documentation)
 * Defined ONCE here and reused everywhere (no duplication)
 */
export const TERMS_AND_CONDITIONS_TEXT = `Before, I can proceed with the booking, I must make your aware of the following:

A. On the day of your training, you must present a valid and original UK Driving Licence (or UK Driver number DVLA confirmation in case of European Driving Licences) to your instructor.

B. On the day of your training, you must wear appropriate footwear that covers the ankles for your own protection.

C. On the day of your training, you must wear a pair of denim jeans (unripped) or motorcycle trousers (for your own protection).

D. On the day of your training, you must arrive on time and at the correct location for your training.

E. By proceeding with the payment, you are agreeing to have a 30% cancellation fee in case of cancellation from your side, if it is made more than three full working days.

C. Failure to any of those will result in losing your entire booking fees and no refunds will be offered.

D. By making your booking with us, you will be bound to our Terms & Conditions. Our Terms & Conditions will be emailed to you alongside the booking confirmation of your course as soon as the payment is authorised. However, our Terms & Conditions can also be found on your website www.universalmct.co.uk/courses-prices/termsandconditions

Do you agree with the statements that I have just made?`;

/**
 * Get terms and conditions text
 * @returns {string} Full terms and conditions text
 */
export function getTermsText() {
  return TERMS_AND_CONDITIONS_TEXT;
}

/**
 * Validate terms acceptance
 * Reusable validation logic (single-responsibility)
 * @param {boolean|undefined} termsAcceptedBeforeSend - Whether terms have been accepted
 * @returns {Object} Validation result with appropriate flags
 */
export function validateTermsAcceptance(termsAcceptedBeforeSend) {
  // If undefined or false, terms must be asked
  if (termsAcceptedBeforeSend === undefined || termsAcceptedBeforeSend === false) {
    return {
      requiresTermsBeforeSend: true,
      termsText: getTermsText()
    };
  }
  
  // If explicitly false (rejected), return not accepted
  if (termsAcceptedBeforeSend === false) {
    return {
      termsNotAccepted: true,
      requiresRetry: true
    };
  }
  
  // If true, terms are accepted
  return {
    termsAccepted: true
  };
}
