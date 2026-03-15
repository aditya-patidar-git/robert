/**
 * Base Step Tool
 * Base class for all step-based booking tools
 * Provides common validation, browser session retrieval, and state update logic
 */

import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { StepExecutor } from '../../services/browser/stepExecutor/index.js';
import { getStepNumber, getStepName, getNextStepName, STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import { validatePreferences, generatePreferenceErrorMessage } from '../../services/browser/preferenceValidator.js';
import { BrowserManager } from '../../services/browser/browserManager.js';
import configManager from '../../agent/configManager.js';
import { conversations, updateConversation } from '../../shared/state.js';
import { storeSelectedSlot, storePreferencesBeforeAvailabilityCheck } from '../../services/commonBookingSteps/slotStorageUtils.js';

const bookingToolNameMap = {
  'checkAvailability': 'booking_step_check_availability',
  'authenticate': 'booking_step_authenticate',
  'navigateContacts': 'booking_step_navigate_contacts',
  'searchClient': 'booking_step_search_client',
  'selectSession': 'booking_step_select_session',
  'selectBookingOptions': 'booking_step_select_booking_options',
  'createNewContact': 'booking_step_create_new_contact',
  'lookupContact': 'booking_step_lookup_contact',
  'fillContactDetails': 'booking_step_fill_contact_details',
  'processPayment': 'booking_step_process_payment',
  'sendPaymentRequest': 'booking_step_send_payment_request',
  'sendConfirmation': 'booking_step_send_confirmation',
  'sendTerms': 'booking_step_send_terms',
  'sendSMS': 'booking_step_send_sms'
};

const cancellationToolNameMap = {
  'verifyBookingIntent': 'cancellation_step_verify_booking_intent',
  'authenticate': 'cancellation_step_authenticate',
  'determineWorkflow': 'cancellation_step_determine_workflow',
  'navigateContacts': 'cancellation_step_navigate_contacts',
  'searchClient': 'cancellation_step_search_client',
  'selectClient': 'cancellation_step_select_client',
  'locateBooking': 'cancellation_step_locate_booking',
  'confirmCancellation': 'cancellation_step_confirm_cancellation',
  'initiateCancellation': 'cancellation_step_initiate_cancellation',
  'fillCancellationForm': 'cancellation_step_fill_cancellation_form',
  'navigateCommunication': 'cancellation_step_navigate_communication',
  'selectTemplate': 'cancellation_step_select_template',
  'sendCancellationConfirmation': 'cancellation_step_send_confirmation',
  'voiceConfirmation': 'cancellation_step_voice_confirmation'
};

/**
 * Map step numbers to tool names; uses workflow context so shared steps (e.g. authenticate, navigateContacts) get the correct prefix.
 * @param {string} courseType - Course type
 * @param {string} workflowType - Workflow type ('existing' or 'new')
 * @param {number} stepNumber - Step number
 * @param {boolean} [isCancellationWorkflow=false] - True when the current tool is a cancellation step
 * @returns {string|null} Tool name or null if not found
 */
function getToolNameForStep(courseType, workflowType, stepNumber, isCancellationWorkflow = false) {
  const stepName = getStepName(courseType, workflowType, stepNumber);
  if (!stepName) return null;
  const map = isCancellationWorkflow ? cancellationToolNameMap : bookingToolNameMap;
  return map[stepName] || null;
}

export class BaseStepTool {
  get isCancellationWorkflow() {
    return false;
  }

  constructor() {
    this.stepExecutor = new StepExecutor();
    // Initialize browser manager
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: process.env.CRM_LOGIN || process.env.CRM_LOGIN_NAME,
      username: process.env.CRM_USERNAME,
      password: process.env.CRM_PASSWORD,
      userAgent: 'auagent'
    };
    this.browserManager = new BrowserManager(
      this.crmCredentials,
      './screenshots',
      './audit-logs'
    );
  }

  /**
   * Get step name (to be overridden by subclasses)
   * @returns {string} Step name from STEP_NAMES
   */
  getStepName() {
    throw new Error('getStepName() must be implemented by subclass');
  }

  /**
   * Get required preferences for this step (to be overridden by subclasses)
   * @returns {Array<string>} Array of required preference names
   */
  getRequiredPreferences() {
    return [];
  }

  /**
   * Check if this step is a booking-related step
   * Override in subclasses if needed
   * @returns {boolean} - True if this is a booking step
   */
  isBookingStep() {
    const stepName = this.getStepName();
    // Booking steps that create/modify bookings
    const bookingSteps = ['checkAvailability', 'selectSession', 'selectBookingOptions', 'processPayment'];
    return bookingSteps.includes(stepName);
  }

  /**
   * Check if this step requires booking confirmation
   * Override in subclasses if needed
   * @returns {boolean} - True if confirmation required
   */
  requiresBookingConfirmation() {
    const stepName = this.getStepName();
    // Steps that should require confirmation before execution
    // Note: processPayment removed - confirmation happens during payment processing (after reading terms)
    // Note: selectBookingOptions removed - CRM docs don't require confirmation for this step
    const confirmationSteps = [];
    return confirmationSteps.includes(stepName);
  }

  /**
   * Get timeout for this tool execution in milliseconds
   * Override this method to specify custom timeout for browser automation tools
   * Default is 30 seconds for all booking step tools (browser automation)
   * @returns {number|null} Timeout in ms, or null to use default/config timeout
   */
  getTimeout() {
    return 30000; // 30 seconds default for browser automation tools
  }

  /**
   * Execute the step tool
   * @param {Object} parameters - Tool parameters
   * @param {Object} callContext - Call context with callSid
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const { courseType, workflowType, ...stepArgs } = parameters;

    try {
      if (callContext.callAbortSignal?.aborted) {
        return { success: false, error: 'Call ended', callEnded: true };
      }
      console.log(`🔧 [${this.getStepName()}] Executing step for ${callSid}`);

      // Validate required parameters
      if (!courseType) {
        return {
          success: false,
          error: 'courseType is required'
        };
      }

      // Initialize or get session
      const session = sessionStateManager.initializeSession(callSid, courseType);
      
      // Determine workflow type (use provided or get from session)
      const finalWorkflowType = workflowType || session.workflowType;
      if (!finalWorkflowType && this.requiresWorkflowType()) {
        return {
          success: false,
          requiresWorkflowType: true,
          message: 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?'
        };
      }

      // Get step number from configuration
      const stepName = this.getStepName();
      const stepNumber = getStepNumber(courseType, finalWorkflowType, stepName);
      
      if (stepNumber === null) {
        return {
          success: false,
          error: `Step "${stepName}" is not valid for course type "${courseType}" and workflow type "${finalWorkflowType}"`
        };
      }

      // Validate step execution order
      const validationResult = await this.validateStepExecution(
        callSid, 
        stepNumber, 
        courseType, 
        finalWorkflowType,
        stepArgs
      );

      if (!validationResult.valid) {
        return validationResult;
      }

      // CRITICAL: If workflowType was provided in the call and validation passed,
      // it means Step 3 was asked conversationally - mark it as asked in the session
      if (workflowType && (workflowType === 'existing' || workflowType === 'new')) {
        const currentSession = sessionStateManager.getSession(callSid);
        if (currentSession && (!currentSession.workflowType || currentSession.workflowType !== workflowType)) {
          // Set workflowType in session (this also marks workflowTypeAsked as true)
          sessionStateManager.setWorkflowType(callSid, workflowType);
          console.log(`✅ [${callSid}] Workflow type set to ${workflowType} - Step 3 marked as completed`);
        }
      }

      // Check if booking is enabled (for booking-related steps)
      if (this.isBookingStep()) {
        if (!configManager.isCRMTaskEnabled('createBooking')) {
          return {
            success: false,
            error: 'BOOKING_DISABLED',
            message: 'Booking functionality is currently disabled. Please contact support for assistance.'
          };
        }

        // Check if confirmation is required (for final booking steps)
        if (this.requiresBookingConfirmation() && !stepArgs.confirmed) {
          return {
            success: false,
            requiresConfirmation: true,
            message: 'Please confirm you want to proceed with this booking before I continue.'
          };
        }
      }

      // Get or create browser session
      const page = await this.getBrowserSession(callSid, courseType);
      if (!page) {
        return {
          success: false,
          error: 'Failed to get browser session'
        };
      }

      // CRITICAL: Store preferences BEFORE Step 1 if they're provided
      // This ensures preferences are available when opening the availability table
      if (stepNumber === 1 && (stepArgs.preferredDate || stepArgs.preferredTime || stepArgs.location || stepArgs.instructor)) {
        storePreferencesBeforeAvailabilityCheck(callSid, {
          preferredDate: stepArgs.preferredDate,
          preferredTime: stepArgs.preferredTime,
          location: stepArgs.location,
          instructor: stepArgs.instructor
        });
      }

      // Merge known preferences from session with provided args
      const knownPreferences = sessionStateManager.getKnownPreferences(callSid);
      const mergedArgs = {
        ...knownPreferences,
        ...stepArgs,
        courseType,
        workflowType: finalWorkflowType,
        callSid // Include callSid for steps that need it (e.g., searchClient)
      };

      if (callContext.callAbortSignal?.aborted) {
        return { success: false, error: 'Call ended', callEnded: true };
      }
      // Execute step (pass progressCallback for path-based voice acknowledgments)
      const result = await this.stepExecutor.executeStep(
        stepName,
        page,
        mergedArgs,
        session,
        progressCallback
      );

      if (result.success) {
        if (this.isCancellationWorkflow) {
          sessionStateManager.setCancellationCurrentStep(callSid, stepNumber, result);
        } else {
          sessionStateManager.setCurrentStep(callSid, stepNumber, result);
        }
        
        // Update preferences if provided
        const preferencesToUpdate = {};
        for (const pref of this.getRequiredPreferences()) {
          if (mergedArgs[pref]) {
            preferencesToUpdate[pref] = mergedArgs[pref];
          }
        }
        if (Object.keys(preferencesToUpdate).length > 0) {
          sessionStateManager.updatePreferences(callSid, preferencesToUpdate);
        }

        // Update session details if provided
        if (result.sessionDetails) {
          sessionStateManager.setSessionDetails(callSid, result.sessionDetails);
        }

        // Store booking details if provided (from locateBooking step)
        if (result.bookingDetails) {
          sessionStateManager.setBookingDetails(callSid, result.bookingDetails);
          
          // CRITICAL: Update courseType in session if it was extracted from booking
          // This happens in cancellation workflow Step 6 (locateBooking) where courseType is determined from the booking found
          if (result.bookingDetails.courseType && result.bookingDetails.courseTypeExtracted) {
            const currentSession = sessionStateManager.getSession(callSid);
            if (currentSession && currentSession.courseType !== result.bookingDetails.courseType) {
              sessionStateManager._syncBookingSession(callSid, (session) => {
                session.courseType = result.bookingDetails.courseType;
              });
              console.log(`✅ [${callSid}] Updated session courseType to "${result.bookingDetails.courseType}" (extracted from booking)`);
            }
          }
        }

        if (this.isCancellationWorkflow && result.cancellationFee != null && result.cancellationFee !== undefined) {
          sessionStateManager.setCancellationFee(callSid, result.cancellationFee);
        }

        // CRITICAL FIX: Store availability data in conversation for Step 1 (check_availability)
        // This ensures Step 6 (select_session) can retrieve sessionDetails even if no slot was initially selected
        if (stepNumber === 1 && (result.allSlots || result.selectedSlot || result.sessionDetails)) {
          if (!conversations[callSid]) {
            conversations[callSid] = {};
          }
          conversations[callSid].lastAvailabilityCheck = {
            allSlots: result.allSlots || null,
            selectedSlot: result.selectedSlot || result.sessionDetails || null,
            sessionDetails: result.sessionDetails || result.selectedSlot || null,
            monthYear: result.monthYear || null
          };
          console.log(`✅ [${callSid}] Stored availability data in conversation.lastAvailabilityCheck (allSlots: ${result.allSlots?.length || 0}, selectedSlot: ${!!result.selectedSlot}, sessionDetails: ${!!result.sessionDetails})`);
        }

        // CRITICAL FIX: Store selected slot when user picks one (via agreedSlot/selectedSlot parameter)
        // This handles the case where user verbally selects a slot after Step 1
        if (stepArgs.agreedSlot || stepArgs.selectedSlot) {
          const selectedSlot = stepArgs.agreedSlot || stepArgs.selectedSlot;
          const allSlots = conversations[callSid]?.lastAvailabilityCheck?.allSlots || null;
          storeSelectedSlot(callSid, selectedSlot, allSlots);
        }

        // Store page reference
        sessionStateManager.setBrowserSession(callSid, page);
      }

      return result;

    } catch (error) {
      console.error(`❌ [${this.getStepName()}] Error:`, error);
      return {
        success: false,
        error: error.message,
        stepName: this.getStepName()
      };
    }
  }

  /**
   * Check if this step requires workflow type to be determined
   * @returns {boolean} True if workflow type is required
   */
  requiresWorkflowType() {
    // Steps that come after workflow type determination
    const stepsRequiringWorkflow = [
      STEP_NAMES.NAVIGATE_CONTACTS,
      STEP_NAMES.SEARCH_CLIENT,
      STEP_NAMES.CREATE_NEW_CONTACT,
      STEP_NAMES.FILL_CONTACT_DETAILS
    ];
    return stepsRequiringWorkflow.includes(this.getStepName());
  }

  /**
   * Validate step can execute with STRICT sequential ordering
   * @param {string} callSid - Call SID
   * @param {number} stepNumber - Expected step number
   * @param {string} courseType - Course type
   * @param {string} workflowType - Workflow type
   * @param {Object} stepArgs - Step arguments
   * @returns {Promise<Object>} Validation result
   */
  async validateStepExecution(callSid, stepNumber, courseType, workflowType, stepArgs) {
    const session = sessionStateManager.getSession(callSid);
    const currentStep = this.isCancellationWorkflow
      ? sessionStateManager.getCancellationCurrentStep(callSid)
      : (session?.currentStep ?? null);
    const stepHistory = this.isCancellationWorkflow
      ? sessionStateManager.getCancellationStepHistory(callSid)
      : (session?.stepHistory || []);

    // Use workflowType from session when missing so getNextStepName works (e.g. chained lookup_contact)
    const effectiveWorkflowType = workflowType || session?.workflowType;

    // STRICT: Must start with step 1
    if (currentStep === null && stepNumber !== 1) {
      const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType ?? workflowType, 1, this.isCancellationWorkflow);
      const startMessage = this.isCancellationWorkflow
        ? 'Cancellation not started. Please start with step 1 (cancellation_step_verify_booking_intent).'
        : 'Booking session not started. Please start with step 1 (checkAvailability).';
      return {
        valid: false,
        error: startMessage,
        requiresStep: 1,
        requiresTool: requiredToolName,
        autoRetryInstruction: requiredToolName
          ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input. Do NOT ask the user - just call the tool now.`
          : `CRITICAL: You MUST start with step 1 without waiting for user input.`
      };
    }

    // STRICT SEQUENTIAL VALIDATION: Only allow current step (retry) or next step
    if (currentStep !== null) {
      const currentStepName = this.getStepName();
      const workflowTypeAsked = session?.workflowTypeAsked || false;
      
      // STRICT: Step 2 (authenticate) MUST complete before ANY subsequent step
      if (currentStep < 2 && stepNumber > 2) {
        const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType ?? workflowType, 2, this.isCancellationWorkflow);
        return {
          valid: false,
          error: `Cannot execute step ${stepNumber}. Step 2 (authenticate) must complete first. Current step is ${currentStep}. Please call booking_step_authenticate first and wait for success: true.`,
          currentStep,
          requiresStep: 2,
          requiresTool: requiredToolName,
          message: 'I need to authenticate first before proceeding. Let me do that now.',
          autoRetryInstruction: requiredToolName 
            ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input. Do NOT ask the user - just call the tool now.`
            : `CRITICAL: You MUST complete step 2 (authenticate) without waiting for user input.`
        };
      }
      
      // STRICT: Step 3 (workflow type) is conversational - can only be asked AFTER Step 2
      const isStep3 = stepNumber === 3;
      if (isStep3 && currentStep < 2) {
        const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType ?? workflowType, 2, this.isCancellationWorkflow);
        return {
          valid: false,
          error: `Cannot execute step 3 (workflow type). Step 2 (authenticate) must complete first. Current step is ${currentStep}. Please call booking_step_authenticate first and wait for success: true.`,
          currentStep,
          requiresStep: 2,
          requiresTool: requiredToolName,
          message: 'I need to authenticate first before asking about your training history. Let me do that now.',
          autoRetryInstruction: requiredToolName 
            ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input. Do NOT ask the user - just call the tool now.`
            : `CRITICAL: You MUST complete step 2 (authenticate) without waiting for user input.`
        };
      }
      
      // STRICT: Steps requiring workflowType (Step 4+) MUST have workflowType determined first
      const stepsRequiringWorkflowType = [
        STEP_NAMES.NAVIGATE_CONTACTS,
        STEP_NAMES.SEARCH_CLIENT,
        STEP_NAMES.SELECT_SESSION,
        STEP_NAMES.SELECT_BOOKING_OPTIONS,
        STEP_NAMES.CREATE_NEW_CONTACT,
        STEP_NAMES.LOOKUP_CONTACT,
        STEP_NAMES.FILL_CONTACT_DETAILS,
        STEP_NAMES.PROCESS_PAYMENT
      ];
      
      const requiresWorkflowType = stepsRequiringWorkflowType.includes(currentStepName);
      
      // If currentStep is 2 and trying to call a step that requires workflowType, 
      // we MUST have asked the Step 3 question first (or provide workflowType)
      if (currentStep === 2 && requiresWorkflowType && !workflowTypeAsked) {
        if (workflowType && (workflowType === 'existing' || workflowType === 'new')) {
          // workflowType provided means Step 3 was asked conversationally - allow and mark
          sessionStateManager.setWorkflowType(callSid, workflowType);
          console.log(`✅ [${callSid}] Step 3 (workflow type question) marked as asked - workflowType provided: ${workflowType}`);
        } else {
          // No workflowType provided - block and require asking the question
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber}. Step 3 (workflow type determination) must be completed first. Please ask: "Have you done training with us before?" and wait for the caller's response before proceeding.`,
            currentStep,
            requiresStep: 3,
            requiresWorkflowType: true,
            message: 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?',
            autoRetryInstruction: `CRITICAL: You MUST ask the workflow type question conversationally: "Have you done training with us before?" Wait for the caller's response, then proceed with the appropriate workflow type (existing or new).`
          };
        }
      }
      
      // STRICT: Validate workflow-specific steps are only called in correct workflow
      if (workflowType) {
        // Existing workflow steps
        const existingWorkflowSteps = [STEP_NAMES.NAVIGATE_CONTACTS, STEP_NAMES.SEARCH_CLIENT, STEP_NAMES.LOOKUP_CONTACT];
        // New workflow steps
        const newWorkflowSteps = [STEP_NAMES.CREATE_NEW_CONTACT];
        
        if (workflowType === 'existing' && newWorkflowSteps.includes(currentStepName)) {
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (${currentStepName}). This step is only for new client workflow. Current workflow is existing.`,
            currentStep,
            requiresStep: getStepNumber(courseType, workflowType, STEP_NAMES.NAVIGATE_CONTACTS),
            message: 'This step is not applicable for existing clients. Please follow the existing client workflow.',
            autoRetryInstruction: `CRITICAL: For existing clients, you MUST use booking_step_navigate_contacts first, then booking_step_search_client.`
          };
        }
        
        if (workflowType === 'new' && existingWorkflowSteps.includes(currentStepName)) {
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (${currentStepName}). This step is only for existing client workflow. Current workflow is new.`,
            currentStep,
            requiresStep: getStepNumber(courseType, workflowType, STEP_NAMES.SELECT_SESSION),
            message: 'This step is not applicable for new clients. Please follow the new client workflow.',
            autoRetryInstruction: `CRITICAL: For new clients, you MUST use booking_step_select_session first, then booking_step_select_booking_options, then booking_step_create_new_contact.`
          };
        }
      }
      
      // STRICT: Only allow retrying current step (if previous attempt failed) or executing next step
      // Exception: Allow skipping Step 3 (conversational) if workflowType is provided and currentStep is 2
      const isStep3Skippable = currentStep === 2 && stepNumber === 4 && effectiveWorkflowType && (effectiveWorkflowType === 'existing' || effectiveWorkflowType === 'new');
      // Next step from config (e.g. 8 after 7 for existing workflow lookup_contact)
      const nextStepName = !this.isCancellationWorkflow && effectiveWorkflowType
        ? getNextStepName(courseType, effectiveWorkflowType, currentStep)
        : null;
      const nextStepNum = nextStepName ? getStepNumber(courseType, effectiveWorkflowType, nextStepName) : null;
      let isNextStep = nextStepNum !== null && stepNumber === nextStepNum;

      // Required next step from config when available, else currentStep + 1
      const effectiveNextStepNum = nextStepNum !== null ? nextStepNum : currentStep + 1;

      if (stepNumber < currentStep) {
        // STRICT: Block going backwards unless retrying a failed critical step
        const criticalPrerequisiteSteps = [2]; // Only Step 2 can be retried
        const isCriticalStep = criticalPrerequisiteSteps.includes(stepNumber);
        
        if (isCriticalStep) {
          const previousAttempt = stepHistory.find(h => h.step === stepNumber);
          const previousFailed = previousAttempt && (
            !previousAttempt.result?.success || 
            previousAttempt.result?.error?.includes('timeout') ||
            previousAttempt.result?.error?.includes('Timeout') ||
            previousAttempt.result?.error?.includes('failed')
          );
          
          // Check if dependent steps succeeded (indicating this step likely completed)
          const dependentStepsSucceeded = stepHistory.some(h => 
            h.step > stepNumber && 
            h.step >= 4 &&
            h.result?.success === true
          );
          
          if (previousFailed && !dependentStepsSucceeded) {
            console.log(`✅ [${callSid}] Allowing retry of critical step ${stepNumber} - previous attempt failed`);
            // Allow retry
          } else {
            // Block retry - step likely completed or no failure recorded
            const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType ?? workflowType, effectiveNextStepNum, this.isCancellationWorkflow);
            return {
              valid: false,
              error: `Cannot execute step ${stepNumber}. Current step is ${currentStep}. Please continue from step ${effectiveNextStepNum}.`,
              currentStep,
              requiresStep: effectiveNextStepNum,
              requiresTool: requiredToolName,
              autoRetryInstruction: requiredToolName 
                ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input. Do NOT ask the user - just call the tool now.`
                : `CRITICAL: You MUST continue with step ${effectiveNextStepNum} without waiting for user input.`
            };
          }
        } else {
          // STRICT: Block retrying non-critical steps
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType ?? workflowType, effectiveNextStepNum, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber}. Current step is ${currentStep}. Please continue from step ${effectiveNextStepNum}.`,
            currentStep,
            requiresStep: effectiveNextStepNum,
            requiresTool: requiredToolName,
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input. Do NOT ask the user - just call the tool now.`
              : `CRITICAL: You MUST continue with step ${effectiveNextStepNum} without waiting for user input.`
          };
        }
      }
      
      // STRICT: Enforce exact sequential order - only allow current step (retry) or next step
      // Exception: Allow skipping Step 3 (conversational) if workflowType is provided
      // Exception: Allow config next step (e.g. 8 after 7 for existing workflow lookup_contact)
      if (stepNumber !== currentStep && stepNumber !== currentStep + 1 && !isStep3Skippable && !isNextStep) {
        // Check if trying to skip Step 3 (conversational) - this is allowed if workflowType provided
        const isTryingToSkipStep3 = currentStep === 2 && stepNumber === 4 && effectiveWorkflowType;
        if (!isTryingToSkipStep3) {
          const requiredStepNum = effectiveNextStepNum;
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType, requiredStepNum, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot skip to step ${stepNumber}. Current step is ${currentStep}. You MUST execute steps sequentially. Please continue from step ${requiredStepNum}.`,
            currentStep,
            requiresStep: requiredStepNum,
            requiresTool: requiredToolName,
            message: `I need to complete step ${requiredStepNum} first before proceeding. Let me do that now.`,
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input. Do NOT ask the user - just call the tool now.`
              : `CRITICAL: You MUST continue with step ${requiredStepNum} without waiting for user input.`
          };
        }
      }
      
      // STRICT: Validate workflow-specific step prerequisites
      if (effectiveWorkflowType === 'existing') {
        // Existing workflow: 4→5→6→7→8→9 must be sequential
        const navigateContactsStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.NAVIGATE_CONTACTS);
        const searchClientStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.SEARCH_CLIENT);
        const selectSessionStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.SELECT_SESSION);
        const selectBookingOptionsStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.SELECT_BOOKING_OPTIONS);
        const lookupContactStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.LOOKUP_CONTACT);
        const fillContactDetailsStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.FILL_CONTACT_DETAILS);
        
        // Validate each step's prerequisites
        if (currentStepName === STEP_NAMES.SEARCH_CLIENT && navigateContactsStep !== null && currentStep < navigateContactsStep) {
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType, navigateContactsStep, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (searchClient). You must first complete step ${navigateContactsStep} (navigateContacts).`,
            currentStep,
            requiresStep: navigateContactsStep,
            requiresTool: requiredToolName,
            message: 'I need to navigate to the Contacts tab first. Let me do that now.',
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input.`
              : `CRITICAL: You MUST complete step ${navigateContactsStep} (navigateContacts) first.`
          };
        }
        
        if (currentStepName === STEP_NAMES.SELECT_SESSION && searchClientStep !== null && currentStep < searchClientStep) {
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType, searchClientStep, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (selectSession). You must first complete step ${searchClientStep} (searchClient) and client verification.`,
            currentStep,
            requiresStep: searchClientStep,
            requiresTool: requiredToolName,
            message: 'I need to search for and verify the client first. Let me do that now.',
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input.`
              : `CRITICAL: You MUST complete step ${searchClientStep} (searchClient) first.`
          };
        }
        
        if (currentStepName === STEP_NAMES.SELECT_BOOKING_OPTIONS && selectSessionStep !== null && currentStep < selectSessionStep) {
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType ?? workflowType, selectSessionStep, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (selectBookingOptions). You must first complete step ${selectSessionStep} (selectSession).`,
            currentStep,
            requiresStep: selectSessionStep,
            requiresTool: requiredToolName,
            message: 'I need to select the session first. Let me do that now.',
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input.`
              : `CRITICAL: You MUST complete step ${selectSessionStep} (selectSession) first.`
          };
        }
        
        if (currentStepName === STEP_NAMES.LOOKUP_CONTACT && selectBookingOptionsStep !== null && currentStep < selectBookingOptionsStep) {
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType, selectBookingOptionsStep, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (lookupContact). You must first complete step ${selectBookingOptionsStep} (selectBookingOptions).`,
            currentStep,
            requiresStep: selectBookingOptionsStep,
            requiresTool: requiredToolName,
            message: 'I need to select the booking options first. Let me do that now.',
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input.`
              : `CRITICAL: You MUST complete step ${selectBookingOptionsStep} (selectBookingOptions) first.`
          };
        }
        
        if (currentStepName === STEP_NAMES.FILL_CONTACT_DETAILS && lookupContactStep !== null && currentStep < lookupContactStep) {
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType, lookupContactStep, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (fillContactDetails). You must first complete step ${lookupContactStep} (lookupContact).`,
            currentStep,
            requiresStep: lookupContactStep,
            requiresTool: requiredToolName,
            message: 'I need to look up the contact first. Let me do that now.',
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input.`
              : `CRITICAL: You MUST complete step ${lookupContactStep} (lookupContact) first.`
          };
        }
      } else if (effectiveWorkflowType === 'new') {
        // New workflow: 4→5→6→7 must be sequential
        const selectSessionStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.SELECT_SESSION);
        const selectBookingOptionsStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.SELECT_BOOKING_OPTIONS);
        const createNewContactStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.CREATE_NEW_CONTACT);
        const fillContactDetailsStep = getStepNumber(courseType, effectiveWorkflowType, STEP_NAMES.FILL_CONTACT_DETAILS);
        
        // Validate each step's prerequisites
        if (currentStepName === STEP_NAMES.SELECT_BOOKING_OPTIONS && selectSessionStep !== null && currentStep < selectSessionStep) {
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType ?? workflowType, selectSessionStep, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (selectBookingOptions). You must first complete step ${selectSessionStep} (selectSession).`,
            currentStep,
            requiresStep: selectSessionStep,
            requiresTool: requiredToolName,
            message: 'I need to select the session first. Let me do that now.',
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input.`
              : `CRITICAL: You MUST complete step ${selectSessionStep} (selectSession) first.`
          };
        }
        
        if (currentStepName === STEP_NAMES.CREATE_NEW_CONTACT && selectBookingOptionsStep !== null && currentStep < selectBookingOptionsStep) {
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType, selectBookingOptionsStep, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (createNewContact). You must first complete step ${selectBookingOptionsStep} (selectBookingOptions).`,
            currentStep,
            requiresStep: selectBookingOptionsStep,
            requiresTool: requiredToolName,
            message: 'I need to select the booking options first. Let me do that now.',
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input.`
              : `CRITICAL: You MUST complete step ${selectBookingOptionsStep} (selectBookingOptions) first.`
          };
        }
        
        if (currentStepName === STEP_NAMES.FILL_CONTACT_DETAILS && createNewContactStep !== null && currentStep < createNewContactStep) {
          const requiredToolName = getToolNameForStep(courseType, effectiveWorkflowType, createNewContactStep, this.isCancellationWorkflow);
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (fillContactDetails). You must first complete step ${createNewContactStep} (createNewContact).`,
            currentStep,
            requiresStep: createNewContactStep,
            requiresTool: requiredToolName,
            message: 'I need to create the new contact first. Let me do that now.',
            autoRetryInstruction: requiredToolName 
              ? `CRITICAL: You MUST immediately call ${requiredToolName} without waiting for user input.`
              : `CRITICAL: You MUST complete step ${createNewContactStep} (createNewContact) first.`
          };
        }
      }
      
      // STRICT: If trying to skip Step 3 without workflowType (or from session), require it
      if (currentStep === 2 && stepNumber >= 4 && !effectiveWorkflowType) {
        return {
          valid: false,
          error: `Cannot proceed to step ${stepNumber}. Workflow type must be determined first. Please ask: "Have you done training with us before?" and set workflowType to "existing" or "new".`,
          currentStep,
          requiresStep: 3,
          requiresWorkflowType: true,
          message: 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?',
          autoRetryInstruction: `CRITICAL: You MUST ask the workflow type question conversationally: "Have you done training with us before?" Wait for the caller's response, then proceed with the appropriate workflow type (existing or new).`
        };
      }
    }

    // Step 1 (check_availability): Agent MUST ask date, location, and instructor preferences first; answers may all be "no preference".
    // First call with no preferences → return requiresPreferences and set flag so agent asks, then calls again. Second call with no preferences → allow.
    const hasAnyPreference = !!(stepArgs.preferredDate || stepArgs.preferredTime || stepArgs.location || stepArgs.instructor);
    if (stepNumber === 1 && !hasAnyPreference) {
      const promptSent = conversations[callSid]?.checkAvailabilityPreferencePromptSent;
      if (!promptSent) {
        if (!conversations[callSid]) conversations[callSid] = {};
        conversations[callSid].checkAvailabilityPreferencePromptSent = true;
        updateConversation(callSid, { checkAvailabilityPreferencePromptSent: true }).catch(() => {});
        return {
          valid: false,
          requiresPreferences: true,
          message: 'You MUST ask the caller these three questions before checking availability: (1) Do you have any preference for date or time? (2) Do you have any location preference? (e.g. Alperton, Croydon, Edgware, Eltham, Wimbledon, Dagenham, Hoddesdon) (3) Do you have any instructor preference? They may answer "no preference" to any or all. After you have asked and received their answers, call this tool again with courseType and their preferences (or omit/null for no preference).'
        };
      }
    }

    // CRITICAL FIX: For selectBookingOptions, defer preference validation until AFTER navigation
    // This ensures the agent is on the booking options page before asking for preferences
    // The step will navigate to the page first, then check preferences and return requiresPreferences if needed
    const isSelectBookingOptions = this.getStepName() === STEP_NAMES.SELECT_BOOKING_OPTIONS;

    if (!isSelectBookingOptions) {
      // For all other steps, validate preferences BEFORE execution
      const requiredPrefs = this.getRequiredPreferences();
      if (requiredPrefs.length > 0) {
        const validationResult = validatePreferences(
          this.getStepName(),
          courseType,
          stepArgs
        );

        if (!validationResult.valid) {
          const errorMessage = generatePreferenceErrorMessage(validationResult, courseType);
          return {
            valid: false,
            requiresPreferences: true,
            missingPreferences: validationResult.missingPreferences,
            invalidPreferences: validationResult.invalidPreferences.map(p => p.preference),
            validOptions: validationResult.validOptions,
            message: errorMessage
          };
        }
      }
    } else {
      // For selectBookingOptions, preferences will be validated AFTER navigation
      // This ensures we're on the booking options page before asking for preferences
      console.log(`⏭️ [${this.getStepName()}] Deferring preference validation until after navigation to booking options page`);
    }

    return { valid: true };
  }

  /**
   * Get or create browser session
   * @param {string} callSid - Call SID
   * @param {string} courseType - Course type
   * @returns {Promise<Object>} Playwright page object
   */
  async getBrowserSession(callSid, courseType) {
    // Check if we have a stored page reference
    let page = sessionStateManager.getBrowserSession(callSid);
    
    // Safety check: Verify page is a valid Playwright Page object before calling isClosed()
    // pageRef may be null or invalid if retrieved from Twilio Sync (non-serializable objects are removed)
    const isValidPage = page && typeof page === 'object' && typeof page.isClosed === 'function';
    
    if (isValidPage && !page.isClosed()) {
      console.log(`✅ [${this.getStepName()}] Reusing existing browser page`);
      return page;
    }

    // Page not found or invalid - create a new callSid-specific page
    const getSessionStart = Date.now();
    console.log(`🌐 [${this.getStepName()}] Creating new browser page for callSid ${callSid}`);
    
    // Get authenticated context (major source of delay on first use)
    const getContextStart = Date.now();
    const context = await this.browserManager.getContext();
    console.log(`⏱️ [${this.getStepName()}] getContext took ${Date.now() - getContextStart}ms`);
    
    // Always create a new callSid-specific page (don't reuse shared authenticatedPage)
    page = await context.newPage();
    await page.goto('https://takeabyte.co.uk/InContact', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    await page.waitForTimeout(200); // Brief stability before login check
    
    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/Account/Login')) {
      // Need to login
      const { loginToCRM } = await import('../../services/commonBookingSteps/index.js');
      await loginToCRM(page, this.crmCredentials, './screenshots');
    }
    
    // Restore state based on current step
    const currentStep = sessionStateManager.getCurrentStep(callSid);
    if (currentStep !== null && currentStep >= 4) {
      // Step 4+ means we should be on Contacts page
      console.log(`🔄 [${this.getStepName()}] Restoring Contacts page state (current step: ${currentStep})`);
      try {
        await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
        const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")').first();
        await contactsTab.click();
        await page.waitForSelector('#contactLookup_iframe', { state: 'attached', timeout: 30000 });
        await page.waitForFunction(() => {
          const iframe = document.querySelector('#contactLookup_iframe');
          return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
        }, { timeout: 30000 });
        console.log(`✅ [${this.getStepName()}] Contacts page restored`);
      } catch (error) {
        console.warn(`⚠️ [${this.getStepName()}] Failed to restore Contacts page:`, error.message);
      }
    }

    // Store page reference in session (callSid-specific)
    sessionStateManager.setBrowserSession(callSid, page);

    console.log(`⏱️ [${this.getStepName()}] getBrowserSession total took ${Date.now() - getSessionStart}ms`);
    return page;
  }
}

