/**
 * Lookup Contact Step Executor
 * Handles existing contact lookup (booking form after select_booking_options).
 * Uses mobile from Step 4 (verified client) or email; no email required.
 * CRM Smart search supports telephone number, email, or name (per crm_modules).
 */

import { conversations } from '../../../../shared/state.js';
import * as commonSteps from '../../../commonBookingSteps/index.js';

/**
 * Normalize UK mobile for search (digits only, 0 or 44 prefix)
 */
function normalizeMobile(value) {
  if (!value || typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  if (digits.length === 12 && digits.startsWith('44')) return '0' + digits.slice(2);
  if (digits.length === 11) return digits;
  return value.replace(/\s/g, '').trim();
}

/**
 * Execute lookupContact step
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state (bookingSession)
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeLookupContact(page, args, sessionState, screenshotsDir) {
  const callSid = args.callSid || null;
  const conversation = callSid ? conversations[callSid] : null;
  const clientDetails = conversation?.clientDetails || sessionState?.clientDetails;

  // Prefer mobile from Step 4 (verified client); fallback to email
  const mobile = args.customerMobile || clientDetails?.telephoneNumber || sessionState?.customerMobile;
  const email = args.customerEmail || sessionState.customerEmail || clientDetails?.email;

  const normalizedMobile = mobile ? normalizeMobile(mobile) : '';
  const hasMobile = normalizedMobile.length >= 10;
  const hasEmail = email && String(email).trim().length > 0 && String(email).includes('@');
  const nameFragment = args.customerName || clientDetails?.nameFragment || sessionState?.customerName;
  const hasName = nameFragment && String(nameFragment).trim().length >= 2;

  if (!hasMobile && !hasEmail && !hasName) {
    return {
      success: false,
      error: 'Contact lookup requires mobile (from Step 4), email, or name fragment. None was available.',
      stepName: 'lookupContact'
    };
  }

  // Prefer mobile, then email, then name (escalation order)
  let searchValue, searchType;
  if (hasMobile) {
    searchValue = normalizedMobile;
    searchType = 'mobile';
  } else if (hasEmail) {
    searchValue = (email || '').trim();
    searchType = 'email';
  } else {
    searchValue = String(nameFragment).trim().replace(/\s+/g, ' ');
    searchType = 'name';
  }

  const postcode = args.postcode || sessionState.postcode || clientDetails?.postcode;

  // Do not click Next here: stay on client details so fill_contact_details can check required fields
  // (e.g. National Insurance) and only then click Next to payment.
  await commonSteps.lookupContactAndWait(page, searchValue, searchType, screenshotsDir, postcode, true);

  return {
    success: true,
    contactLookedUp: true
  };
}
