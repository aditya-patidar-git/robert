// Re-export all common booking steps for easy importing
export { loginToCRM } from './loginToCRM.js';
export { findAndVerifyClient } from './clientSearch/index.js';
export { navigateToDiariesAndSelectSession } from './navigateToDiaries.js';
export { lookupContactAndWait } from './lookupContact.js';
export { createNewContact } from './createNewContact.js';
export { fillContactDetails } from './fillContactDetails.js';
export { selectPaymentOption } from './selectPaymentOption.js';
export { selectPaymentMethod } from './selectPaymentMethod.js';
export { fillCardDetails } from './fillCardDetails.js';
export { acceptTermsAndMakeBooking } from './acceptTermsAndMakeBooking.js';
export { sendBookingConfirmationEmail } from './sendBookingConfirmationEmail.js';
export { sendTermsAndConditionsEmail } from './sendTermsAndConditionsEmail.js';
export { sendSMSConfirmation } from './sendSMSConfirmation.js';
export { validateAge } from './validateAge.js';
export { takeScreenshot, extractLocationIdentifier, extractPriceFromBooking, saveAuditLog, ensureDirectories } from './utils.js';
export { findBooking } from './findBooking.js';
export { checkAvailabilityAndNoteDetails, getAvailabilityUrl, selectBestMatchingSlot } from './checkAvailability.js';
export { rescheduleBooking } from './rescheduleBooking.js';
export { cancelBooking } from './cancelBooking.js';
export { updateCustomer } from './updateCustomer.js';

