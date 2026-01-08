/**
 * Base Step Tool
 * Base class for all step-based booking tools
 * Provides common validation, browser session retrieval, and state update logic
 */

import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { StepExecutor } from '../../services/browser/stepExecutor.js';
import { getStepNumber, STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import { validatePreferences, generatePreferenceErrorMessage } from '../../services/browser/preferenceValidator.js';
import { BrowserManager } from '../../services/browser/browserManager.js';
import configManager from '../../agent/configManager.js';

export class BaseStepTool {
  constructor() {
    this.stepExecutor = new StepExecutor();
    // Initialize browser manager
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: process.env.CRM_LOGIN || 'universalmct',
      username: process.env.CRM_USERNAME || 'auagent',
      password: process.env.CRM_PASSWORD || 'Robert2025!',
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
    // Note: selectBookingOptions removed - CRM docs don't require confirmation for this step
    const confirmationSteps = ['processPayment'];
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

      // Merge known preferences from session with provided args
      const knownPreferences = sessionStateManager.getKnownPreferences(callSid);
      const mergedArgs = {
        ...knownPreferences,
        ...stepArgs,
        courseType,
        workflowType: finalWorkflowType,
        callSid // Include callSid for steps that need it (e.g., searchClient)
      };

      // Execute step
      const result = await this.stepExecutor.executeStep(
        stepName,
        page,
        mergedArgs,
        session
      );

      // Update session state on success
      if (result.success) {
        sessionStateManager.setCurrentStep(callSid, stepNumber, result);
        
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
   * Validate step can execute
   * @param {string} callSid - Call SID
   * @param {number} stepNumber - Expected step number
   * @param {string} courseType - Course type
   * @param {string} workflowType - Workflow type
   * @param {Object} stepArgs - Step arguments
   * @returns {Promise<Object>} Validation result
   */
  async validateStepExecution(callSid, stepNumber, courseType, workflowType, stepArgs) {
    const session = sessionStateManager.getSession(callSid);
    const currentStep = session?.currentStep;

    // If no current step, must start from step 1
    if (currentStep === null && stepNumber !== 1) {
      return {
        valid: false,
        error: `Booking session not started. Please start with step 1 (checkAvailability).`,
        requiresStep: 1
      };
    }

    // Check if step is in correct order (allow same step for retry, or next step)
    if (currentStep !== null) {
      // CRITICAL: For ALL courses, Step 2 (authenticate) MUST complete before ANY subsequent step can be called
      // This prevents asking workflow type (Step 3) or any other step before authentication completes
      if (currentStep < 2 && stepNumber > 2) {
        return {
          valid: false,
          error: `Cannot execute step ${stepNumber}. Step 2 (authenticate) must complete first. Current step is ${currentStep}. Please call booking_step_authenticate first and wait for success: true.`,
          currentStep,
          requiresStep: 2,
          message: 'I need to authenticate first before proceeding. Let me do that now.'
        };
      }
      
      // CRITICAL: For ALL courses, Step 3 (workflow type determination) is conversational and can ONLY be asked AFTER Step 2 completes
      // This validation ensures workflow type question is not asked before authentication
      const isStep3 = stepNumber === 3;
      if (isStep3 && currentStep < 2) {
        return {
          valid: false,
          error: `Cannot execute step 3 (workflow type). Step 2 (authenticate) must complete first. Current step is ${currentStep}. Please call booking_step_authenticate first and wait for success: true.`,
          currentStep,
          requiresStep: 2,
          message: 'I need to authenticate first before asking about your training history. Let me do that now.'
        };
      }
      
      // CRITICAL: For ALL courses, Step 3 (workflow type determination) MUST be asked conversationally
      // before allowing Step 4 (navigate_contacts) or any step that requires workflowType
      // Even if workflowType is provided in the call, we must verify Step 3 was asked
      const workflowTypeAsked = session?.workflowTypeAsked || false;
      
      // Check if we're trying to call a step that requires workflowType (Step 4+)
      const stepsRequiringWorkflowType = [
        STEP_NAMES.NAVIGATE_CONTACTS,
        STEP_NAMES.SEARCH_CLIENT,
        STEP_NAMES.SELECT_SESSION,
        STEP_NAMES.SELECT_BOOKING_OPTIONS,
        STEP_NAMES.CREATE_NEW_CONTACT,
        STEP_NAMES.FILL_CONTACT_DETAILS,
        STEP_NAMES.PROCESS_PAYMENT
      ];
      
      const currentStepName = this.getStepName();
      const requiresWorkflowType = stepsRequiringWorkflowType.includes(currentStepName);
      
      // If currentStep is 2 and trying to call a step that requires workflowType, 
      // we MUST have asked the Step 3 question first
      // FIX: If workflowType is provided in the call, it means the agent asked the question conversationally
      // and is now providing the answer - allow it and mark workflowTypeAsked as true
      if (currentStep === 2 && requiresWorkflowType && !workflowTypeAsked) {
        // If workflowType is provided in the call, it means Step 3 was asked conversationally
        // Allow the call and mark workflowTypeAsked as true
        if (workflowType && (workflowType === 'existing' || workflowType === 'new')) {
          // Mark that Step 3 was asked conversationally by setting workflowType in session
          // This also sets workflowTypeAsked to true
          sessionStateManager.setWorkflowType(callSid, workflowType);
          console.log(`✅ [${callSid}] Step 3 (workflow type question) marked as asked - workflowType provided: ${workflowType}`);
          // Continue with validation - don't block this call
        } else {
          // No workflowType provided - block and require asking the question
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber}. Step 3 (workflow type determination) must be completed first. Please ask: "Have you done training with us before?" and wait for the caller's response before proceeding. Even if you think you know the workflow type, you MUST ask the question first.`,
            currentStep,
            requiresStep: 3,
            requiresWorkflowType: true,
            message: 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?'
          };
        }
      }
      
      if (stepNumber < currentStep) {
        return {
          valid: false,
          error: `Cannot execute step ${stepNumber}. Current step is ${currentStep}. Please continue from step ${currentStep + 1}.`,
          currentStep,
          requiresStep: currentStep + 1
        };
      }
      
      // CRITICAL FIX: Prevent calling selectBookingOptions (STEP 7) before selectSession (STEP 6) completes
      // For ITM existing workflow: STEP 6 is selectSession, STEP 7 is selectBookingOptions
      // For ITM new workflow: STEP 4 is selectSession, STEP 5 is selectBookingOptions
      // Reuse currentStepName from above (already declared at line 316)
      const isSelectBookingOptions = currentStepName === STEP_NAMES.SELECT_BOOKING_OPTIONS;
      
      if (isSelectBookingOptions) {
        // Check if selectSession has been completed
        const selectSessionStepNumber = getStepNumber(courseType, workflowType, STEP_NAMES.SELECT_SESSION);
        if (selectSessionStepNumber !== null && currentStep < selectSessionStepNumber) {
          return {
            valid: false,
            error: `Cannot execute step ${stepNumber} (selectBookingOptions). You must first complete step ${selectSessionStepNumber} (selectSession). Please call booking_step_select_session first.`,
            currentStep,
            requiresStep: selectSessionStepNumber,
            message: `I need to select the session first before asking about bike type preferences. Let me do that now.`
          };
        }
      }
      
      // Allow executing current step again (for retry) or next step
      // CRITICAL FIX: Check if the next step actually exists for this course type
      // For non-ITM courses, Step 3 doesn't exist as a tool, but workflowType must be determined conversationally
      const isITM = courseType === 'Introduction to Motorcycling' || courseType === 'ITM';
      const nextStepNumber = currentStep + 1;
      let nextStepExists = false;
      
      // Check if next step exists - check both workflow types if workflowType is not provided
      const workflowsToCheck = workflowType ? [workflowType] : ['existing', 'new'];
      const allStepNames = Object.values(STEP_NAMES);
      
      for (const wfType of workflowsToCheck) {
        for (const stepName of allStepNames) {
          const foundStepNumber = getStepNumber(courseType, wfType, stepName);
          if (foundStepNumber === nextStepNumber) {
            nextStepExists = true;
            break;
          }
        }
        if (nextStepExists) break;
      }
      
      // For ITM: Step 3 is conversational, can be skipped if workflowType is provided
      // For non-ITM: Step 3 doesn't exist, can be skipped if workflowType is provided
      const isStep3Skippable = isITM && currentStep === 2 && stepNumber >= 4 && workflowType;
      const canSkipNonExistentStep = !nextStepExists && workflowType && stepNumber > currentStep + 1;
      
      if (stepNumber > currentStep + 1 && !isStep3Skippable && !canSkipNonExistentStep) {
        return {
          valid: false,
          error: `Cannot skip to step ${stepNumber}. Current step is ${currentStep}. Please continue from step ${currentStep + 1}.`,
          currentStep,
          requiresStep: currentStep + 1
        };
      }
      
      // CRITICAL: For ALL courses (not just ITM), if trying to skip a non-existent step without workflowType, require it
      // This ensures workflow type is determined conversationally before proceeding
      // This applies when: currentStep is 2, trying to go to step 4+, next step doesn't exist, and workflowType is missing
      if (!nextStepExists && currentStep === 2 && stepNumber >= 4 && !workflowType) {
        return {
          valid: false,
          error: `Cannot proceed to step ${stepNumber}. Workflow type must be determined first. Please ask: "Have you done training with us before?" and set workflowType to "existing" or "new".`,
          currentStep,
          requiresStep: nextStepNumber,
          requiresWorkflowType: true,
          message: 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?'
        };
      }
      
      // If trying to skip step 3 for ITM but workflowType is missing, require it
      // (This is a duplicate check for ITM, but kept for clarity and backward compatibility)
      if (isITM && currentStep === 2 && stepNumber >= 4 && !workflowType) {
        return {
          valid: false,
          error: `Cannot proceed to step ${stepNumber}. Workflow type must be determined first. Please ask: "Have you done training with us before?" and set workflowType to "existing" or "new".`,
          currentStep,
          requiresStep: 3,
          requiresWorkflowType: true,
          message: 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?'
        };
      }
    }

    // Validate preferences
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
    
    if (page && !page.isClosed()) {
      console.log(`✅ [${this.getStepName()}] Reusing existing browser page`);
      return page;
    }

    // Get page from browser manager
    console.log(`🌐 [${this.getStepName()}] Getting browser session from BrowserManager`);
    
    // Get authenticated context
    const context = await this.browserManager.getContext();
    
    // Get or create authenticated page
    const authenticatedPage = this.browserManager.getAuthenticatedPage();
    if (authenticatedPage && !authenticatedPage.isClosed()) {
      page = authenticatedPage;
    } else {
      // Create new page from context
      page = await context.newPage();
      await page.goto('https://takeabyte.co.uk/InContact', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      await page.waitForTimeout(2000);
      
      // Check if redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('/Account/Login')) {
        // Need to login
        const { loginToCRM } = await import('../../services/commonBookingSteps/index.js');
        await loginToCRM(page, this.crmCredentials, './screenshots');
      } else {
        // Store as authenticated page
        this.browserManager.setAuthenticatedPage(page);
      }
    }

    // Store page reference in session
    sessionStateManager.setBrowserSession(callSid, page);

    return page;
  }
}

