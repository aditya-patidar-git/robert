/**
 * Prompt Service
 * Manages prompt optimization by providing minimal core prompts and contextual instructions
 * Phase 1: Minimal core prompt (~500 chars) + contextual instructions per response
 */

class PromptService {
  constructor() {
    // Minimal core prompt - always loaded in session.update
    this.corePrompt = `You are "Robert", Universal Motorcycle Training's AI phone agent.

CORE BEHAVIOR:
- Speak naturally in British English, warm and professional
- Stop immediately if caller speaks (barge-in)
- Verify identity before sharing personal data
- Never guess facts - use tools or ask/clarify
- Keep responses concise; ask permission for long explanations

SAFETY:
- Before irreversible actions (payments/bookings), summarize and get explicit confirmation
- Use file_search for KB facts, web_search for time-sensitive external facts

TOOLS:
- Use booking_step_* tools for all bookings (preferred, step-based)
- Use file_search to find information in knowledge base
- Use web_search only for time-sensitive facts not in KB

Remember: You're having a natural conversation. Speak naturally, don't generate code or JSON.`;
  }

  /**
   * Get minimal core prompt for session.update
   * This replaces the 100k+ character prompt to prevent model overwhelm
   */
  getCorePrompt() {
    return this.corePrompt;
  }

  /**
   * Get contextual instructions for response.create based on conversation state
   * @param {Object} context - Conversation context
   * @param {boolean} context.isInitialGreeting - Whether this is the initial greeting
   * @param {string} context.workflowPhase - Current workflow phase (greeting, booking_start, etc.)
   * @param {string} context.courseType - Course type if in booking flow
   * @param {string} context.workflowType - Workflow type (existing/new) if in booking flow
   * @param {string} context.currentStep - Current booking step if applicable
   * @param {string} context.activeTool - Currently active tool name
   * @param {boolean} context.requireConsent - Whether recording consent is required
   * @param {string} context.consentNotice - Consent notice text
   * @param {string} context.consentQuestion - Consent question text
   * @returns {string|null} Contextual instructions or null if not needed
   */
  getContextualInstructions(context = {}) {
    const {
      isInitialGreeting = false,
      workflowPhase = null,
      courseType = null,
      workflowType = null,
      currentStep = null,
      activeTool = null,
      requireConsent = false,
      consentNotice = null,
      consentQuestion = null
    } = context;

    // Initial greeting instructions
    if (isInitialGreeting) {
      if (requireConsent && consentNotice && consentQuestion) {
        return `Start the call by saying: "${consentNotice}" Then immediately ask: "${consentQuestion}" Wait for the caller's response before continuing.`;
      } else {
        return `Say hello and introduce yourself as Robert from Universal Motorcycle Training. Ask what language the caller would like to use.`;
      }
    }

    // Subsequent response instructions based on workflow phase
    let instructions = '';

    // Add phase-specific instructions
    if (workflowPhase) {
      switch (workflowPhase) {
        case 'language_selection':
          instructions = `Continue the conversation naturally. Be helpful and concise.`;
          break;

        case 'general_inquiry':
          instructions = `Help the caller with their question. Be concise and helpful. Use tools if needed to find accurate information.`;
          break;

        case 'booking_start':
          instructions = `You're starting a booking flow. Ask what type of course they need. Once they choose, use booking_step_check_availability to find available slots.`;
          break;

        case 'booking_availability':
          instructions = `Present available slots naturally. Ask about preferences: date, time, location, instructor. Once agreed on a slot, proceed to authentication step.`;
          break;

        case 'booking_authentication':
          instructions = `Authenticating with CRM (automatic). Once authenticated, ask: "Have you done training with us before?" This determines if we use existing client workflow or new client workflow.`;
          break;

        case 'booking_existing_client':
          instructions = `You're booking for an existing client. CRITICAL: Use email from booking_step_search_client result (result.clientDetails.email). NEVER use placeholder or example emails. If no email found, ask caller: "Could you please provide your email address?"

AUTOMATIC CONTINUATION: After any tool completes successfully, IMMEDIATELY acknowledge the result and proceed to the next step. Do NOT wait for the caller to prompt you. For example:
- After client_verification returns verified: true → Say "Thank you, your identity has been verified successfully. Now let me continue with your booking." and IMMEDIATELY call the next booking step (booking_step_select_session).
- After booking_step_search_client finds a client → IMMEDIATELY proceed to verification or next step.
- After booking_step_select_session completes → IMMEDIATELY proceed to select booking options.
- After booking_step_fill_contact_details completes → IMMEDIATELY proceed to payment step.`;
          break;

        case 'booking_options':
          instructions = `You're on the booking options page (SelectBookingOptions). CRITICAL WORKFLOW ORDER:

1. FIRST: Ask about course-specific options BEFORE collecting contact details:
   - For CBT courses: Ask "Which CBT type should be selected?" (e.g., Standard CBT, Executive CBT, etc.)
   - For other courses: Ask about relevant course options
   - Ask about bike type/preferences if applicable

2. ONLY AFTER collecting course options: Proceed to collect contact details (house number, address, etc.)

DO NOT ask for house number or contact details until you've collected the course-specific options (like CBT type). The workflow should be:
- Select session → Select booking options (CBT type, bike type) → Fill contact details (house number, etc.)

AUTOMATIC CONTINUATION: After booking_step_select_booking_options completes, IMMEDIATELY proceed to fill contact details step. Do NOT wait for prompts.`;
          break;

        case 'booking_new_client':
          instructions = `You're booking for a new client. Collect: name, email, mobile, postcode, house number. Use booking_step_create_new_contact, then booking_step_fill_contact_details.

AUTOMATIC CONTINUATION: After any tool completes successfully, IMMEDIATELY acknowledge the result and proceed to the next step. Do NOT wait for the caller to prompt you.`;
          break;

        case 'booking_payment':
          instructions = `Processing payment. CRITICAL: Only say "Booking confirmed" when paymentCompleted: true appears in tool result. Terms acceptance ONLY after payment is confirmed, just before clicking "Make booking" button.

AUTOMATIC CONTINUATION: After payment tools complete, IMMEDIATELY proceed to next steps (confirmation email, terms, SMS). Do NOT wait for prompts.`;
          break;

        case 'booking_completion':
          instructions = `Booking is complete. Send confirmation email and SMS if applicable. Be friendly and confirm next steps.

AUTOMATIC CONTINUATION: After sending confirmation/terms/SMS, IMMEDIATELY confirm completion with the caller. Do NOT wait for prompts.`;
          break;

        case 'booking_availability':
          instructions = `Present available slots naturally. Ask about preferences: date, time, location, instructor. Once agreed on a slot, proceed to authentication step.

AUTOMATIC CONTINUATION: After booking_step_check_availability completes, IMMEDIATELY present the slots to the caller. Do NOT wait for prompts.`;
          break;

        case 'booking_authentication':
          instructions = `Authenticating with CRM (automatic). Once authenticated, ask: "Have you done training with us before?" This determines if we use existing client workflow or new client workflow.

AUTOMATIC CONTINUATION: After booking_step_authenticate completes, IMMEDIATELY ask the workflow type question. Do NOT wait for prompts.`;
          break;

        default:
          instructions = `Respond naturally to the caller's question. Be helpful and concise.`;
      }
    } else {
      // Default fallback if no workflow phase detected
      instructions = `Respond naturally to the caller's question. Be helpful and concise. Do not generate code, JSON, or technical output - only natural spoken responses.`;
    }

    // Add critical rules if in booking flow
    if (workflowPhase && workflowPhase.startsWith('booking_')) {
      instructions += `\n\nCRITICAL RULES:\n- NEVER say "Booking confirmed" unless paymentCompleted: true in tool result\n- Terms acceptance ONLY after payment confirmed, before final "Make booking" click\n- For existing clients: Use email from booking_step_search_client result ONLY`;
    }

    // Add tool-specific context if tool is active
    if (activeTool) {
      instructions += `\n\nCurrent tool: ${activeTool}. Follow tool result guidance and proceed to next step automatically.`;
    }

    return instructions.trim() || null;
  }

  /**
   * Determine workflow phase from call state
   * This is a helper method to extract workflow phase from state manager
   * @param {Object} state - CallStateManager instance or state object
   * @param {string} callSid - Call SID for accessing booking session
   * @returns {Promise<string>} Workflow phase string
   */
  async determineWorkflowPhase(state, callSid = null) {
    // Check if initial greeting has been sent
    if (!state.hasInitialGreetingBeenSent) {
      return 'greeting';
    }

    // Try to get booking session from conversations if callSid is available
    let bookingSession = null;
    if (callSid) {
      try {
        // Use dynamic import to avoid circular dependencies
        const stateModule = await import('../../shared/state.js');
        const { conversations } = stateModule;
        bookingSession = conversations[callSid]?.bookingSession;
      } catch (e) {
        // If import fails, bookingSession will remain null
        // Don't log warning in production to avoid noise
      }
    }

    // Check if in booking flow (from booking session or state)
    const courseType = bookingSession?.courseType || state.courseType;
    if (courseType) {
      // Check current step to determine phase
      const currentStep = bookingSession?.currentStep || state.currentBookingStep;
      if (currentStep !== null && currentStep !== undefined) {
        // Map step numbers to phases
        if (currentStep === 1) return 'booking_availability';
        if (currentStep === 2) return 'booking_authentication';
        if (currentStep === 4 || currentStep === 5) return 'booking_existing_client';
        if (currentStep === 6 && bookingSession?.workflowType === 'new') return 'booking_new_client';
        if (currentStep === 7) return 'booking_options'; // Select booking options (CBT type, bike type, etc.)
        if (currentStep >= 8 && currentStep <= 9) {
          // Payment steps
          return 'booking_payment';
        }
        if (currentStep >= 10) return 'booking_completion';
      }

      // Check workflow type
      const workflowType = bookingSession?.workflowType || state.workflowType;
      if (workflowType === 'existing') {
        return 'booking_existing_client';
      } else if (workflowType === 'new') {
        return 'booking_new_client';
      }

      return 'booking_start';
    }

    // Check if waiting for language selection
    if (state.waitingForLanguage) {
      return 'language_selection';
    }

    // Default to general inquiry
    return 'general_inquiry';
  }
}

export default new PromptService();
