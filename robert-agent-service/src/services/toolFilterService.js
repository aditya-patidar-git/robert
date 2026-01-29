/**
 * Tool Filter Service
 * Single responsibility: Determine which tools are available for a given workflow phase.
 * 
 * This service maps workflow phases to allowed tool names without knowledge of tool
 * implementations. It returns tool names only, which are then filtered by the 
 * UnifiedToolExecutor to get actual definitions.
 * 
 * @module toolFilterService
 */

/**
 * Tool sets organized by workflow phase.
 * Each phase has a curated list of tools appropriate for that context.
 * Tools not in this list for a phase will not be sent to OpenAI.
 */
const TOOL_SETS = {
  // Initial greeting phase - minimal tools
  greeting: [
    'transfer_call'
  ],

  // Language selection phase - minimal tools
  language_selection: [
    'transfer_call'
  ],

  // General inquiry handling - informational tools
  general_inquiry: [
    'file_search',
    'web_search',
    'transfer_call',
    'complaint_submission',
    'email',
    'send_sms',
    'generate_reference_id'
  ],

  // Booking workflow - initial availability check
  booking_start: [
    'booking_step_check_availability',
    'file_search',
    'transfer_call'
  ],

  // Booking workflow - after availability, authentication
  booking_availability: [
    'booking_step_authenticate',
    'file_search',
    'transfer_call'
  ],

  // Booking workflow - existing client path
  booking_existing_client: [
    'booking_step_navigate_contacts',
    'booking_step_search_client',
    'booking_step_select_session',
    'booking_step_select_booking_options',
    'booking_step_lookup_contact',
    'booking_step_fill_contact_details',
    'client_verification',
    'file_search',
    'transfer_call'
  ],

  // Booking workflow - new client path
  booking_new_client: [
    'booking_step_select_session',
    'booking_step_select_booking_options',
    'booking_step_create_new_contact',
    'booking_step_fill_contact_details',
    'file_search',
    'transfer_call'
  ],

  // Booking workflow - payment phase
  booking_payment: [
    'booking_step_process_payment',
    'booking_step_send_payment_request',
    'transfer_call'
  ],

  // Booking workflow - completion/confirmation phase
  booking_completion: [
    'booking_step_send_confirmation',
    'booking_step_send_terms',
    'booking_step_send_sms',
    'email',
    'send_sms',
    'transfer_call'
  ],

  // Reschedule / update customer workflow
  booking_modification: [
    'reschedule_booking',
    'update_customer',
    'kba_verification',
    'client_verification',
    'file_search',
    'email',
    'send_sms',
    'transfer_call'
  ],

  // Cancellation workflow (step-based)
  cancellation: [
    'cancellation_step_verify_booking_intent',
    'cancellation_step_authenticate',
    'cancellation_step_determine_workflow',
    'cancellation_step_navigate_contacts',
    'cancellation_step_search_client',
    'client_verification',
    'cancellation_step_select_client',
    'cancellation_step_locate_booking',
    'cancellation_step_confirm_cancellation',
    'cancellation_step_initiate_cancellation',
    'cancellation_step_fill_cancellation_form',
    'cancellation_step_navigate_communication',
    'cancellation_step_select_template',
    'cancellation_step_send_confirmation',
    'cancellation_step_voice_confirmation',
    'transfer_call'
  ],

  // Customer verification workflow
  verification: [
    'kba_verification',
    'client_verification',
    'transfer_call'
  ],

  // Complaint handling workflow
  complaint: [
    'complaint_submission',
    'file_search',
    'email',
    'send_sms',
    'generate_reference_id',
    'transfer_call'
  ],

  // Payment-only operations (outside booking)
  payment: [
    'payments',
    'transfer_call'
  ],

  // CRM operations (admin/update)
  crm_operations: [
    'update_customer',
    'reschedule_booking',
    'kba_verification',
    'client_verification',
    'transfer_call'
  ],

  // Full access - all tools (for fallback or special cases)
  full_access: null // null means no filtering, return all tools
};

/**
 * Additional tools that can be added based on context conditions.
 * Maps condition names to additional tool names.
 */
const CONTEXTUAL_TOOLS = {
  // Add search tools when client needs to find existing bookings
  clientVerified: [
    'booking_step_search_existing_bookings'
  ],

  // Add CRM tools when admin operations are needed
  adminAccess: [
    'update_customer',
    'reschedule_booking'
  ],

  // Add legacy tools when backward compatibility is needed
  legacyMode: [
    'payments'
  ]
};

/**
 * Get the base tool names allowed for a specific workflow phase.
 * 
 * @param {string} phase - The workflow phase identifier
 * @returns {string[]|null} Array of tool names, or null for full access
 */
export function getToolNamesForPhase(phase) {
  // Return the tool set for the phase, or default to general_inquiry
  const toolSet = TOOL_SETS[phase];
  
  // If phase exists and is null, it means full access
  if (phase in TOOL_SETS && toolSet === null) {
    return null;
  }
  
  // Return the tool set or default to general_inquiry
  return toolSet || TOOL_SETS.general_inquiry;
}

/**
 * Get tools for a specific context, including any context-based additions.
 * 
 * @param {string} phase - The workflow phase identifier
 * @param {Object} additionalContext - Additional context for tool filtering
 * @param {boolean} [additionalContext.clientVerified] - Whether client identity is verified
 * @param {boolean} [additionalContext.adminAccess] - Whether admin operations are allowed
 * @param {boolean} [additionalContext.legacyMode] - Whether to include legacy tools
 * @returns {string[]|null} Array of tool names, or null for full access
 */
export function getToolsForContext(phase, additionalContext = {}) {
  const baseTools = getToolNamesForPhase(phase);
  
  // If base tools is null (full access), return null
  if (baseTools === null) {
    return null;
  }
  
  // Create a Set for deduplication
  const toolSet = new Set(baseTools);
  
  // Add contextual tools based on conditions
  for (const [condition, tools] of Object.entries(CONTEXTUAL_TOOLS)) {
    if (additionalContext[condition]) {
      tools.forEach(tool => toolSet.add(tool));
    }
  }
  
  return Array.from(toolSet);
}

/**
 * Get all available workflow phases.
 * Useful for admin interfaces or debugging.
 * 
 * @returns {string[]} Array of phase names
 */
export function getAvailablePhases() {
  return Object.keys(TOOL_SETS);
}

/**
 * Check if a tool is allowed in a specific phase.
 * 
 * @param {string} toolName - The tool name to check
 * @param {string} phase - The workflow phase
 * @param {Object} [context] - Additional context
 * @returns {boolean} True if tool is allowed
 */
export function isToolAllowedInPhase(toolName, phase, context = {}) {
  const allowedTools = getToolsForContext(phase, context);
  
  // null means full access, so all tools are allowed
  if (allowedTools === null) {
    return true;
  }
  
  return allowedTools.includes(toolName);
}

/**
 * Get the recommended phase for a given intent or action.
 * Useful for automatic phase detection.
 * 
 * @param {string} intent - The detected intent
 * @returns {string} The recommended workflow phase
 */
export function getPhaseForIntent(intent) {
  const intentToPhase = {
    // Greeting intents
    'greeting': 'greeting',
    'hello': 'greeting',
    'start': 'greeting',

    // Language intents
    'change_language': 'language_selection',
    'language': 'language_selection',

    // Booking intents
    'book': 'booking_start',
    'book_course': 'booking_start',
    'check_availability': 'booking_start',
    'availability': 'booking_start',

    // Modification intents
    'reschedule': 'booking_modification',
    'cancel': 'cancellation',
    'cancel_booking': 'cancellation',
    'cancellation': 'cancellation',
    'change_booking': 'booking_modification',

    // Inquiry intents
    'question': 'general_inquiry',
    'inquiry': 'general_inquiry',
    'information': 'general_inquiry',

    // Complaint intents
    'complaint': 'complaint',
    'issue': 'complaint',
    'problem': 'complaint',

    // Verification intents
    'verify': 'verification',
    'identity': 'verification',

    // Payment intents
    'payment': 'payment',
    'pay': 'payment',
    'refund': 'payment'
  };

  return intentToPhase[intent] || 'general_inquiry';
}

// Export for testing
export const _internal = {
  TOOL_SETS,
  CONTEXTUAL_TOOLS
};
