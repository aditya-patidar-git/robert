/**
 * Booking Steps Tool Registry
 * Exports all step-based booking tools
 */

import checkAvailabilityTool from './checkAvailability.js';
import authenticateTool from './authenticate.js';
import navigateContactsTool from './navigateContacts.js';
import searchClientTool from './searchClient.js';
import selectSessionTool from './selectSession.js';
import selectBookingOptionsTool from './selectBookingOptions.js';
import createNewContactTool from './createNewContact.js';
import fillContactDetailsTool from './fillContactDetails.js';
import processPaymentTool from './processPayment.js';
import sendConfirmationTool from './sendConfirmation.js';
import sendTermsTool from './sendTerms.js';
import sendSMSTool from './sendSMS.js';

// Export all tools with action-based names (course-agnostic)
export const bookingStepTools = {
  'booking_step_check_availability': checkAvailabilityTool,
  'booking_step_authenticate': authenticateTool,
  'booking_step_navigate_contacts': navigateContactsTool,
  'booking_step_search_client': searchClientTool,
  'booking_step_select_session': selectSessionTool,
  'booking_step_select_booking_options': selectBookingOptionsTool,
  'booking_step_create_new_contact': createNewContactTool,
  'booking_step_fill_contact_details': fillContactDetailsTool,
  'booking_step_process_payment': processPaymentTool,
  'booking_step_send_confirmation': sendConfirmationTool,
  'booking_step_send_terms': sendTermsTool,
  'booking_step_send_sms': sendSMSTool
};

// Export individual tools for direct access
export {
  checkAvailabilityTool,
  authenticateTool,
  navigateContactsTool,
  searchClientTool,
  selectSessionTool,
  selectBookingOptionsTool,
  createNewContactTool,
  fillContactDetailsTool,
  processPaymentTool,
  sendConfirmationTool,
  sendTermsTool,
  sendSMSTool
};

