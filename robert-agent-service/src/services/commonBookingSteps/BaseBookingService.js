import fs from 'fs';
import * as commonSteps from './index.js';
import { formatUserFriendlyError, getErrorContext } from '../../utils/errorFormatter.js';

/**
 * Base Booking Service - Abstract class providing common workflow for all course booking services
 * Uses Template Method pattern - subclasses override course-specific methods
 */
export class BaseBookingService {
  constructor(courseType, availabilityUrl, screenshotsDir) {
    this.courseType = courseType;
    this.availabilityUrl = availabilityUrl;
    this.screenshotsDir = screenshotsDir;
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: process.env.CRM_LOGIN || 'universalmct',
      username: process.env.CRM_USERNAME || 'auagent',
      password: process.env.CRM_PASSWORD || 'Robert2025!'
    };
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Main workflow execution - Template method pattern
   * Subclasses can override individual steps but this defines the overall flow
   */
  async executeBookingWorkflow(page, bookingArgs = {}, callContext = {}, cancelToken = null, executionKey = null, phaseUpdateCallback = null) {
    const screenshots = [];
    let sessionDetails = null;
    let paymentCompleted = false;

    // Helper to check for cancellation
    const checkCancellation = () => {
      if (cancelToken && cancelToken.cancelled) {
        const reason = cancelToken.reason || 'Execution cancelled';
        console.log(`🛑 [${this.courseType}] Workflow cancelled: ${reason}`);
        throw new Error(`Workflow cancelled: ${reason}`);
      }
    };

    // Helper to update phase
    const updatePhase = (phase) => {
      if (phaseUpdateCallback) {
        phaseUpdateCallback(phase);
      }
    };

    try {
      console.log(`🚀 Starting ${this.courseType} booking workflow...`);

      // STEP 1: Check availability (can be overridden by subclasses)
      updatePhase('step1_availability');
      checkCancellation();
      const step1Result = await this.step1CheckAvailability(page, bookingArgs, screenshots);
      
      if (step1Result.requiresSlotSelection) {
        return step1Result;
      }
      
      sessionDetails = step1Result.sessionDetails;

      // STEP 2: Login to CRM
      updatePhase('step2_login');
      checkCancellation();
      await this.step2Login(page, screenshots);

      // STEP 3: Determine workflow type (existing/new client)
      updatePhase('step3_workflow_type');
      checkCancellation();
      const workflowType = await this.step3DetermineWorkflowType(bookingArgs, sessionDetails);
      
      if (workflowType === 'existing') {
        // EXISTING CLIENT WORKFLOW
        return await this.executeExistingClientWorkflow(
          page, bookingArgs, callContext, sessionDetails, screenshots,
          checkCancellation, updatePhase
        );
      } else {
        // NEW CLIENT WORKFLOW
        return await this.executeNewClientWorkflow(
          page, bookingArgs, callContext, sessionDetails, screenshots,
          checkCancellation, updatePhase
        );
      }

    } catch (error) {
      // Check if this is a cancellation
      if (error.message && error.message.includes('Workflow cancelled')) {
        console.log(`🛑 [${this.courseType}] Workflow was cancelled: ${error.message}`);
        return {
          success: false,
          cancelled: true,
          message: 'Booking workflow was cancelled and replaced by a new request with complete information.',
          sessionDetails: sessionDetails,
          screenshots: screenshots
        };
      }

      console.error(`❌ ${this.courseType} booking workflow failed:`, error.message);
      screenshots.push(await commonSteps.takeScreenshot(page, 'error-state.png', this.screenshotsDir));
      
      const errorContext = getErrorContext(error, 'create_booking');
      const userFriendlyError = formatUserFriendlyError(error, errorContext);
      
      return {
        success: false,
        error: userFriendlyError,
        technicalError: error.message,
        sessionDetails: sessionDetails,
        screenshots: screenshots,
        clientEmail: bookingArgs?.customerEmail
      };
    }
  }

  /**
   * STEP 1: Check availability - Can be overridden by subclasses
   */
  async step1CheckAvailability(page, bookingArgs, screenshots) {
    // Default implementation uses common availability check
    const preferences = {
      preferredDate: bookingArgs.preferredDate,
      preferredTime: bookingArgs.preferredTime,
      location: bookingArgs.location,
      instructor: bookingArgs.instructor
    };

    // If agreedSlot is provided, use it directly
    if (bookingArgs.agreedSlot || bookingArgs.selectedSlot) {
      const sessionDetails = bookingArgs.agreedSlot || bookingArgs.selectedSlot;
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-1-availability-checked.png', this.screenshotsDir));
      return { sessionDetails, requiresSlotSelection: false };
    }

    // Check availability using common function
    const availabilityResult = await commonSteps.checkAvailabilityAndNoteDetails(
      page,
      this.courseType,
      this.screenshotsDir,
      preferences
    );

    if (!availabilityResult.selectedSlot) {
      return {
        sessionDetails: null,
        requiresSlotSelection: true,
        message: `I can see we have availability for ${this.courseType} sessions. To help you find the best slot, could you please tell me: (1) Do you have any preference for the date or time? (2) Do you have any location preference? (3) Do you have any instructor preference?`,
        allSlots: availabilityResult.allSlots,
        monthYear: availabilityResult.monthYear,
        suggestedSlot: availabilityResult.selectedSlot || null
      };
    }

    return {
      sessionDetails: availabilityResult.selectedSlot,
      requiresSlotSelection: false
    };
  }

  /**
   * STEP 2: Login to CRM - Common implementation
   */
  async step2Login(page, screenshots) {
    // Check if already logged in
    const loginIndicators = [
      'text=/Dashboard|Contacts|Diaries/i',
      'h3.list-menu-item-heading:has-text("Contacts")',
      'h3.list-menu-item-heading:has-text("Dashboard")'
    ];
    
    let isAlreadyLoggedIn = false;
    for (const selector of loginIndicators) {
      try {
        isAlreadyLoggedIn = await page.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false);
        if (isAlreadyLoggedIn) break;
      } catch (e) {
        // Continue to next indicator
      }
    }
    
    if (!isAlreadyLoggedIn) {
      console.log('🔐 Step 2: Logging into CRM...');
      const loginSuccess = await commonSteps.loginToCRM(page, this.crmCredentials, this.screenshotsDir);
      
      if (!loginSuccess) {
        throw new Error('Step 2: Login verification failed');
      }
      
      // Ensure we're on CRM dashboard
      const currentUrl = page.url();
      if (currentUrl.includes('bookcbtnow.com') || currentUrl.includes('gateway.aspx')) {
        console.log('🔐 Step 2: Navigating to CRM dashboard...');
        await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      }
      
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-login-success.png', this.screenshotsDir));
      console.log('✅ Step 2 completed: Login successful');
    } else {
      // Already logged in - ensure we're on CRM dashboard
      const currentUrl = page.url();
      if (currentUrl.includes('bookcbtnow.com') || currentUrl.includes('gateway.aspx')) {
        console.log('🔐 Step 2: Navigating to CRM dashboard...');
        await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
      } else if (currentUrl.includes('/Account/Login')) {
        await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
      }
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-already-logged-in.png', this.screenshotsDir));
      console.log('✅ Step 2: Already authenticated');
    }
  }

  /**
   * STEP 3: Determine workflow type (existing/new client) - Can be overridden
   */
  async step3DetermineWorkflowType(bookingArgs, sessionDetails) {
    // Default: use workflowType from bookingArgs, fallback to 'existing'
    return bookingArgs.workflowType || 'existing';
  }

  /**
   * Execute existing client workflow - Common pattern
   */
  async executeExistingClientWorkflow(page, bookingArgs, callContext, sessionDetails, screenshots, checkCancellation, updatePhase) {
    let paymentCompleted = false;

    // STEP 4-5: Search for existing client
    updatePhase('step4_5_find_client');
    checkCancellation();
    
    if (!bookingArgs.customerMobile && !bookingArgs.customerPhone && !bookingArgs.customerEmail) {
      return {
        success: false,
        requiresCustomerInfo: true,
        message: 'To search for your existing profile, I need either your mobile number or email address. Could you please provide one of these?',
        workflowType: 'existing'
      };
    }
    
    // Determine search type and value
    let searchType = 'email';
    let searchValue = bookingArgs.customerEmail;
    
    if (bookingArgs.customerMobile || bookingArgs.customerPhone) {
      searchType = 'mobile';
      searchValue = bookingArgs.customerMobile || bookingArgs.customerPhone;
    } else if (bookingArgs.customerEmail) {
      searchType = 'email';
      searchValue = bookingArgs.customerEmail;
    }
    
    const callSid = callContext.callSid || 'unknown';
    const searchResult = await commonSteps.findAndVerifyClient(
      page, searchType, searchValue, this.screenshotsDir,
      bookingArgs.customerEmail, null, callSid
    );
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-5-client-found.png', this.screenshotsDir));
    
    if (searchResult.retryPrompt) {
      return {
        success: false,
        requiresCustomerInfo: true,
        retryPrompt: searchResult.retryPrompt,
        workflowType: 'existing'
      };
    }
    
    if (!searchResult.success) {
      return {
        success: false,
        error: searchResult.error || 'Failed to find existing client',
        screenshots: screenshots
      };
    }

    // STEP 6: Navigate to Diaries and select session
    updatePhase('step6_select_session');
    checkCancellation();
    await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-session-selected.png', this.screenshotsDir));

    // STEP 7: Select booking options (course-specific - must be overridden)
    updatePhase('step7_booking_options');
    checkCancellation();
    const step7Result = await this.step7SelectBookingOptions(page, bookingArgs, sessionDetails, screenshots, 'existing');
    
    if (!step7Result.success) {
      return step7Result;
    }

    // STEP 8: Contact details - fill MISSING fields only
    updatePhase('step8_contact_details');
    checkCancellation();
    await this.step8FillContactDetails(page, bookingArgs, callContext, screenshots, 'existing');

    // STEP 9: Payment
    updatePhase('step9_payment');
    checkCancellation();
    const paymentResult = await this.step9ProcessPayment(page, bookingArgs, screenshots);
    paymentCompleted = paymentResult.paymentCompleted || false;

    console.log('🎉 Service: All steps completed successfully!');
    return {
      success: true,
      sessionDetails,
      screenshots,
      clientEmail: bookingArgs.customerEmail,
      paymentCompleted: paymentCompleted
    };
  }

  /**
   * Execute new client workflow - Common pattern
   */
  async executeNewClientWorkflow(page, bookingArgs, callContext, sessionDetails, screenshots, checkCancellation, updatePhase) {
    let paymentCompleted = false;

    // STEP 4: Navigate to Diaries and select session
    updatePhase('step4_select_session');
    checkCancellation();
    await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-session-selected.png', this.screenshotsDir));

    // STEP 5: Select booking options (course-specific - must be overridden)
    updatePhase('step5_booking_options');
    checkCancellation();
    const step5Result = await this.step5SelectBookingOptions(page, bookingArgs, sessionDetails, screenshots);
    
    if (!step5Result.success) {
      return step5Result;
    }

    // STEP 6: Click "New contact" button
    updatePhase('step6_new_contact');
    checkCancellation();
    await commonSteps.createNewContact(page, this.screenshotsDir);
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-new-contact-clicked.png', this.screenshotsDir));

    // STEP 7: Fill ALL contact details from scratch
    updatePhase('step7_fill_contact_details');
    checkCancellation();
    await this.step7FillContactDetails(page, bookingArgs, callContext, screenshots, 'new');

    // STEP 8: Payment
    updatePhase('step8_payment');
    checkCancellation();
    const paymentResult = await this.step9ProcessPayment(page, bookingArgs, screenshots);
    paymentCompleted = paymentResult.paymentCompleted || false;

    console.log('🎉 Service: All steps completed successfully!');
    return {
      success: true,
      sessionDetails,
      screenshots,
      clientEmail: bookingArgs.customerEmail,
      paymentCompleted: paymentCompleted
    };
  }

  /**
   * STEP 7: Select booking options for existing client - MUST be overridden by subclasses
   */
  async step7SelectBookingOptions(page, bookingArgs, sessionDetails, screenshots, workflowType) {
    throw new Error('step7SelectBookingOptions must be implemented by subclass');
  }

  /**
   * STEP 5: Select booking options for new client - MUST be overridden by subclasses
   */
  async step5SelectBookingOptions(page, bookingArgs, sessionDetails, screenshots) {
    throw new Error('step5SelectBookingOptions must be implemented by subclass');
  }

  /**
   * STEP 8/7: Fill contact details - Can be overridden for course-specific fields
   */
  async step8FillContactDetails(page, bookingArgs, callContext, screenshots, workflowType) {
    // Default implementation uses common fillContactDetails
    await commonSteps.fillContactDetails(page, {
      title: bookingArgs.title,
      firstNames: bookingArgs.firstNames || bookingArgs.customerFirstName,
      surname: bookingArgs.surname || bookingArgs.customerLastName,
      mobileNumber: bookingArgs.customerMobile || bookingArgs.customerPhone,
      email: bookingArgs.customerEmail,
      dateOfBirth: bookingArgs.dateOfBirth,
      postcode: bookingArgs.postcode,
      houseNumberOrName: bookingArgs.houseNumberOrName,
      licenceHeld: bookingArgs.licenceHeld,
      nationalInsuranceNumber: bookingArgs.nationalInsuranceNumber,
      drivingLicenceNumber: bookingArgs.drivingLicenceNumber,
      licenceFormat: bookingArgs.licenceFormat,
      hearAboutUs: bookingArgs.hearAboutUs,
      ridingExperience: bookingArgs.ridingExperience,
      marketingConsent: bookingArgs.marketingConsent,
      dataSharing: bookingArgs.dataSharing
    }, this.screenshotsDir);
    screenshots.push(await commonSteps.takeScreenshot(page, `step-${workflowType === 'existing' ? '8' : '7'}-contact-details-filled.png`, this.screenshotsDir));
  }

  /**
   * STEP 7: Fill contact details for new client workflow - Alias for step8FillContactDetails
   */
  async step7FillContactDetails(page, bookingArgs, callContext, screenshots, workflowType) {
    return this.step8FillContactDetails(page, bookingArgs, callContext, screenshots, workflowType);
  }

  /**
   * STEP 9: Process payment - Uses unified payment handler
   */
  async step9ProcessPayment(page, bookingArgs, screenshots) {
    // Import payment handler dynamically to avoid circular dependencies
    const { processPayment } = await import('./paymentHandler.js');
    
    const paymentResult = await processPayment(
      page,
      bookingArgs,
      this.screenshotsDir,
      screenshots
    );
    
    return paymentResult;
  }
}

