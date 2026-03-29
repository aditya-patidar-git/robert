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
  defaultContext,
  midCallLanguageInstructionTemplate,
  informationalToolsGuidance,
  consentPhaseInformationalToolsNote
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
- Never guess facts — use tools when needed for accurate answers; answer from your own knowledge when you can do so accurately without a tool
- Keep responses concise; ask permission for long explanations

SAFETY:
- Before irreversible actions (payments/bookings), summarize and get explicit confirmation
- GDPR: Do NOT read back or repeat the caller's personal details on the call (e.g. full name, postcode, phone, email, NI number, licence number). STRICTLY: Never say the caller's postcode, address, name, phone number, email, NI number, or any other personal detail aloud—except one narrow case: when booking_step_fill_contact_details returns requiresAddressConfirmation (CRM auto-filled address), you may briefly say street/building and optionally town/area to orient them; never say the postcode aloud or read the full address; that exception applies only to that confirmation turn. For repeat-check turns, NEVER use phrases like "confirm it is", "is that", or embed their value in the question—ask only e.g. "Please repeat that for me—I won't say it back aloud." For licence type (licenceHeld), do not quote or embed the CRM dropdown option text when verifying—let the caller repeat without you speaking the label aloud.
- **file_search** (company knowledge / vector store): use when the caller asks informational questions likely covered by company documents (policies, GDPR, courses, pricing, procedures). Do not use it to execute booking/cancellation — use step tools for that. Do not call it for every question; answer yourself when sufficient.
- Scope guardrail: This line is strictly for Universal Motorcycle Training support. If a caller asks unrelated general topics (e.g. phones, politics, weather, celebrities), politely refuse and redirect to UMT topics/courses/policies only.
- **complaint_submission:** use only when the caller explicitly wants to file or report a formal complaint — not for general dissatisfaction unless they ask to lodge a complaint.

STEP TOOL ERRORS (booking/cancellation):
- If a step tool returns a parameter or validation error (e.g. missing courseType, required field): first try to resolve it yourself. Use context (e.g. agreed slot, course already mentioned) or ask the caller one short question to get the missing detail, then call the same step again with the correct parameters. Do NOT offer to transfer to a human agent for missing-parameter or validation errors—only offer transfer when the issue cannot be resolved after you have tried (e.g. repeated failures or a real system error).

BEFORE EVERY TOOL CALL:
- You MUST say exactly one short phrase to the caller announcing what you are about to do (e.g. "Let me check that for you.", "I'll log you in now.", "Checking availability for you."). Say that first, then call the tool. Do not call a tool without this announcement.
- During the tool run, the caller will hear short step-specific progress messages automatically (e.g. "Opening the Contacts tab.", "Waiting for results."). You do not need to announce each substep in speech—the system plays these updates for each step.

TOOLS - PROACTIVE USAGE:
🚨 CRITICAL: Use workflow and step tools whenever they are required to complete booking, cancellation, or a started complaint flow. For file_search, web_search, and complaint_submission, follow discipline below — do not invoke them on every turn.
- When the caller says what they want (e.g. cancel my booking, want to book, file a complaint) in ANY language → IMMEDIATELY call start_workflow with the right workflow (cancellation, booking, or complaint). In the SAME response also speak a short acknowledgment and the first question of that workflow (e.g. for cancellation: "Do you have a current booking with us?"). Do NOT ask for booking reference, email or phone before starting cancellation.
- If a caller wants to book (e.g. "I want to book a course") and you have booking tools → use booking_step_check_availability (and follow booking steps). Do NOT use file_search to perform booking actions; use file_search only for separate informational questions (e.g. what a course involves, pricing) when company documents would ground the answer.
- If a caller asks informational questions about policies, GDPR, courses, prices, or procedures → use file_search when the answer is likely in the knowledge base and you need grounded text; you may answer briefly yourself first if confident, then use file_search if the caller needs more detail or is unsatisfied.
- If a caller asks about availability and you have booking tools → use booking_step_check_availability (after collecting required preferences per booking phase instructions).
- If a caller asks unrelated general topics outside UMT scope, politely refuse and redirect to UMT services. Do not search the public web for non-UMT topics.
- If a caller explicitly wants to file or report a formal complaint → use complaint_submission with their details, or start_workflow(complaint) first if the complaint flow is not started. Do not use complaint_submission for vague dissatisfaction alone.
- If a caller needs verification → use kba_verification or client_verification tools
- If a caller needs a summary or confirmation sent → use email or send_sms tools

Use tools when they improve accuracy; avoid unnecessary searches on every message. If the caller is not satisfied with your answer, re-analyse and use file_search when company-grounded facts would clearly help.

TOOLS AVAILABLE:
- Only use tool names that appear in the tools list. For applying the caller's booking option choices (e.g. bike type), use booking_step_select_booking_options with top-level parameters (courseType, workflowType, bikeType). Do NOT use booking_step_finalize_booking, booking_step_finalize_course_options, or booking_step_select_options—they do not exist.
- start_workflow: call when the caller clearly says they want to cancel a booking, make a booking, or file a complaint (works in any language). Then you will receive the right tools for that workflow.
- booking_step_* tools for all bookings (after start_workflow(booking) or when already in booking)
- cancellation_step_* tools for cancellations (after start_workflow(cancellation))
- file_search: search company knowledge base for policies, GDPR, courses, pricing. Call it FIRST for any policy/course/internal question—do not answer without trying file_search.
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
      mainFollowUpQuestion = null,
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
      consentQuestion: consentQuestion || consentTemplates.recordingQuestion,
      mainFollowUpQuestion: mainFollowUpQuestion || consentTemplates.recordingMainFollowUp
    };

    // Initial greeting instructions
    // NEW ORDER: Language preference (greeting) → Consent question → Main follow-up
    if (isInitialGreeting) {
      return (
        this.resolveTemplate(workflowInstructionTemplates.greeting, templateContext) +
        '\n\n' +
        informationalToolsGuidance
      );
    }

    // CRITICAL: After language is selected, MUST ask consent question before main follow-up
    if (languageSelected && requireConsent && consentNotice && consentQuestion) {
      return (
        this.resolveTemplate(consentTemplates.consentFlow, templateContext) +
        '\n\n' +
        consentPhaseInformationalToolsNote
      );
    }

    // After language is selected but consent not required or already given
    if (waitingForLanguage && !languageSelected) {
      return (
        this.resolveTemplate(workflowInstructionTemplates.greeting, templateContext) +
        '\n\n' +
        informationalToolsGuidance
      );
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
      instructions += `\n\nCRITICAL RULES:\n- NEVER say "Booking confirmed", "you're all set", or give date/time/location summary unless paymentCompleted: true in tool result\n- There is NO tool named booking_step_confirm_booking—after select_booking_options use booking_step_lookup_contact or booking_step_create_new_contact\n- Terms acceptance ONLY after payment confirmed, before final "Make booking" click\n- For existing clients: Use email from booking_step_search_client result ONLY`;
    }

    // Add critical rules if in cancellation flow (including step-level phases)
    if (workflowPhase === 'cancellation' || workflowPhase === 'cancellation_verify' || workflowPhase === 'cancellation_confirm') {
      instructions += `\n\nCRITICAL CANCELLATION RULES:\n- MUST start with cancellation_step_verify_booking_intent. STRICT ORDER: (1) Ask "Do you have a current booking with us?" (2) If yes, ask "What type of course is your booking for?" (e.g. CBT, Introduction to Motorcycling, Private Lesson, Gear Conversion) and get courseType BEFORE stating the cancellation policy. (3) Only after you have courseType, explain the policy and ask "Would you like to proceed?" (4) If they say yes to proceed, call with verified: true, proceedToStep2: true and the same courseType.\n- ALWAYS invoke the tool for the current step; do not reply with only speech when the workflow requires a cancellation_step_* tool call. Interpret the caller's words in context of the last question (e.g. "Do you have a booking?" vs "What course type?" vs "Would you like to proceed?") and call the tool with the correct parameters.\n- NEVER speak tool parameters or JSON (e.g. do not say {"courseType": "CBT"}); call the tool instead.\n- NEVER ask for booking reference or email before Step 1\n- NEVER use client_verification before cancellation_step_search_client finds a client (Step 5)\n- Follow steps sequentially - do NOT skip steps`;
    }

    // Add tool-specific context if tool is active
    if (activeTool) {
      instructions += `\n\nCurrent tool: ${activeTool}. Follow tool result guidance and proceed to next step automatically.`;
    }

    // Mid-call language: tell model current call language so it can call set_call_language when it detects a different language from audio
    if (languageSelected && language) {
      instructions += '\n\n' + this.resolveTemplate(midCallLanguageInstructionTemplate, { ...templateContext, language });
    }

    if (workflowPhase === 'recording_consent') {
      instructions += '\n\n' + consentPhaseInformationalToolsNote;
    } else {
      instructions += '\n\n' + informationalToolsGuidance;
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
      'recording_consent': 'recording_consent',
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
   * Synchronous phase from conversation only. Use when conversation is already in hand (e.g. barge-in snapshot).
   * Authority: conversation.bookingSession is authoritative; state is used only when bookingSession is null.
   * @param {Object} conversation - conversations[callSid]
   * @param {Object} state - CallStateManager or state object
   * @returns {string|null} Workflow phase or null if not in a booking/cancellation workflow
   */
  getWorkflowPhaseFromConversation(conversation, state) {
    if (!conversation || !state?.hasInitialGreetingBeenSent) return null;
    const bookingSession = conversation?.bookingSession;
    const workflowContext = conversation?.workflowContext;

    // Only enter cancellation phase when workflowContext is explicitly 'cancellation'.
    // The old OR condition (|| cancellationCurrentStep >= 1) caused the agent to stay locked
    // in cancellation phase permanently after completion, because cancellationCurrentStep
    // is never reset. Now that workflowContext is cleared on completion, the explicit check
    // is sufficient and won't re-engage a completed cancellation.
    if (workflowContext === 'cancellation') {
      const ccStep = bookingSession?.cancellationCurrentStep;
      if (ccStep != null) {
        if (ccStep >= 1 && ccStep <= 3) return 'cancellation_verify';
        if (ccStep === 8) return 'cancellation_confirm';
      }
      return 'cancellation';
    }
    if (workflowContext === 'booking' && bookingSession) {
      const currentStep = bookingSession.currentStep;
      const workflowType = bookingSession.workflowType;
      if (currentStep !== null && currentStep !== undefined) {
        if (currentStep === 1) return 'booking_availability';
        if (currentStep === 2) return 'booking_authentication';
        if (workflowType === 'existing' && (currentStep === 4 || currentStep === 5)) return 'booking_existing_client';
        if (workflowType === 'new' && (currentStep === 4 || currentStep === 5)) return 'booking_new_client';
        if (currentStep === 6 && workflowType === 'new') return 'booking_new_client';
        if (currentStep === 6 && workflowType === 'existing') return 'booking_existing_client';
        if (currentStep === 7 && workflowType === 'existing') return 'booking_options';
        if (currentStep === 7 && workflowType === 'new') return 'booking_new_client';
        if (currentStep === 8 && workflowType === 'existing') return 'booking_lookup_contact';
        if (workflowType === 'new' && currentStep === 8) return 'booking_payment';
        if (workflowType === 'new' && currentStep >= 9) return 'booking_completion';
        if (currentStep >= 9 && currentStep <= 10) return 'booking_payment';
        if (currentStep >= 11) return 'booking_completion';
      }
      if (workflowType === 'existing') return 'booking_existing_client';
      if (workflowType === 'new') return 'booking_new_client';
      return 'booking_start';
    }
    // Only fall back to booking-phase mapping when still in an active booking workflow.
    // If workflowContext was cleared (e.g. after booking_step_send_sms completed), skip this
    // block so the agent returns to general inquiry instead of staying locked to booking_completion.
    if (bookingSession && workflowContext === 'booking') {
      const currentStep = bookingSession.currentStep ?? state.currentBookingStep;
      const wt = bookingSession.workflowType ?? state.workflowType;
      if (currentStep !== null && currentStep !== undefined) {
        if (currentStep === 1) return 'booking_availability';
        if (currentStep === 2) return 'booking_authentication';
        if (wt === 'existing' && (currentStep === 4 || currentStep === 5)) return 'booking_existing_client';
        if (wt === 'new' && (currentStep === 4 || currentStep === 5)) return 'booking_new_client';
        if (currentStep === 6 && wt === 'new') return 'booking_new_client';
        if (currentStep === 7 && wt === 'existing') return 'booking_options';
        if (currentStep === 7 && wt === 'new') return 'booking_new_client';
        if (currentStep === 8 && wt === 'existing') return 'booking_lookup_contact';
        if (wt === 'new' && currentStep === 8) return 'booking_payment';
        if (wt === 'new' && currentStep >= 9) return 'booking_completion';
        if (currentStep >= 9 && currentStep <= 10) return 'booking_payment';
        if (currentStep >= 11) return 'booking_completion';
      }
      if (wt === 'existing') return 'booking_existing_client';
      if (wt === 'new') return 'booking_new_client';
      return 'booking_start';
    }
    return null;
  }

  /**
   * Determine workflow phase from call state.
   * Authority: conversations[callSid].bookingSession is the authoritative source for phase derivation;
   * callStateManager (state) is only a tiebreaker when bookingSession is null. Do not let state override
   * conversation (e.g. if state carries currentBookingStep from an in-flight write that has not yet
   * landed in conversations[callSid], ignore state for phase).
   * @param {Object} state - CallStateManager instance or state object
   * @param {string} callSid - Call SID for accessing booking session
   * @returns {Promise<string>} Workflow phase string
   */
  async determineWorkflowPhase(state, callSid = null) {
    if (!state.hasInitialGreetingBeenSent) {
      return 'greeting';
    }

    if (callSid) {
      try {
        const stateModule = await import('../../shared/state.js');
        const { conversations } = stateModule;
        const conv = conversations[callSid];
        // Authority: bookingSession in conversation overrides state; use state only when bookingSession is null
        if (conv?.workflowContext === 'cancellation') {
          const ccStep = conv?.bookingSession?.cancellationCurrentStep;
          if (ccStep != null) {
            if (ccStep >= 1 && ccStep <= 3) return 'cancellation_verify';
            if (ccStep === 8) return 'cancellation_confirm';
          }
          return 'cancellation';
        }
        // Removed: fallback based solely on cancellationCurrentStep >= 1.
        // That condition caused permanent lock-in to cancellation phase after completion
        // because cancellationCurrentStep is never reset. workflowContext === 'cancellation'
        // (handled above) is now the sole authority - it gets cleared on completion.
        if (conv?.workflowContext === 'booking') {
          const bookingSession = conv.bookingSession;
          const currentStep = bookingSession?.currentStep;
          const workflowType = bookingSession?.workflowType;
          if (currentStep !== null && currentStep !== undefined) {
            if (currentStep === 1) return 'booking_availability';
            if (currentStep === 2) return 'booking_authentication';
            if (workflowType === 'existing' && (currentStep === 4 || currentStep === 5)) return 'booking_existing_client';
            if (workflowType === 'new' && (currentStep === 4 || currentStep === 5)) return 'booking_new_client';
            if (currentStep === 6 && workflowType === 'new') return 'booking_new_client';
            if (currentStep === 6 && workflowType === 'existing') return 'booking_existing_client';
            if (currentStep === 7 && workflowType === 'existing') return 'booking_options';
            if (currentStep === 7 && workflowType === 'new') return 'booking_new_client';
            if (currentStep === 8 && workflowType === 'existing') return 'booking_lookup_contact';
            if (workflowType === 'new' && currentStep === 8) return 'booking_payment';
            if (workflowType === 'new' && currentStep >= 9) return 'booking_completion';
            if (currentStep >= 9 && currentStep <= 10) return 'booking_payment';
            if (currentStep >= 11) return 'booking_completion';
          }
          if (workflowType === 'existing') return 'booking_existing_client';
          if (workflowType === 'new') return 'booking_new_client';
          return 'booking_start';
        }
      } catch (e) {
        // ignore
      }
    }

    let bookingSession = null;
    let tiebreakerWorkflowContext = null;
    if (callSid) {
      try {
        const stateModule = await import('../../shared/state.js');
        const { conversations } = stateModule;
        bookingSession = conversations[callSid]?.bookingSession;
        tiebreakerWorkflowContext = conversations[callSid]?.workflowContext ?? null;
      } catch (e) {
        // ignore
      }
    }

    // Tiebreaker only when bookingSession is null: use state.
    // Skip step-based phase mapping when workflowContext was cleared (booking fully complete)
    // so the agent returns to general inquiry rather than staying locked to booking_completion.
    const courseType = bookingSession?.courseType || state.courseType;
    if (courseType && tiebreakerWorkflowContext === 'booking') {
      const currentStep = bookingSession?.currentStep ?? state.currentBookingStep;
      if (currentStep !== null && currentStep !== undefined) {
        if (currentStep === 1) return 'booking_availability';
        if (currentStep === 2) return 'booking_authentication';
        if (bookingSession?.workflowType === 'existing' && (currentStep === 4 || currentStep === 5)) return 'booking_existing_client';
        if (bookingSession?.workflowType === 'new' && (currentStep === 4 || currentStep === 5)) return 'booking_new_client';
        if (currentStep === 6 && bookingSession?.workflowType === 'new') return 'booking_new_client';
        if (currentStep === 7 && bookingSession?.workflowType === 'existing') return 'booking_options';
        if (currentStep === 7 && bookingSession?.workflowType === 'new') return 'booking_new_client';
        if (currentStep === 8 && bookingSession?.workflowType === 'existing') return 'booking_lookup_contact';
        if (bookingSession?.workflowType === 'new' && currentStep === 8) return 'booking_payment';
        if (bookingSession?.workflowType === 'new' && currentStep >= 9) return 'booking_completion';
        if (currentStep >= 9 && currentStep <= 10) return 'booking_payment';
        if (currentStep >= 11) return 'booking_completion';
      }
      const workflowType = bookingSession?.workflowType || state.workflowType;
      if (workflowType === 'existing') return 'booking_existing_client';
      if (workflowType === 'new') return 'booking_new_client';
      return 'booking_start';
    }

    // Check if waiting for language selection (sync conversation + state)
    const { getConversationFlowState } = await import(
      '../handlers/mediaStream/utils/conversationStateHelpers.js'
    );
    const flow = callSid ? getConversationFlowState(callSid, state) : null;
    if (flow?.waitingForLanguage && !flow?.languageSelected) {
      return 'language_selection';
    }

    // Recording consent required before any booking/complaint workflow
    if (callSid && flow?.languageSelected && !flow?.consentResponded) {
      try {
        const PrivacyConfig = (await import('../database/models/PrivacyConfig.js')).default;
        const configManager = (await import('../agent/configManager.js')).default;
        const { getEffectiveRecordingConsentSettings } = await import(
          './callRecordPersistenceService.js'
        );
        const privacySettings = await PrivacyConfig.findOne({ isActive: true }).lean().catch(() => null);
        const { consentRequired } = getEffectiveRecordingConsentSettings(
          configManager.getTelephonyConfig(),
          privacySettings
        );
        if (consentRequired) {
          return 'recording_consent';
        }
      } catch (_) {
        /* fall through */
      }
    }

    return 'general_inquiry';
  }
}

export default new PromptService();
