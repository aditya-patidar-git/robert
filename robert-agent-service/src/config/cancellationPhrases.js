/**
 * Cancellation workflow phrases and context
 * Single source for doc-exact phrases (reusable, no duplication)
 */

import { conversations } from '../shared/state.js';

export const TERMS_URL = 'https://universalmct.co.uk/courses-prices/termsandconditions/';
export const TERMS_DISCLAIMER = `For your information our Full Terms & Conditions are available on our website: ${TERMS_URL}`;
export const GOODBYE_CANCELLATION = 'Thank you for calling Universal Motorcycle Training, we look forward to hearing from you again soon.';
export const UNVERIFIED_CANCELLATION_MESSAGE = 'Unfortunately, I am unable to gain access to your existing customer profile with us; Please send us an email to contact@universalmct.co.uk stating your query and we shall get back to you as soon as possible.';
export const PROCEED_DECLINED_MESSAGE = 'Ok, thank you. Is there anything else that I can help you with?';

export const BEAR_WITH_ME = 'Please bear with me a moment.';
export const AFTER_LOGIN_MESSAGE = "I'll now login to the system to find your profile. Please bear with me a moment.";
export const AFTER_CONFIRM_CANCEL_MESSAGE = "I'll now cancel your booking. Please bear with me a moment.";
export const AFTER_FORM_OPENED_MESSAGE = "I've opened the cancellation form. I'm submitting it now; please bear with me.";
export const AFTER_FORM_SUBMITTED_MESSAGE = "I'm sending the cancellation confirmation email to you now; please bear with me.";

export function setCancellationContext(callSid) {
  if (callSid) {
    if (!conversations[callSid]) conversations[callSid] = {};
    conversations[callSid].workflowContext = 'cancellation';
  }
}
