/**
 * Cancellation Steps Tool Registry
 * Exports all step-based cancellation tools
 */

import verifyBookingIntentTool from './verifyBookingIntent.js';
import authenticateTool from './authenticate.js';
import determineWorkflowTool from './determineWorkflow.js';
import navigateContactsTool from './navigateContacts.js';
import searchClientTool from './searchClient.js';
import selectClientTool from './selectClient.js';
import locateBookingTool from './locateBooking.js';
import confirmCancellationTool from './confirmCancellation.js';
import initiateCancellationTool from './initiateCancellation.js';
import fillCancellationFormTool from './fillCancellationForm.js';
import navigateCommunicationTool from './navigateCommunication.js';
import selectTemplateTool from './selectTemplate.js';
import sendConfirmationTool from './sendConfirmation.js';
import voiceConfirmationTool from './voiceConfirmation.js';

// Export all tools with cancellation_step_* naming
export const cancellationStepTools = {
  'cancellation_step_verify_booking_intent': verifyBookingIntentTool,
  'cancellation_step_authenticate': authenticateTool,
  'cancellation_step_determine_workflow': determineWorkflowTool,
  'cancellation_step_navigate_contacts': navigateContactsTool,
  'cancellation_step_search_client': searchClientTool,
  'cancellation_step_select_client': selectClientTool,
  'cancellation_step_locate_booking': locateBookingTool,
  'cancellation_step_confirm_cancellation': confirmCancellationTool,
  'cancellation_step_initiate_cancellation': initiateCancellationTool,
  'cancellation_step_fill_cancellation_form': fillCancellationFormTool,
  'cancellation_step_navigate_communication': navigateCommunicationTool,
  'cancellation_step_select_template': selectTemplateTool,
  'cancellation_step_send_confirmation': sendConfirmationTool,
  'cancellation_step_voice_confirmation': voiceConfirmationTool
};

// Export individual tools for direct access
export {
  verifyBookingIntentTool,
  authenticateTool,
  determineWorkflowTool,
  navigateContactsTool,
  searchClientTool,
  selectClientTool,
  locateBookingTool,
  confirmCancellationTool,
  initiateCancellationTool,
  fillCancellationFormTool,
  navigateCommunicationTool,
  selectTemplateTool,
  sendConfirmationTool,
  voiceConfirmationTool
};
