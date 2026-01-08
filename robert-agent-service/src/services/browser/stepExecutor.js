/**
 * Step Executor
 * Executes step logic using commonBookingSteps functions
 * Verifies browser state before/after execution
 * Handles errors and state recovery
 */

import * as commonSteps from '../commonBookingSteps/index.js';
import { takeScreenshot } from '../commonBookingSteps/utils.js';

export class StepExecutor {
  constructor(screenshotsDir = './screenshots') {
    this.screenshotsDir = screenshotsDir;
  }

  /**
   * Execute a step by name
   * @param {string} stepName - Step name (from STEP_NAMES)
   * @param {Object} page - Playwright page object
   * @param {Object} args - Step arguments
   * @param {Object} sessionState - Current session state
   * @returns {Promise<Object>} Step execution result
   */
  async executeStep(stepName, page, args, sessionState) {
    try {
      // Verify browser state before execution
      await this.verifyBrowserStateBefore(page, stepName, sessionState);

      // Execute step based on step name
      let result;
      switch (stepName) {
        case 'checkAvailability':
          result = await this.executeCheckAvailability(page, args, sessionState);
          break;
        case 'authenticate':
          result = await this.executeAuthenticate(page, args, sessionState);
          break;
        case 'navigateContacts':
          result = await this.executeNavigateContacts(page, args, sessionState);
          break;
        case 'searchClient':
          result = await this.executeSearchClient(page, args, sessionState);
          break;
        case 'selectSession':
          result = await this.executeSelectSession(page, args, sessionState);
          break;
        case 'selectBookingOptions':
          result = await this.executeSelectBookingOptions(page, args, sessionState);
          break;
        case 'createNewContact':
          result = await this.executeCreateNewContact(page, args, sessionState);
          break;
        case 'fillContactDetails':
          result = await this.executeFillContactDetails(page, args, sessionState);
          break;
        case 'processPayment':
          result = await this.executeProcessPayment(page, args, sessionState);
          break;
        case 'sendPaymentRequest':
          result = await this.executeSendPaymentRequest(page, args, sessionState);
          break;
        case 'sendConfirmation':
          result = await this.executeSendConfirmation(page, args, sessionState);
          break;
        case 'sendTerms':
          result = await this.executeSendTerms(page, args, sessionState);
          break;
        case 'sendSMS':
          result = await this.executeSendSMS(page, args, sessionState);
          break;
        default:
          throw new Error(`Unknown step name: ${stepName}`);
      }

      // Verify browser state after execution
      await this.verifyBrowserStateAfter(page, stepName, result);

      return result;
    } catch (error) {
      console.error(`❌ [STEP_EXECUTOR] Error executing step ${stepName}:`, error);
      
      // Take screenshot on error
      try {
        await takeScreenshot(page, `error_${stepName}_${Date.now()}.png`, this.screenshotsDir);
      } catch (screenshotError) {
        console.warn('⚠️ Failed to take error screenshot:', screenshotError.message);
      }

      return {
        success: false,
        error: error.message,
        stepName
      };
    }
  }

  /**
   * Verify browser state before step execution
   * @param {Object} page - Playwright page object
   * @param {string} stepName - Step name
   * @param {Object} sessionState - Session state
   */
  async verifyBrowserStateBefore(page, stepName, sessionState) {
    // Basic checks - can be enhanced with step-specific verification
    if (!page || page.isClosed()) {
      throw new Error('Page is closed or not available');
    }

    // Wait for page to be ready
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch (error) {
      console.warn(`⚠️ [STEP_EXECUTOR] Page load timeout for ${stepName}, continuing anyway`);
    }
  }

  /**
   * Verify browser state after step execution
   * @param {Object} page - Playwright page object
   * @param {string} stepName - Step name
   * @param {Object} result - Step execution result
   */
  async verifyBrowserStateAfter(page, stepName, result) {
    if (!result.success) {
      // Don't verify state if step failed
      return;
    }

    // Basic check - page should still be open
    if (page.isClosed()) {
      throw new Error(`Page was closed after ${stepName} execution`);
    }
  }

  // Step execution methods

  async executeCheckAvailability(page, args, sessionState) {
    const courseType = args.courseType || sessionState?.courseType;
    
    // Use existing checkAvailabilityAndNoteDetails logic
    const preferences = {
      preferredDate: args.preferredDate,
      preferredTime: args.preferredTime,
      location: args.location,
      instructor: args.instructor
    };
    
    const result = await commonSteps.checkAvailabilityAndNoteDetails(
      page, 
      courseType, 
      this.screenshotsDir, 
      preferences
    );

    // CRITICAL FIX: Ensure selectedSlot includes course name
    let sessionDetails = result.selectedSlot;
    if (sessionDetails && !sessionDetails.course) {
      // Map courseType to actual course name
      if (courseType === 'Introduction to Motorcycling' || courseType === 'ITM') {
        sessionDetails.course = 'Introduction to Motorcycling';
      } else {
        sessionDetails.course = courseType;
      }
    }

    // Wrap result with success flag and sessionDetails
    // This ensures currentStep gets set to 1 and sessionDetails is available for next steps
    return {
      success: true,
      allSlots: result.allSlots,
      selectedSlot: result.selectedSlot,
      monthYear: result.monthYear,
      // If a slot was selected, include it as sessionDetails for next steps
      sessionDetails: sessionDetails || null
    };
  }

  async executeAuthenticate(page, args, sessionState) {
    // Use existing loginToCRM logic
    const crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: process.env.CRM_LOGIN || 'universalmct',
      username: process.env.CRM_USERNAME || 'auagent',
      password: process.env.CRM_PASSWORD || 'Robert2025!'
    };

    await commonSteps.loginToCRM(page, crmCredentials, this.screenshotsDir);

    return {
      success: true,
      authenticated: true
    };
  }

  async executeNavigateContacts(page, args, sessionState) {
    // Ensure we're on CRM dashboard first
    const currentUrl = page.url();
    if (!currentUrl.includes('takeabyte.co.uk/InContact') || currentUrl.includes('/Account/Login')) {
      console.log('🔐 [navigateContacts] Not on CRM dashboard, navigating...');
      await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }
    
    // Wait for dashboard to be fully loaded
    await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
    
    // Navigate to Contacts tab using the correct selector (h3 element, not link)
    const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")').first();
    await contactsTab.click();
    
    // WAIT FOR PAGE TO FULLY LOAD - 8 seconds (Contacts page loads in an iframe)
    console.log('⏳ [navigateContacts] Waiting for Contacts page to fully load...');
    await page.waitForTimeout(8000);
    await page.waitForLoadState('networkidle');
    
    // CRITICAL: Wait for the iframe to be present and loaded
    // The Contacts page content is inside an iframe, not in the main page
    console.log('🔍 [navigateContacts] Looking for Contacts iframe...');
    await page.waitForSelector('#contactLookup_iframe', { state: 'attached', timeout: 15000 });
    
    // Wait for the iframe content to be ready
    await page.waitForFunction(() => {
      const iframe = document.querySelector('#contactLookup_iframe');
      return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
    }, { timeout: 15000 });
    
    console.log('✅ [navigateContacts] Contacts page iframe loaded successfully');

    return {
      success: true,
      navigated: true
    };
  }

  async executeSearchClient(page, args, sessionState) {
    // Determine search type and value
    let searchType = null;
    let searchValue = null;
    let email = null;
    
    if (args.customerMobile || args.customerPhone) {
      searchType = 'mobile';
      searchValue = args.customerMobile || args.customerPhone;
    } else if (args.customerEmail) {
      searchType = 'email';
      searchValue = args.customerEmail;
      email = args.customerEmail;
    } else {
      return {
        success: false,
        error: 'Either customerMobile or customerEmail is required for client search'
      };
    }
    
    // Get callSid from args or extract from browserSessionId if available
    let callSid = args.callSid || null;
    if (!callSid && sessionState?.browserSessionId) {
      // Extract callSid from browserSessionId pattern: browser_{callSid}_{timestamp}
      const match = sessionState.browserSessionId.match(/^browser_(.+?)_\d+$/);
      if (match) {
        callSid = match[1];
      }
    }
    
    // CRITICAL FIX: Check if client was already found in a previous search attempt
    // This handles the case where a timeout occurred but the search completed successfully
    if (callSid) {
      const { conversations } = await import('../../shared/state.js');
      if (conversations[callSid]?.clientDetails) {
        console.log(`✅ [searchClient] Client already found in previous search, using existing client details`);
        return {
          success: true,
          clientDetails: conversations[callSid].clientDetails,
          requiresVerification: true,
          verificationPrompt: 'I found your profile. Can you please confirm your postcode to verify your identity?'
        };
      }
    }
    
    try {
      // Call findAndVerifyClient with correct parameters
      const result = await commonSteps.findAndVerifyClient(
        page, 
        searchType, 
        searchValue, 
        this.screenshotsDir,
        email,
        null, // clientPostcode
        callSid
      );

      // Wrap result to match expected format
      if (result.found) {
        // Store client details in conversation state for future reference
        // This prevents the "not found" error if a timeout occurs but search completes
        if (callSid) {
          const { conversations } = await import('../../shared/state.js');
          if (conversations[callSid]) {
            conversations[callSid].clientDetails = result.clientDetails;
          }
        }
        
        return {
          success: true,
          clientDetails: result.clientDetails,
          requiresVerification: result.requiresVerification,
          verificationPrompt: result.verificationPrompt
        };
      } else {
        // Only return retry prompt if we haven't exhausted attempts
        // Don't return retry prompt if client was already found (handled above)
        return {
          success: false,
          error: result.error || 'Client not found',
          retryPrompt: result.retryPrompt,
          requiresPostcodeVerification: result.requiresPostcodeVerification
        };
      }
    } catch (error) {
      // CRITICAL FIX: If timeout occurs, check if client was already found
      if (error.message && (error.message.includes('timeout') || error.message.includes('exceeded'))) {
        console.log(`⚠️ [searchClient] Timeout occurred, checking if client was already found...`);
        
        // Check if client details were stored during the search process
        if (callSid) {
          const { conversations } = await import('../../shared/state.js');
          if (conversations[callSid]?.clientDetails) {
            console.log(`✅ [searchClient] Client was found before timeout, using stored details`);
            return {
              success: true,
              clientDetails: conversations[callSid].clientDetails,
              requiresVerification: true,
              verificationPrompt: 'I found your profile. Can you please confirm your postcode to verify your identity?'
            };
          }
        }
      }
      
      // If no client found, return error
      return {
        success: false,
        error: error.message || 'Client search failed',
        retryPrompt: 'Unfortunately, I could not locate your profile with us with the provided mobile number, could you please repeat your full mobile number to me so that I can try again?'
      };
    }
  }

  async executeSelectSession(page, args, sessionState) {
    const sessionDetails = args.sessionDetails || sessionState.sessionDetails;
    
    if (!sessionDetails) {
      throw new Error('Session details are required to select a session');
    }

    // CRITICAL FIX: Ensure course and instructor are included in sessionDetails
    // If they're missing, try to get them from the courseType or sessionState
    const courseType = args.courseType || sessionState?.courseType;
    
    // Map courseType to actual course name for ITM
    if (!sessionDetails.course && courseType) {
      if (courseType === 'Introduction to Motorcycling' || courseType === 'ITM') {
        sessionDetails.course = 'Introduction to Motorcycling';
      } else {
        // For other courses, use the courseType as the course name
        sessionDetails.course = courseType;
      }
    }
    
    // If instructor is missing but was provided in preferences, use it
    if (!sessionDetails.instructor && sessionState?.preferences?.instructor) {
      sessionDetails.instructor = sessionState.preferences.instructor;
    }
    
    // If instructor is still missing, set to empty string (will match any instructor)
    if (!sessionDetails.instructor) {
      sessionDetails.instructor = '';
    }

    // Use existing navigateToDiariesAndSelectSession logic
    await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);

    return {
      success: true,
      sessionSelected: true,
      sessionDetails
    };
  }

  async executeSelectBookingOptions(page, args, sessionState) {
    const courseType = args.courseType || sessionState?.courseType;
    
    if (!courseType) {
      throw new Error('courseType is required for selectBookingOptions');
    }
    
    // Map course type to service (same as courseBookingRouter)
    const courseServiceMap = {
      'ITM': () => import('../itmBooking/selectBookingOptions.js'),
      'Introduction to Motorcycling': () => import('../itmBooking/selectBookingOptions.js'),
      'CBT': () => import('../cbtBookingService.js'),
      'Compulsory Basic Training': () => import('../cbtBookingService.js'),
      'CBT Executive': () => import('../cbtExecutiveBookingService.js'),
      'CBT Executive 1-2-1': () => import('../cbtExecutiveBookingService.js'),
      'Private Lesson': () => import('../privateLessonBookingService.js'),
      'Gear Conversion': () => import('../gearConversionBookingService.js'),
      'TfL 1-2-1': () => import('../tflOneToOneBookingService.js'),
      'TfL 1-2-1 Motorcycle Skills': () => import('../tflOneToOneBookingService.js'),
      'TfL Beyond CBT': () => import('../tflBeyondCbtBookingService.js'),
      'TfL - Beyond CBT - Skills for Delivery Riders': () => import('../tflBeyondCbtBookingService.js'),
      'Full Licence Assessment': () => import('../fullLicenceAssessmentBookingService.js'),
      'Full Motorcycle Licence Assessment': () => import('../fullLicenceAssessmentBookingService.js')
    };
    
    const serviceLoader = courseServiceMap[courseType];
    if (!serviceLoader) {
      throw new Error(`selectBookingOptions not implemented for course type: ${courseType}`);
    }
    
    // ITM uses a function, others use service class method
    if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
      const itmModule = await serviceLoader();
      const result = await itmModule.selectBookingOptions(page, args, this.screenshotsDir);
      return result;
    } else {
      // Other courses use service class with selectBookingOptions method
      const serviceModule = await serviceLoader();
      const ServiceClass = serviceModule.default;
      
      // Check if it's already an instance (some services export instances)
      let service;
      if (ServiceClass && typeof ServiceClass === 'object' && ServiceClass.selectBookingOptions) {
        // It's already an instance
        service = ServiceClass;
      } else if (ServiceClass && typeof ServiceClass === 'function') {
        // It's a class, need to instantiate
        service = new ServiceClass();
      } else {
        throw new Error(`Service for ${courseType} has invalid export structure`);
      }
      
      if (!service.selectBookingOptions) {
        throw new Error(`Service for ${courseType} does not have selectBookingOptions method`);
      }
      const result = await service.selectBookingOptions(page, args);
      return result;
    }
  }

  async executeCreateNewContact(page, args, sessionState) {
    // Use existing createNewContact logic
    await commonSteps.createNewContact(page, this.screenshotsDir);

    return {
      success: true,
      newContactCreated: true
    };
  }

  async executeFillContactDetails(page, args, sessionState) {
    const workflowType = args.workflowType || sessionState?.workflowType || 'existing';
    
    if (workflowType === 'existing') {
      // Existing client: use lookupContactAndWait to fill missing fields
      const clientEmail = args.customerEmail || args.clientDetails?.email || sessionState?.clientDetails?.email;
      if (!clientEmail) {
        throw new Error('Client email is required for contact lookup (existing client workflow)');
      }
      const clientPostcode = args.postcode || args.clientDetails?.postcode || sessionState?.clientDetails?.postcode;
      await commonSteps.lookupContactAndWait(page, clientEmail, this.screenshotsDir, clientPostcode);
    } else {
      // New client: fill all fields from scratch
      await commonSteps.fillContactDetails(page, {
        title: args.title,
        firstNames: args.firstNames || args.customerName?.split(' ')[0],
        surname: args.surname || args.customerName?.split(' ').slice(1).join(' '),
        mobileNumber: args.customerMobile || args.customerPhone,
        email: args.customerEmail,
        dateOfBirth: args.dateOfBirth,
        postcode: args.postcode,
        houseNumberOrName: args.houseNumber,
        licenceHeld: args.licenceHeld,
        nationalInsuranceNumber: args.nationalInsurance,
        drivingLicenceNumber: args.drivingLicenceNumber,
        licenceFormat: args.licenceFormat || 'GB',
        hearAboutUs: args.hearAboutUs,
        ridingExperience: args.ridingExperience,
        marketingConsent: args.marketingConsent,
        dataSharing: args.dataSharing
      }, this.screenshotsDir);
    }

    return {
      success: true,
      contactDetailsFilled: true
    };
  }

  async executeProcessPayment(page, args, sessionState) {
    // Use the updated payment handler (payment links/Twilio Pay) instead of old card details method
    const screenshots = [];
    
    // Import payment handler dynamically to avoid circular dependencies
    const { processPayment } = await import('../commonBookingSteps/paymentHandler.js');
    
    const paymentResult = await processPayment(
      page,
      {
        ...args,
        paymentMethod: args.paymentMethod || process.env.DEFAULT_PAYMENT_METHOD || 'payment_link',
        termsAccepted: args.termsAccepted !== undefined ? args.termsAccepted : true
      },
      this.screenshotsDir,
      screenshots
    );

    return {
      success: paymentResult.success,
      paymentCompleted: paymentResult.paymentCompleted || false,
      paymentMethod: paymentResult.paymentMethod,
      grandTotal: paymentResult.grandTotal,
      error: paymentResult.error
    };
  }

  async executeSendPaymentRequest(page, args, sessionState) {
    // Use sendPaymentRequest from commonBookingSteps
    const { sendPaymentRequest } = await import('../commonBookingSteps/sendPaymentRequest.js');
    
    const deliveryMethod = args.deliveryMethod; // 'email' or 'sms' (required)
    if (!deliveryMethod || (deliveryMethod !== 'email' && deliveryMethod !== 'sms')) {
      throw new Error('deliveryMethod is required and must be "email" or "sms"');
    }
    
    const clientEmail = args.clientEmail || null;
    const clientMobile = args.clientMobile || null;
    
    const result = await sendPaymentRequest(
      page,
      this.screenshotsDir,
      deliveryMethod,
      clientEmail,
      clientMobile
    );
    
    return {
      success: result.success,
      paymentCompleted: result.paymentCompleted || false,
      error: result.error,
      message: result.message
    };
  }

  async executeSendConfirmation(page, args, sessionState) {
    const courseType = args.courseType || sessionState?.courseType;
    
    // Map course type to email template type
    let emailCourseType = 'tfl';
    if (courseType === 'Full Licence Assessment' || courseType === 'Full Motorcycle Licence Assessment') {
      emailCourseType = 'full-licence';
    }
    
    // Use existing sendBookingConfirmationEmail logic
    await commonSteps.sendBookingConfirmationEmail(page, this.screenshotsDir, emailCourseType);

    return {
      success: true,
      confirmationSent: true
    };
  }

  async executeSendTerms(page, args, sessionState) {
    // Use existing sendTermsAndConditionsEmail logic
    await commonSteps.sendTermsAndConditionsEmail(page, this.screenshotsDir);

    return {
      success: true,
      termsSent: true
    };
  }

  async executeSendSMS(page, args, sessionState) {
    const courseType = args.courseType || sessionState?.courseType;
    
    // Map course type to SMS template type
    let smsCourseType = 'tfl-one-to-one';
    if (courseType === 'TfL Beyond CBT' || courseType === 'TfL - Beyond CBT - Skills for Delivery Riders') {
      smsCourseType = 'tfl-beyond-cbt';
    } else if (courseType === 'Full Licence Assessment' || courseType === 'Full Motorcycle Licence Assessment') {
      smsCourseType = 'full-licence';
    }
    
    // Use existing sendSMSConfirmation logic
    await commonSteps.sendSMSConfirmation(page, this.screenshotsDir, smsCourseType);

    return {
      success: true,
      smsSent: true
    };
  }
}

