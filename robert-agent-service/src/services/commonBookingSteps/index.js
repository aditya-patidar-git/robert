// Re-export all common booking steps for easy importing
export { loginToCRM } from './loginToCRM.js';
export { findAndVerifyClient } from './clientSearch/index.js';
export { navigateToDiariesAndSelectSession } from './navigateToDiaries/index.js';
export { lookupContactAndWait } from './lookupContact/index.js';
export { createNewContact } from './createNewContact.js';
export {
  fillContactDetails,
  ADDRESS_CONFIRMATION_AGENT_INSTRUCTION,
  getLicenceHeldOptionsForPrompt,
  getHearAboutUsOptionsForPrompt,
  getRidingExperienceOptionsForPrompt
} from './fillContactDetails.js';
export { selectPaymentOption } from './selectPaymentOption.js';
export { selectPaymentMethod } from './selectPaymentMethod.js';
export { sendPaymentRequest } from './sendPaymentRequest.js';
export { fillCardDetails } from './fillCardDetails.js';
export { acceptTermsAndMakeBooking } from './acceptTermsAndMakeBooking.js';
export { sendBookingConfirmationEmail } from './sendBookingConfirmationEmail.js';
export { sendTermsAndConditionsEmail } from './sendTermsAndConditionsEmail.js';
export { sendSMSConfirmation } from './sendSMSConfirmation.js';
export { validateAge } from './validateAge.js';
export { takeScreenshot, extractLocationIdentifier, extractPriceFromBooking, saveAuditLog, ensureDirectories, CRM_SELECTOR_TIMEOUT_MS, CRM_IFRAME_TIMEOUT_MS, CRM_STABILITY_DELAY_MS, waitForThenOptionalDelay } from './utils.js';
export { findBooking } from './findBooking.js';
export { checkAvailabilityAndNoteDetails, getAvailabilityUrl, selectBestMatchingSlot } from './checkAvailability.js';
export { cancelBooking } from './cancelBooking.js';
export { matchSlotToAvailableSlots, storeSelectedSlot, storePreferencesBeforeAvailabilityCheck } from './slotStorageUtils.js';

