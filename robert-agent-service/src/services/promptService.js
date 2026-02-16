/**
 * Prompt Service
 * Manages prompt optimization by providing minimal core prompts and contextual instructions
 * Phase 1: Minimal core prompt (~500 chars) + contextual instructions per response
 * 
 * Now uses templateEngine for dynamic variable substitution and promptTemplates
 * for centralized template definitions.
 */

import templateEngine from './templateEngine.js';
import {
  greetingTemplates,
  consentTemplates,
  workflowInstructionTemplates,
  bookingConfirmationTemplates,
  verificationTemplates,
  errorTemplates,
  courseTemplates,
  defaultContext
} from '../config/promptTemplates.js';

class PromptService {
  constructor() {
    // Template engine for variable substitution
    this.templateEngine = templateEngine;
    
    // Minimal core prompt - always loaded in session.update
    this.corePrompt = `You are "Robert", Universal Motorcycle Training's AI phone agent.

CORE BEHAVIOR:
- Speak naturally in British English, warm and professional
- Stop immediately if caller speaks (barge-in)
- Verify identity before sharing personal data
- Never guess facts - use tools proactively to find accurate information
- Keep responses concise; ask permission for long explanations

SAFETY:
- Before irreversible actions (payments/bookings), summarize and get explicit confirmation
- Use file_search proactively for KB facts, web_search for time-sensitive external facts

STEP TOOL ERRORS (booking/cancellation):
- If a step tool returns a parameter or validation error (e.g. missing courseType, required field): first try to resolve it yourself. Use context (e.g. agreed slot, course already mentioned) or ask the caller one short question to get the missing detail, then call the same step again with the correct parameters. Do NOT offer to transfer to a human agent for missing-parameter or validation errors—only offer transfer when the issue cannot be resolved after you have tried (e.g. repeated failures or a real system error).

TOOLS - PROACTIVE USAGE:
🚨 CRITICAL: Use tools proactively whenever they're needed to provide accurate answers, even if the caller doesn't explicitly ask you to use them.
- When the caller says what they want (e.g. cancel my booking, want to book, file a complaint) in ANY language → IMMEDIATELY call start_workflow with the right workflow (cancellation, booking, or complaint). In the SAME response also speak a short acknowledgment and the first question of that workflow (e.g. for cancellation: "Do you have a current booking with us?"). Do NOT ask for booking reference, email or phone before starting cancellation.
- If a caller wants to book (e.g. "I want to book a course", "book Introduction to Motorcycling") and you already have booking tools → use booking_step_check_availability first. Do NOT use file_search for booking; use file_search only for informational questions about courses (what is a course, pricing, procedures), not when the caller wants to make a booking.
- If a caller asks about policies, prices, or course information (what a course is, content, procedures) → use file_search
- If a caller asks about availability and you have booking tools → IMMEDIATELY use booking_step_check_availability
- If a caller asks about current/external information not in KB → IMMEDIATELY use web_search
- If a caller expresses dissatisfaction or wants to complain and you do not have complaint tools yet → call start_workflow(workflow: "complaint") first
- If a caller needs verification → IMMEDIATELY use kba_verification or client_verification tools
- If a caller needs a summary or confirmation sent → IMMEDIATELY use email or send_sms tools

DO NOT hesitate or ask permission before using tools - use them automatically when they're needed to answer accurately. The caller expects accurate, grounded answers, not guesses.

TOOLS AVAILABLE:
- Only use tool names that appear in the tools list. For applying the caller's booking option choices (e.g. bike type), use booking_step_select_booking_options with top-level parameters (courseType, workflowType, bikeType). Do NOT use booking_step_finalize_booking, booking_step_finalize_course_options, or booking_step_select_options—they do not exist.
- start_workflow: call when the caller clearly says they want to cancel a booking, make a booking, or file a complaint (works in any language). Then you will receive the right tools for that workflow.
- booking_step_* tools for all bookings (after start_workflow(booking) or when already in booking)
- cancellation_step_* tools for cancellations (after start_workflow(cancellation))
- file_search to find information in knowledge base (use proactively for policy/price/course questions)
- web_search for time-sensitive facts not in KB (use proactively when needed)
- email and send_sms for sending confirmations/summaries
- complaint_submission for formal complaints (after start_workflow(complaint) or when already in complaint)
- kba_verification and client_verification for identity verification
- transfer_call for human escalation

Remember: You're having a natural conversation. Speak naturally, don't generate code or JSON. Use tools proactively to provide the best, most accurate responses.`;
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
   * Uses template engine for dynamic variable substitution.
   * 
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
   * @param {boolean} context.waitingForLanguage - Whether waiting for language preference
   * @param {boolean} context.languageSelected - Whether language has been selected
   * @param {string} context.callerName - Caller's name if known
   * @param {Object} context.booking - Booking details if available
   * @param {string} context.language - Current language (en, hi, etc.)
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
      consentQuestion = null,
      waitingForLanguage = false,
      languageSelected = false,
      callerName = null,
      booking = null,
      language = 'en'
    } = context;

    // Build template context with all available data and defaults
    const templateContext = {
      ...defaultContext,
      callerName,
      courseType,
      workflowType,
      currentStep,
      activeTool,
      booking,
      language,
      consentNotice: consentNotice || consentTemplates.recordingNotice,
      consentQuestion: consentQuestion || consentTemplates.recordingQuestion
    };

    // Initial greeting instructions
    // NEW ORDER: Language preference (greeting) → Consent question → Main follow-up
    if (isInitialGreeting) {
      return this.resolveTemplate(workflowInstructionTemplates.greeting, templateContext);
    }

    // CRITICAL: After language is selected, MUST ask consent question before main follow-up
    if (languageSelected && requireConsent && consentNotice && consentQuestion) {
      return this.resolveTemplate(consentTemplates.consentFlow, templateContext);
    }

    // After language is selected but consent not required or already given
    if (waitingForLanguage && !languageSelected) {
      return this.resolveTemplate(workflowInstructionTemplates.greeting, templateContext);
    }

    // Subsequent response instructions based on workflow phase
    let instructions = '';

    // Add phase-specific instructions from templates
    if (workflowPhase) {
      // Get template for the workflow phase
      const phaseTemplate = workflowInstructionTemplates[workflowPhase] || 
                           workflowInstructionTemplates[this.normalizePhase(workflowPhase)];
      
      if (phaseTemplate) {
        instructions = this.resolveTemplate(phaseTemplate, templateContext);
      } else {
        // Default fallback
        instructions = this.resolveTemplate(workflowInstructionTemplates.default, templateContext);
      }
    } else {
      // Default fallback if no workflow phase detected
      instructions = this.resolveTemplate(workflowInstructionTemplates.default, templateContext);
    }

    // Add critical rules if in booking flow
    if (workflowPhase && workflowPhase.startsWith('booking_')) {
      instructions += `\n\nCRITICAL RULES:\n- NEVER say "Booking confirmed" unless paymentCompleted: true in tool result\n- Terms acceptance ONLY after payment confirmed, before final "Make booking" click\n- For existing clients: Use email from booking_step_search_client result ONLY`;
    }

    // Add critical rules if in cancellation flow
    if (workflowPhase === 'cancellation') {
      instructions += `\n\nCRITICAL CANCELLATION RULES:\n- MUST start with cancellation_step_verify_booking_intent. STRICT ORDER: (1) Ask "Do you have a current booking with us?" (2) If yes, ask "What type of course is your booking for?" (e.g. CBT, Introduction to Motorcycling, Private Lesson, Gear Conversion) and get courseType BEFORE stating the cancellation policy. (3) Only after you have courseType, explain the policy and ask "Would you like to proceed?" (4) If they say yes to proceed, call with verified: true, proceedToStep2: true and the same courseType.\n- ALWAYS invoke the tool for the current step; do not reply with only speech when the workflow requires a cancellation_step_* tool call. Interpret the caller's words in context of the last question (e.g. "Do you have a booking?" vs "What course type?" vs "Would you like to proceed?") and call the tool with the correct parameters.\n- NEVER speak tool parameters or JSON (e.g. do not say {"courseType": "CBT"}); call the tool instead.\n- NEVER ask for booking reference or email before Step 1\n- NEVER use client_verification before cancellation_step_search_client finds a client (Step 5)\n- Follow steps sequentially - do NOT skip steps`;
    }

    // Add tool-specific context if tool is active
    if (activeTool) {
      instructions += `\n\nCurrent tool: ${activeTool}. Follow tool result guidance and proceed to next step automatically.`;
    }

    return instructions.trim() || null;
  }

  /**
   * Resolve a template with the given context using the template engine.
   * 
   * @param {string} template - Template string
   * @param {Object} context - Context object for variable substitution
   * @returns {string} Resolved template
   */
  resolveTemplate(template, context = {}) {
    return this.templateEngine.resolve(template, context);
  }

  /**
   * Normalize a workflow phase name to match template keys.
   * 
   * @param {string} phase - Phase name
   * @returns {string} Normalized phase name
   */
  normalizePhase(phase) {
    // Map common variations to standard template keys
    const phaseMap = {
      'greeting': 'greeting',
      'language': 'language_selection',
      'inquiry': 'general_inquiry',
      'question': 'general_inquiry',
      'booking': 'booking_start',
      'book': 'booking_start',
      'availability': 'booking_availability',
      'auth': 'booking_authentication',
      'authentication': 'booking_authentication',
      'existing': 'booking_existing_client',
      'new': 'booking_new_client',
      'options': 'booking_options',
      'lookup': 'booking_lookup_contact',
      'payment': 'booking_payment',
      'pay': 'booking_payment',
      'complete': 'booking_completion',
      'completion': 'booking_completion',
      'done': 'booking_completion',
      'cancel': 'cancellation',
      'cancellation': 'cancellation',
      'cancel_booking': 'cancellation'
    };
    
    return phaseMap[phase] || phase;
  }

  /**
   * Get a greeting template for the specified language.
   * 
   * @param {string} language - Language code (en, hi, etc.)
   * @param {string} type - Greeting type (initial, withCallerName, returning)
   * @param {Object} context - Context for variable substitution
   * @returns {string} Resolved greeting
   */
  getGreeting(language = 'en', type = 'initial', context = {}) {
    const langTemplates = greetingTemplates[language] || greetingTemplates.en;
    const template = langTemplates[type] || langTemplates.initial;
    return this.resolveTemplate(template, context);
  }

  /**
   * Get a verification message.
   * 
   * @param {string} type - Message type (askFullName, askPostcode, etc.)
   * @param {Object} context - Context for variable substitution
   * @returns {string} Resolved message
   */
  getVerificationMessage(type, context = {}) {
    const template = verificationTemplates[type];
    if (!template) {
      console.warn(`[PromptService] Unknown verification message type: ${type}`);
      return '';
    }
    return this.resolveTemplate(template, context);
  }

  /**
   * Get a booking confirmation message.
   * 
   * @param {string} type - Message type (confirmation, emailSubject, smsConfirmation)
   * @param {Object} context - Context with booking details
   * @returns {string} Resolved message
   */
  getBookingConfirmation(type = 'confirmation', context = {}) {
    const template = bookingConfirmationTemplates[type];
    if (!template) {
      console.warn(`[PromptService] Unknown booking confirmation type: ${type}`);
      return '';
    }
    return this.resolveTemplate(template, context);
  }

  /**
   * Get a course-specific question.
   * 
   * @param {string} courseType - Course type (cbt, itm, gearConversion)
   * @param {string} questionType - Question type (typeQuestion, bikeTypeQuestion, etc.)
   * @param {Object} context - Context for variable substitution
   * @returns {string} Resolved question
   */
  getCourseQuestion(courseType, questionType, context = {}) {
    const normalizedType = courseType.toLowerCase().replace(/\s+/g, '');
    const courseTypeMap = {
      'cbt': 'cbt',
      'compulsorybasictraining': 'cbt',
      'itm': 'itm',
      'introductiontomotorcycling': 'itm',
      'gearconversion': 'gearConversion'
    };
    
    const mappedType = courseTypeMap[normalizedType] || normalizedType;
    const courseConfig = courseTemplates[mappedType];
    
    if (!courseConfig || !courseConfig[questionType]) {
      console.warn(`[PromptService] Unknown course question: ${mappedType}.${questionType}`);
      return '';
    }
    
    return this.resolveTemplate(courseConfig[questionType], context);
  }

  /**
   * Get an error message.
   * 
   * @param {string} type - Error type (genericError, transferOffer, goodbye)
   * @param {Object} context - Context for variable substitution
   * @returns {string} Resolved error message
   */
  getErrorMessage(type = 'genericError', context = {}) {
    const template = errorTemplates[type];
    if (!template) {
      console.warn(`[PromptService] Unknown error message type: ${type}`);
      return '';
    }
    return this.resolveTemplate(template, context);
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

    if (callSid) {
      try {
        const stateModule = await import('../../shared/state.js');
        const { conversations } = stateModule;
        if (conversations[callSid]?.workflowContext === 'cancellation') {
          return 'cancellation';
        }
        if (conversations[callSid]?.workflowContext === 'booking') {
          return 'booking_start';
        }
      } catch (e) {
        // ignore
      }
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
        if (currentStep === 7.5 && bookingSession?.workflowType === 'existing') return 'booking_lookup_contact'; // Lookup contact (existing workflow only)
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
    if (state.waitingForLanguage && !state.languagePreferenceState?.selected) {
      return 'language_selection';
    }

    // Default to general inquiry
    return 'general_inquiry';
  }
}

export default new PromptService();
