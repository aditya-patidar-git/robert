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

    // Wrap result with success flag and sessionDetails
    // This ensures currentStep gets set to 1 and sessionDetails is available for next steps
    return {
      success: true,
      allSlots: result.allSlots,
      selectedSlot: result.selectedSlot,
      monthYear: result.monthYear,
      // If a slot was selected, include it as sessionDetails for next steps
      sessionDetails: result.selectedSlot || null
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
    // Use existing findAndVerifyClient logic
    const result = await commonSteps.findAndVerifyClient(page, {
      customerMobile: args.customerMobile || args.customerPhone,
      customerEmail: args.customerEmail,
      customerName: args.customerName
    }, this.screenshotsDir);

    return result;
  }

  async executeSelectSession(page, args, sessionState) {
    const sessionDetails = args.sessionDetails || sessionState.sessionDetails;
    
    if (!sessionDetails) {
      throw new Error('Session details are required to select a session');
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
      const service = new ServiceClass();
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
    // Payment involves multiple steps: select payment option, method, fill card, accept terms
    // Use existing step functions
    const screenshots = [];
    await commonSteps.selectPaymentOption(page, this.screenshotsDir);
    await commonSteps.selectPaymentMethod(page, this.screenshotsDir);
    
    if (args.cardNumber) {
      await commonSteps.fillCardDetails(page, {
        cardNumber: args.cardNumber,
        expiryDate: args.expiryDate,
        cvv: args.cvv,
        cardholderName: args.cardholderName
      }, this.screenshotsDir, screenshots);
    }
    
    // Accept terms and make booking
    const result = await commonSteps.acceptTermsAndMakeBooking(
      page, 
      this.screenshotsDir, 
      args.termsAccepted !== false, // Default to true if not explicitly false
      false // Don't skip make booking
    );

    return {
      success: result.success,
      paymentCompleted: result.success || false,
      grandTotal: result.grandTotal
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

