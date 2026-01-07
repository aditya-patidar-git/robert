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
        workflowType: finalWorkflowType
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
      if (stepNumber < currentStep) {
        return {
          valid: false,
          error: `Cannot execute step ${stepNumber}. Current step is ${currentStep}. Please continue from step ${currentStep + 1}.`,
          currentStep,
          requiresStep: currentStep + 1
        };
      }
      
      // Special handling for ITM bookings: Step 3 is conversational (workflowType determination)
      // Allow skipping step 3 if workflowType is provided
      const isITM = courseType === 'Introduction to Motorcycling' || courseType === 'ITM';
      const isStep3Skippable = isITM && currentStep === 2 && stepNumber >= 4 && workflowType;
      
      // Allow executing current step again (for retry) or next step
      // Also allow skipping step 3 for ITM if workflowType is provided
      if (stepNumber > currentStep + 1 && !isStep3Skippable) {
        return {
          valid: false,
          error: `Cannot skip to step ${stepNumber}. Current step is ${currentStep}. Please continue from step ${currentStep + 1}.`,
          currentStep,
          requiresStep: currentStep + 1
        };
      }
      
      // If trying to skip step 3 for ITM but workflowType is missing, require it
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

