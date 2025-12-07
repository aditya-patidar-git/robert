// Re-export all common booking steps for easy importing
export { loginToCRM } from './loginToCRM.js';
export { findAndVerifyClient } from './findAndVerifyClient.js';
export { navigateToDiariesAndSelectSession } from './navigateToDiaries.js';
export { lookupContactAndWait } from './lookupContact.js';
export { createNewContact } from './createNewContact.js';
export { fillContactDetails } from './fillContactDetails.js';
export { selectPaymentOption } from './selectPaymentOption.js';
export { selectPaymentMethod } from './selectPaymentMethod.js';
export { fillCardDetails } from './fillCardDetails.js';
export { acceptTermsAndMakeBooking } from './acceptTermsAndMakeBooking.js';
export { takeScreenshot, extractLocationIdentifier } from './utils.js';

