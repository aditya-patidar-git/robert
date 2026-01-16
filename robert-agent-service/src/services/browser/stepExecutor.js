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
      let clientEmail = args.customerEmail || args.clientDetails?.email || sessionState?.clientDetails?.email;
      
      // FIX 1: Check conversation state for email (from clientVerification/search_client)
      if (!clientEmail) {
        // Extract callSid from sessionState to access conversation state
        let callSid = args.callSid || null;
        if (!callSid && sessionState?.browserSessionId) {
          const match = sessionState.browserSessionId.match(/^browser_(.+?)_\d+$/);
          if (match) {
            callSid = match[1];
          }
        }
        
        if (callSid) {
          const { conversations } = await import('../../shared/state.js');
          const conversation = conversations[callSid];
          
          if (conversation?.clientDetails?.email) {
            clientEmail = conversation.clientDetails.email;
            console.log(`✅ [STEP 8] Using email from conversation state (clientVerification/search_client): ${clientEmail}`);
          }
        }
      }
      
      // CRITICAL: Validate email - reject example/test emails
      if (clientEmail) {
        const invalidEmailPatterns = [
          /@example\.com/i,
          /test@/i,
          /robert@example/i,
          /john@example/i,
          /placeholder@/i,
          /default@/i
        ];
        
        const isInvalid = invalidEmailPatterns.some(pattern => pattern.test(clientEmail));
        if (isInvalid) {
          throw new Error(`Invalid email detected: ${clientEmail}. Email must come from booking_step_search_client result (result.clientDetails.email) or be explicitly provided by the caller. Never use example, test, or placeholder emails.`);
        }
      }
      
      if (!clientEmail) {
        throw new Error('Client email is required for contact lookup (existing client workflow). Email must come from booking_step_search_client result or be provided by the caller.');
      }
      const addressConfirmed = args.addressConfirmed || false;
      const correctedAddress = args.correctedAddress || null;
      const clientPostcode = args.postcode || args.clientDetails?.postcode || sessionState?.clientDetails?.postcode;
      
      // If address is already confirmed, skip lookup and just click Next
      if (addressConfirmed) {
        // Client is already selected, just handle address correction if needed and click Next
        const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
        const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
        
        if (eventBookingIframeExists && correctedAddress) {
          // Update address if corrected
          console.log(`📝 [STEP 8] Updating Address 1 with corrected address: ${correctedAddress}`);
          let address1Field = eventBookingIframe.getByLabel('Address 1');
          if (await address1Field.count() === 0) {
            address1Field = eventBookingIframe.locator('#cmp_address_1 .dx-texteditor-input');
          }
          if (await address1Field.count() > 0) {
            await address1Field.fill(correctedAddress);
            await page.waitForTimeout(500);
          }
        }
        
        // Click Next button (lookupContactAndWait will detect we're already on the page and just click Next)
        await commonSteps.lookupContactAndWait(page, clientEmail, this.screenshotsDir, clientPostcode, false);
      } else {
        // FIX 3: First call lookupContactAndWait to get to the client details page (skip Next click)
        // The Contact choice page should be traversed automatically without any questions
        await commonSteps.lookupContactAndWait(page, clientEmail, this.screenshotsDir, clientPostcode, true);
        
        // CRITICAL FIX: Verify we're actually on the client details page BEFORE checking for missing fields
        // The Contact choice page should be traversed automatically without any questions
        await page.waitForTimeout(2000); // Wait for page to stabilize after client selection
        
        const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
        const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
        
        // CRITICAL: Verify we're on client details page (not Contact choice page)
        // Check for specific indicators that we're on the client details page
        let isOnClientDetailsPage = false;
        if (eventBookingIframeExists) {
          try {
            // Check for client details page indicators
            const clientDetailsIndicators = [
              'text=First Names',
              'text=Surname',
              'text=Contact e-mail',
              'text=Contact mobile number',
              'text=Post Code',
              'text=House number or name'
            ];
            
            for (const indicator of clientDetailsIndicators) {
              const element = eventBookingIframe.locator(indicator).first();
              if (await element.count() > 0) {
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                  console.log(`✅ [STEP 8] Confirmed on client details page - found indicator: ${indicator}`);
                  isOnClientDetailsPage = true;
                  break;
                }
              }
            }
            
            // Also check if we're still on Contact choice page (should NOT be)
            const contactChoiceIndicators = [
              'text=Contact choice',
              'text=Choose one of these options',
              '#btnBookExisting' // Lookup contact button
            ];
            
            let stillOnContactChoicePage = false;
            for (const indicator of contactChoiceIndicators) {
              const element = eventBookingIframe.locator(indicator).first();
              if (await element.count() > 0) {
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                  console.log(`⚠️ [STEP 8] Still on Contact choice page - found indicator: ${indicator}`);
                  stillOnContactChoicePage = true;
                  break;
                }
              }
            }
            
            if (stillOnContactChoicePage) {
              console.log('⚠️ [STEP 8] Still on Contact choice page - cannot check for missing fields yet');
              // Don't check for missing fields - we're not on the client details page yet
              // The Contact choice page should be traversed automatically based on workflowType
              // Just proceed to click Next or continue the flow
              await commonSteps.lookupContactAndWait(page, clientEmail, this.screenshotsDir, clientPostcode, false);
              // After clicking Next, we should be on client details page - check again
              await page.waitForTimeout(2000);
              // Re-check if we're on client details page now
              isOnClientDetailsPage = false;
              for (const indicator of clientDetailsIndicators) {
                const element = eventBookingIframe.locator(indicator).first();
                if (await element.count() > 0) {
                  const isVisible = await element.isVisible().catch(() => false);
                  if (isVisible) {
                    isOnClientDetailsPage = true;
                    break;
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️ [STEP 8] Error checking page state:`, error.message);
            // If we can't determine the page, assume we're on client details page and proceed
            isOnClientDetailsPage = true;
          }
        }
        
        // CRITICAL FIX 4: Only check for missing fields if we're confirmed to be on client details page
        if (isOnClientDetailsPage && eventBookingIframeExists) {
          // Wait for form to be fully loaded
          await page.waitForTimeout(2000);
          
          const missingFields = [];
          const fieldChecks = [
            { label: 'Contact e-mail', id: 'cnt_email', name: 'email', question: 'I can see in your profile that we currently don\'t have your email address; could you please provide me with your full email address?' },
            { label: 'Contact mobile number', id: 'cnt_mobile_number', name: 'mobileNumber', question: 'I can see in your profile that we currently don\'t have your mobile number; could you please provide me with your full mobile number?' },
            { label: 'Post Code', id: 'cmp_post_code', name: 'postcode', question: 'I can see in your profile that we currently don\'t have your postcode; could you please provide me with your postcode?' },
            { label: 'House number or name', id: 'cmp_buildingnumber', name: 'houseNumber', question: 'I can see in your profile that we currently don\'t have your house number or name; could you please provide me with your house number or name?' },
            { label: 'Licence held', id: 'cnt_licence_held', name: 'licenceHeld', question: 'I can see in your profile that we currently don\'t have your licence held information; could you please provide me with your licence held type?' },
            { label: 'National Insurance number', id: 'cnt_national_insurance_number', name: 'nationalInsuranceNumber', question: 'I can see in your profile that we currently don\'t have your National Insurance number; could you please provide me with your National Insurance number?' },
            { label: 'Driving licence number', id: 'cnt_driving_licence_number', name: 'drivingLicenceNumber', question: 'I can see in your profile that we currently don\'t have your driving licence number; could you please provide me with your driving licence number?' }
          ];
          
          for (const field of fieldChecks) {
            try {
              let fieldLocator = eventBookingIframe.getByLabel(field.label);
              if (await fieldLocator.count() === 0) {
                fieldLocator = eventBookingIframe.locator(`#${field.id} .dx-texteditor-input`);
              }
              if (await fieldLocator.count() === 0) {
                fieldLocator = eventBookingIframe.locator(`#${field.id}`);
              }
              
              if (await fieldLocator.count() > 0) {
                const currentValue = await fieldLocator.inputValue().catch(() => '');
                if (!currentValue || currentValue.trim() === '') {
                  missingFields.push({
                    ...field,
                    canUpdateLater: true // All fields can be updated later
                  });
                }
              }
            } catch (error) {
              console.warn(`⚠️ [STEP 8] Could not check ${field.label}:`, error.message);
            }
          }
          
          // CRITICAL FIX 3: Email confirmation should ONLY be asked on client details page, not lookupContact page
          // Check if email field exists and has a value - if so, ask for confirmation
          const emailField = eventBookingIframe.getByLabel('Contact e-mail');
          let emailValue = '';
          if (await emailField.count() > 0) {
            emailValue = await emailField.inputValue().catch(() => '');
          }
          
          if (emailValue && emailValue.trim() !== '') {
            // Email exists - ask for confirmation (ONLY on client details page)
            return {
              success: true,
              requiresEmailConfirmation: true,
              emailAddress: emailValue.trim(),
              missingFields: missingFields.map(f => f.name),
              missingFieldsDetails: missingFields,
              message: `I can see your email address is ${emailValue.trim()}. Could you please confirm to me your full email address again?${missingFields.length > 0 ? ' Also, I notice some missing information in your profile.' : ''}`,
              instruction: 'Ask the client to confirm their email address. After confirmation, if there are missing fields, ask about them one by one, or ask if they want to update them later.'
            };
          } else if (missingFields.length > 0) {
            // Email is missing - ask for it along with other missing fields
            return {
              success: true,
              requiresMissingFields: true,
              missingFields: missingFields.map(f => f.name),
              missingFieldsDetails: missingFields,
              message: `I notice some missing information in your profile. Would you like to provide this information now, or would you prefer to update it later?`,
              instruction: 'Ask the client about missing fields. If they say "update later", "later", "not now", or similar, proceed by clicking Next. Otherwise, collect the missing information.'
            };
          }
          
          // Check for house number and address confirmation
          const houseNumber = args.houseNumber || args.houseNumberOrName;
          let houseNumberField = eventBookingIframe.getByLabel('House number or name');
          if (await houseNumberField.count() === 0) {
            houseNumberField = eventBookingIframe.locator('#cmp_buildingnumber .dx-texteditor-input');
          }
          if (await houseNumberField.count() === 0) {
            houseNumberField = eventBookingIframe.locator('#cmp_buildingnumber');
          }
          
          if (await houseNumberField.count() > 0) {
            const houseNumberValue = await houseNumberField.inputValue().catch(() => '');
            if (!houseNumberValue || houseNumberValue.trim() === '') {
              if (houseNumber) {
                console.log(`📝 [STEP 8] Filling House number or name: ${houseNumber}`);
                await houseNumberField.fill(houseNumber);
                await houseNumberField.press('Tab');
                await page.waitForTimeout(2000);
                
                // Check for auto-populated address
                let address1Field = eventBookingIframe.getByLabel('Address 1');
                if (await address1Field.count() === 0) {
                  address1Field = eventBookingIframe.locator('#cmp_address_1 .dx-texteditor-input');
                }
                
                if (await address1Field.count() > 0) {
                  const autoPopulatedAddress = await address1Field.inputValue();
                  if (autoPopulatedAddress && autoPopulatedAddress.trim() !== '') {
                    // CRITICAL FIX: Only return requiresAddressConfirmation if we're on the Contact Details page
                    const eventBookingIframeStillExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
                    if (!eventBookingIframeStillExists) {
                      console.log('⚠️ [STEP 8] Not on Contact Details page anymore - skipping address confirmation');
                    } else {
                      return {
                        success: true,
                        requiresAddressConfirmation: true,
                        autoPopulatedAddress: autoPopulatedAddress,
                        message: `Address auto-populated as: ${autoPopulatedAddress}. Please confirm with client before proceeding.`
                      };
                    }
                  }
                }
              } else {
                // House number is missing but not provided - ask agent to get it
                return {
                  success: false,
                  requiresHouseNumber: true,
                  message: 'The house number or name field is missing on the client details page. Please ask the client for their house number or name before proceeding.'
                };
              }
            }
          }
        } else {
          // Not on client details page yet - just proceed without checking missing fields
          console.log('⚠️ [STEP 8] Not on client details page yet - skipping missing fields check');
        }
        
        // After handling missing fields/email confirmation, click Next
        await commonSteps.lookupContactAndWait(page, clientEmail, this.screenshotsDir, clientPostcode, false);
        
        // CRITICAL FIX 5: Detect page transition after Next click
        await page.waitForTimeout(2000); // Wait for navigation
        
        // Check if we're on payment page
        const paymentPageIndicators = [
          '#contactSend3DSecureRequest_iframe', // Payment request page
          'text=Payment', // Payment page header
          'text=Send a payment request', // Payment option
          '[aria-label*="payment" i]' // Payment-related elements
        ];
        
        let onPaymentPage = false;
        for (const indicator of paymentPageIndicators) {
          try {
            const element = page.locator(indicator).first();
            if (await element.count() > 0) {
              const isVisible = await element.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [STEP 8] Detected payment page: ${indicator}`);
                onPaymentPage = true;
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        // Also check if we're still on client details page (Next button might be hidden)
        const stillOnClientDetailsPage = await page.locator('#eventNewBooking2_iframe').count() > 0;
        const nextButtonStillVisible = stillOnClientDetailsPage ? await page.frameLocator('#eventNewBooking2_iframe').locator('#diaryNewCourseBookingWiz_nextBtn').isVisible().catch(() => false) : false;
        
        if (onPaymentPage) {
          return {
            success: true,
            contactDetailsFilled: true,
            clientFound: true,
            clientSelected: true,
            clientDetailsPageLoaded: true,
            nextButtonClicked: true,
            onPaymentPage: true, // NEW: Indicate we're on payment page
            stepCompleted: 8,
            stepName: 'fill_contact_details',
            nextStep: 'booking_step_process_payment',
            nextStepNumber: 9,
            doNotRetry: true, // CRITICAL: Prevent retries
            message: `✅ STEP 8 COMPLETE: We are now on the payment page. Proceed to STEP 9 by calling booking_step_process_payment tool.`
          };
        } else if (!stillOnClientDetailsPage || !nextButtonStillVisible) {
          // We've navigated away from client details page
          return {
            success: true,
            contactDetailsFilled: true,
            clientFound: true,
            clientSelected: true,
            clientDetailsPageLoaded: true,
            nextButtonClicked: true,
            stepCompleted: 8,
            stepName: 'fill_contact_details',
            nextStep: 'booking_step_process_payment',
            nextStepNumber: 9,
            doNotRetry: true, // CRITICAL: Prevent retries
            message: `✅ STEP 8 COMPLETE: Client details page completed and navigated to next step. Proceed to STEP 9 by calling booking_step_process_payment tool.`
          };
        }
      }
      
      return {
        success: true,
        contactDetailsFilled: true,
        clientFound: true,
        clientSelected: true,
        clientDetailsPageLoaded: true,
        nextButtonClicked: true,
        stepCompleted: 8,
        stepName: 'fill_contact_details',
        nextStep: 'booking_step_process_payment',
        nextStepNumber: 9,
        doNotRetry: true, // CRITICAL: Prevent retries
        message: `✅ STEP 8 COMPLETE: booking_step_fill_contact_details has been successfully completed. Client ${clientEmail} was found, selected, and Next button clicked. Proceed to STEP 9 by calling booking_step_process_payment tool.`
      };
    } else {
      // New client: fill all fields from scratch
      const addressConfirmed = args.addressConfirmed || false;
      const correctedAddress = args.correctedAddress || null;
      
      const fillResult = await commonSteps.fillContactDetails(page, {
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
        dataSharing: args.dataSharing,
        correctedAddress: correctedAddress
      }, this.screenshotsDir, addressConfirmed);

      // Check if address confirmation is required
      if (fillResult && fillResult.requiresAddressConfirmation) {
        return {
          success: true,
          requiresAddressConfirmation: true,
          autoPopulatedAddress: fillResult.autoPopulatedAddress,
          townCity: fillResult.townCity,
          message: fillResult.message
        };
      }

      return {
        success: true,
        contactDetailsFilled: true,
        stepCompleted: 7, // Explicitly state which step is complete (for new clients, this is Step 7)
        stepName: 'fill_contact_details', // Explicit step name
        nextStep: 'booking_step_process_payment', // Explicitly state next step tool to call
        nextStepNumber: 8, // Explicitly state next step number (for new clients, payment is Step 8)
        doNotRetry: true, // Explicitly prevent retry
        message: `✅ STEP 7 COMPLETE: booking_step_fill_contact_details has been successfully completed. Contact details form filled successfully. DO NOT RETRY THIS STEP. IMMEDIATELY proceed to STEP 8 by calling booking_step_process_payment tool.`
      };
    }
  }

  async executeProcessPayment(page, args, sessionState) {
    // Use the updated payment strategy: Select "Send a payment request" and use sendPaymentRequest
    const screenshots = [];
    
    // CRITICAL: Wait for page to fully transition from contact details to payment page
    console.log('⏳ [PAYMENT] Waiting for page transition from contact details to payment page...');
    await page.waitForTimeout(5000); // Increased wait time for page transition
    
    // Verify we're on the payment page before proceeding
    console.log('🔍 [PAYMENT] Verifying payment page is loaded...');
    const paymentPageIndicators = [
      page.locator('text=/Confirm and Pay/i').first(),
      page.locator('text=/4. Pay/i').first(),
      page.locator('text=/Payment/i').first(),
      page.locator('#eventNewBooking2_iframe').first()
    ];
    
    let pageReady = false;
    for (let i = 0; i < 5; i++) {
      for (const indicator of paymentPageIndicators) {
        const count = await indicator.count();
        if (count > 0) {
          pageReady = true;
          break;
        }
      }
      if (pageReady) break;
      if (i < 4) {
        console.log(`⏳ [PAYMENT] Payment page not ready yet, waiting (${i + 1}/5)...`);
        await page.waitForTimeout(2000);
      }
    }
    
    if (!pageReady) {
      console.log('⚠️ [PAYMENT] Payment page indicators not found, but continuing...');
    } else {
      console.log('✅ [PAYMENT] Payment page is ready');
    }
    
    // Step 1: Select "Send a payment request" option (updated strategy)
    const { selectPaymentOption } = await import('../commonBookingSteps/selectPaymentOption.js');
    await selectPaymentOption(page, this.screenshotsDir, 'request');
    screenshots.push(await (await import('../commonBookingSteps/utils.js')).takeScreenshot(page, 'payment-option-selected-request.png', this.screenshotsDir));
    
    // CRITICAL FIX: Verify page transition completed before proceeding
    // After selecting "Send a payment request", we must be on paymentRequestLink page
    // (contactSend3DSecureRequest_iframe), NOT on PaymentPage (eventNewBooking2_iframe)
    console.log('🔍 [PAYMENT] Verifying page transition to payment request link page...');
    let onPaymentRequestPage = false;
    for (let i = 0; i < 5; i++) {
      const paymentRequestIframeExists = await page.locator('#contactSend3DSecureRequest_iframe').count() > 0;
      if (paymentRequestIframeExists) {
        try {
          const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
          const testLocator = paymentRequestIframe.locator('body').first();
          await testLocator.waitFor({ state: 'attached', timeout: 2000 });
          console.log('✅ [PAYMENT] Confirmed: On payment request link page (contactSend3DSecureRequest_iframe)');
          onPaymentRequestPage = true;
          break;
        } catch (iframeError) {
          // Iframe exists but not loaded yet
        }
      }
      if (i < 4) {
        await page.waitForTimeout(2000);
        console.log(`⏳ [PAYMENT] Waiting for payment request page transition (${i + 1}/5)...`);
      }
    }
    
    if (!onPaymentRequestPage) {
      console.warn('⚠️ [PAYMENT] Page transition verification failed - may still be on payment page');
      console.warn('⚠️ [PAYMENT] sendPaymentRequest will attempt to detect correct page');
    }
    
    await page.waitForTimeout(2000); // Additional wait for page stability
    
    // Step 2: Get client email/mobile from args or sessionState
    let clientEmail = args.clientEmail || args.customerEmail || null;
    let clientMobile = args.clientMobile || args.customerMobile || args.customerPhone || null;
    
    // Try to get from sessionState if not provided in args
    if (!clientEmail || !clientMobile) {
      // Extract callSid from sessionState to access conversation state
      let callSid = args.callSid || null;
      if (!callSid && sessionState?.browserSessionId) {
        const match = sessionState.browserSessionId.match(/^browser_(.+?)_\d+$/);
        if (match) {
          callSid = match[1];
        }
      }
      
      if (callSid) {
        const { conversations } = await import('../../shared/state.js');
        const conversation = conversations[callSid];
        
        if (conversation) {
          // Get from clientDetails
          if (!clientEmail && conversation.clientDetails?.email) {
            clientEmail = conversation.clientDetails.email;
          }
          if (!clientMobile && conversation.clientDetails?.telephoneNumber) {
            clientMobile = conversation.clientDetails.telephoneNumber;
          }
          
          // Fallback to KBA email
          if (!clientEmail && conversation.kba?.email) {
            clientEmail = conversation.kba.email;
          }
        }
      }
    }
    
    // Step 3: Determine delivery method - MUST be provided by agent (agent should ask client first)
    const deliveryMethod = args.deliveryMethod;
    if (!deliveryMethod || (deliveryMethod !== 'email' && deliveryMethod !== 'sms')) {
      return {
        success: false,
        paymentCompleted: false,
        error: 'deliveryMethod is required and must be "email" or "sms". The agent must ask the client "Would you like to receive the payment request via email or SMS?" before calling this tool.',
        requiresPaymentMethod: true,
        message: 'Would you like to receive the payment request via email or SMS?'
      };
    }
    
    if (!clientEmail && !clientMobile) {
      return {
        success: false,
        paymentCompleted: false,
        error: 'Client email or mobile number is required for payment request. Please provide clientEmail or clientMobile in the tool arguments.'
      };
    }
    
    // Step 4: Check if terms were explicitly accepted before proceeding
    // According to CRM docs, agent MUST read terms and get client agreement BEFORE payment
    const termsAccepted = args.termsAccepted;
    if (termsAccepted === undefined) {
      console.log('⚠️ [PAYMENT] Terms acceptance not explicitly confirmed - agent should read terms before payment');
      // Still proceed but add guidance in message
    }
    
    // Step 5: Use sendPaymentRequest (updated strategy)
    const { sendPaymentRequest } = await import('../commonBookingSteps/sendPaymentRequest.js');
    
    const paymentResult = await sendPaymentRequest(
      page,
      this.screenshotsDir,
      deliveryMethod,
      clientEmail,
      clientMobile
    );

    if (paymentResult.success && paymentResult.paymentCompleted) {
      // After payment is confirmed, terms should be read before clicking "Make booking"
      // This is handled by acceptTermsAndMakeBooking which is called from sendPaymentRequest
      return {
        success: true,
        paymentCompleted: true,
        bookingFinalized: true,
        paymentMethod: 'payment_request',
        message: paymentResult.message || `✅ SUCCESS: Payment request sent via ${deliveryMethod} and payment completed successfully. ${termsAccepted === undefined ? '⚠️ IMPORTANT: Please read terms and conditions to the client before proceeding with booking confirmation.' : 'Booking finalized and completed.'}`
      };
    }
    
    return {
      success: paymentResult.success,
      paymentCompleted: paymentResult.paymentCompleted || false,
      paymentMethod: 'payment_request',
      error: paymentResult.error,
      message: paymentResult.message
    };
  }

  async executeSendPaymentRequest(page, args, sessionState) {
    // Use sendPaymentRequest from commonBookingSteps
    const { sendPaymentRequest } = await import('../commonBookingSteps/sendPaymentRequest.js');
    
    // CRITICAL FIX: Check if we're still on PaymentPage (need to select "Send a payment request" first)
    // After ClientDetailsPage, we first land on PaymentPage, not paymentRequestLink page
    // We must select "Send a payment request" from dropdown before we can access paymentRequestLink page
    console.log('🔍 [SEND_PAYMENT_REQUEST] Checking current page state...');
    
    const isOnPaymentPage = await page.locator('#eventNewBooking2_iframe').count() > 0;
    const isOnPaymentRequestPage = await page.locator('#contactSend3DSecureRequest_iframe').count() > 0;
    
    if (isOnPaymentPage && !isOnPaymentRequestPage) {
      console.log('⚠️ [SEND_PAYMENT_REQUEST] Still on PaymentPage - need to select "Send a payment request" first');
      console.log('📋 [SEND_PAYMENT_REQUEST] Calling selectPaymentOption to select "Send a payment request"...');
      
      // Step 1: Select "Send a payment request" option
      const { selectPaymentOption } = await import('../commonBookingSteps/selectPaymentOption.js');
      await selectPaymentOption(page, this.screenshotsDir, 'request');
      
      // Step 2: Wait for page transition to paymentRequestLink page
      console.log('⏳ [SEND_PAYMENT_REQUEST] Waiting for page transition to payment request link page...');
      let transitionComplete = false;
      for (let i = 0; i < 10; i++) {
        const paymentRequestIframeExists = await page.locator('#contactSend3DSecureRequest_iframe').count() > 0;
        if (paymentRequestIframeExists) {
          try {
            const paymentRequestIframe = page.frameLocator('#contactSend3DSecureRequest_iframe');
            const testLocator = paymentRequestIframe.locator('body').first();
            await testLocator.waitFor({ state: 'attached', timeout: 2000 });
            console.log('✅ [SEND_PAYMENT_REQUEST] Page transition complete - now on payment request link page');
            transitionComplete = true;
            break;
          } catch (iframeError) {
            // Iframe exists but not loaded yet
          }
        }
        if (i < 9) {
          await page.waitForTimeout(2000);
        }
      }
      
      if (!transitionComplete) {
        console.warn('⚠️ [SEND_PAYMENT_REQUEST] Page transition may not have completed, but proceeding...');
      }
    } else if (isOnPaymentRequestPage) {
      console.log('✅ [SEND_PAYMENT_REQUEST] Already on payment request link page');
    } else {
      console.warn('⚠️ [SEND_PAYMENT_REQUEST] Could not determine current page state, proceeding...');
    }
    
    const deliveryMethod = args.deliveryMethod; // 'email' or 'sms' (required)
    if (!deliveryMethod || (deliveryMethod !== 'email' && deliveryMethod !== 'sms')) {
      return {
        success: false,
        paymentCompleted: false,
        error: 'deliveryMethod is required and must be "email" or "sms". The agent must ask the client "Would you like to receive the payment request via email or SMS?" before calling this tool.',
        requiresPaymentMethod: true,
        message: 'Would you like to receive the payment request via email or SMS?'
      };
    }
    
    const clientEmail = args.clientEmail || null;
    const clientMobile = args.clientMobile || null;
    
    // FIX: Explicitly check for true boolean value, not just truthy
    // Handle both boolean true and string "true" (in case it comes as string from JSON)
    // Also check for undefined/null and default to false
    const confirmed = args.confirmed === true || args.confirmed === 'true';
    
    // Debug logging to trace parameter passing
    console.log(`🔍 [SEND_PAYMENT_REQUEST] All args keys:`, Object.keys(args));
    console.log(`🔍 [SEND_PAYMENT_REQUEST] Confirmed parameter: ${args.confirmed} (type: ${typeof args.confirmed}), evaluated as: ${confirmed}`);
    
    const result = await sendPaymentRequest(
      page,
      this.screenshotsDir,
      deliveryMethod,
      clientEmail,
      clientMobile,
      confirmed
    );
    
    // If confirmation is required, return early
    if (result.requiresConfirmation) {
      return {
        success: true,
        paymentCompleted: false,
        requiresConfirmation: true,
        emailAddress: result.emailAddress,
        phoneNumber: result.phoneNumber,
        deliveryMethod: deliveryMethod,
        message: result.message
      };
    }
    
    // Return result with enhanced message if successful
    if (result.success && result.paymentCompleted) {
      return {
        success: true,
        paymentCompleted: true,
        bookingFinalized: true,
        message: result.message || `✅ SUCCESS: Payment request sent via ${deliveryMethod} and payment completed successfully. Booking finalized and completed.`
      };
    }
    
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

