import fs from 'fs';
import * as commonSteps from './commonBookingSteps/index.js';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';

class ITMBookingService {
  constructor() {
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: process.env.CRM_LOGIN || 'universalmct',
      username: process.env.CRM_USERNAME || 'auagent',
      password: process.env.CRM_PASSWORD || 'Robert2025!',
      availabilityUrl: 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C9170432CA66685F'
    };
    this.screenshotsDir = './screenshots/itm-booking';
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  async executeBookingWorkflow(page, bookingArgs = {}, callContext = {}) {
    const screenshots = [];
    let sessionDetails = null;
    const workflowType = bookingArgs.workflowType || 'existing';
    
    // Initialize confirmation email sent flag (used in both workflows)
    let confirmationEmailSent = false;

    try {
      console.log(`🚀 Starting ITM booking workflow (${workflowType} client)...`);

      // Session details should be provided from the availability tool call
      // Retrieve from bookingArgs (set by browserAgentService from conversation state)
      sessionDetails = bookingArgs.sessionDetails;
      if (!sessionDetails) {
        console.warn('⚠️ No availability data found - creating default sessionDetails to continue workflow');
        // Create default sessionDetails to allow workflow to continue
        // This will be used when navigating to Diaries, but may need manual selection
        const defaultPreferredDate = '2026-03-29'; // 29/03/2026
        const defaultLocation = 'Croydon, South London, CR0';
        const preferredDate = bookingArgs.preferredDate || defaultPreferredDate;
        sessionDetails = {
          date: new Date(preferredDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          course: 'ITM - Introduction to Motorcycle',
          location: bookingArgs.location || defaultLocation,
          time: bookingArgs.preferredTime || 'TBD',
          price: '£125.00',
          instructor: 'TBD',
          startDate: preferredDate,
          monthYear: new Date(preferredDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        };
        console.warn('⚠️ Using default sessionDetails - workflow will continue but may need manual session selection');
      } else {
        console.log('✅ Using availability data from previous check');
      }

      // STEP 2: Login to CRM
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
        
        // CRITICAL: Ensure we're on CRM dashboard, not on availability URL
        const currentUrl = page.url();
        if (currentUrl.includes('bookcbtnow.com') || currentUrl.includes('gateway.aspx')) {
          console.log('🔐 Step 2: Navigating to CRM dashboard (page was on availability URL)...');
          await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
          await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
          console.log('✅ Step 2: Confirmed on CRM dashboard');
        }
        
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-login-success.png', this.screenshotsDir));
        console.log('✅ Step 2 completed');
      } else {
        // Already logged in - ensure we're on CRM dashboard
        const currentUrl = page.url();
        if (currentUrl.includes('bookcbtnow.com') || currentUrl.includes('gateway.aspx')) {
          console.log('🔐 Step 2: Navigating to CRM dashboard (page was on availability URL)...');
          await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
        } else if (currentUrl.includes('/Account/Login')) {
          await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
        }
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-already-logged-in.png', this.screenshotsDir));
        console.log('✅ Step 2: Already authenticated');
      }

      // STEP 3: Ask "Have you done training with us before?" (handled by voice agent)
      // workflowType is already determined and passed in bookingArgs

      if (workflowType === 'existing') {
        // EXISTING CLIENT WORKFLOW
        // STEP 4-5: Search for existing client (mobile first, then email fallback)
        console.log('👤 Step 4-5: Finding existing client...');
        
        // Check if client is already verified - skip search if so
        if (callContext.clientVerified && callContext.clientDetails) {
          console.log('✅ Step 4-5: Client already verified, skipping search and proceeding to booking');
          // Client is verified, proceed directly to Step 6
        } else {
          // Check if we have customer info to search
          if (!bookingArgs.customerMobile && !bookingArgs.customerPhone && !bookingArgs.customerEmail) {
          // Return graceful error asking agent to collect customer info
          console.log('⚠️ Step 4-5: Customer info missing - asking agent to collect');
          return {
            success: false,
            requiresCustomerInfo: true,
            message: 'To search for your existing profile, I need either your mobile number or email address. Could you please provide one of these?',
            workflowType: 'existing'
          };
        }
        
        // Determine search type and value - mobile number takes priority
        let searchType = 'email';
        let searchValue = bookingArgs.customerEmail;
        
        if (bookingArgs.customerMobile || bookingArgs.customerPhone) {
          searchType = 'mobile';
          searchValue = bookingArgs.customerMobile || bookingArgs.customerPhone;
        } else if (bookingArgs.customerEmail) {
          searchType = 'email';
          searchValue = bookingArgs.customerEmail;
        }
        
        // Search for client - pass callSid for state tracking
        const callSid = callContext.callSid || 'unknown';
        const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, this.screenshotsDir, bookingArgs.customerEmail, null, callSid);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-5-client-found.png', this.screenshotsDir));
        
        // Handle retry prompts for mobile search
        if (searchResult.retryPrompt) {
          return {
            success: false,
            requiresCustomerInfo: true,
            retryPrompt: searchResult.retryPrompt,
            message: searchResult.retryPrompt,
            workflowType: 'existing'
          };
        }
        
        if (!searchResult.found) {
          // If mobile search failed and we haven't tried email yet, try email
          if (searchType === 'mobile' && bookingArgs.customerEmail) {
            console.log('⚠️ Mobile search failed, trying email search...');
            const emailSearchResult = await commonSteps.findAndVerifyClient(page, 'email', bookingArgs.customerEmail, this.screenshotsDir, bookingArgs.customerEmail, null, callSid);
            if (emailSearchResult.found) {
              if (emailSearchResult.clientDetails) {
                callContext.clientDetails = emailSearchResult.clientDetails;
                bookingArgs.clientDetails = emailSearchResult.clientDetails;
              }
              console.log('✅ Step 4-5: Client found via email');
              
              // Return with verification prompt
              if (emailSearchResult.requiresVerification) {
                return {
                  success: false,
                  requiresVerification: true,
                  verificationPrompt: emailSearchResult.verificationPrompt,
                  clientDetails: emailSearchResult.clientDetails || callContext.clientDetails,
                  message: emailSearchResult.verificationPrompt || 'Client found but requires verbal verification before proceeding with booking'
                };
              }
            } else {
              throw new Error('Could not find client with mobile number or email address');
            }
          } else {
            throw new Error(searchResult.error || 'Could not find client in CRM');
          }
        } else {
          if (searchResult.clientDetails) {
            callContext.clientDetails = searchResult.clientDetails;
            bookingArgs.clientDetails = searchResult.clientDetails;
          }
          console.log('✅ Step 4-5: Client found');
        }
        
        // IMPORTANT: Do not proceed to booking until verbal verification is complete
        // The agent must call the clientVerification tool first
        if (searchResult.requiresVerification || (searchResult.found && !callContext.clientVerified)) {
          return {
            success: false,
            requiresVerification: true,
            verificationPrompt: searchResult.verificationPrompt,
            clientDetails: searchResult.clientDetails || callContext.clientDetails,
            message: searchResult.verificationPrompt || 'Client found but requires verbal verification before proceeding with booking'
          };
        }
        } // End of else block for client search
        
        // STEP 6: Navigate to Diaries and select session
        console.log('📅 Step 6: Navigating to Diaries and selecting session...');
        await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-session-selected.png', this.screenshotsDir));
        console.log('✅ Step 6 completed: Session selected');

        // STEP 7: Select booking options
        console.log('⚙️ Step 7: Selecting ITM booking options...');
        const bookingOptionsResult = await this.selectBookingOptions(page, bookingArgs);
        
        // Check if preferences are required
        if (bookingOptionsResult && bookingOptionsResult.requiresPreferences) {
          return {
            success: false,
            requiresPreferences: true,
            missingPreferences: bookingOptionsResult.missingPreferences,
            message: bookingOptionsResult.message,
            validOptions: bookingOptionsResult.validOptions,
            sessionDetails,
            screenshots,
            clientEmail: bookingArgs.customerEmail
          };
        }
        
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-7-options-selected.png', this.screenshotsDir));
        console.log('✅ Step 7 completed: Booking options selected');

        // STEP 8: Contact details - fill MISSING fields only
        console.log('🔍 Step 8: Looking up contact and filling missing details...');
        const clientEmail = bookingArgs.customerEmail || callContext.clientDetails?.email || bookingArgs.clientDetails?.email;
        if (!clientEmail) {
          throw new Error('Client email is required for contact lookup');
        }
        await commonSteps.lookupContactAndWait(page, clientEmail, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-contact-details.png', this.screenshotsDir));
        console.log('✅ Step 8 completed: Contact details updated');

        // STEP 9: Payment
        console.log('💳 Step 9: Processing payment...');
        await commonSteps.selectPaymentOption(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-payment-option-selected.png', this.screenshotsDir));
        await page.waitForTimeout(2000);
        await commonSteps.selectPaymentMethod(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-payment-method-selected.png', this.screenshotsDir));
        await page.waitForTimeout(2000);
        await commonSteps.fillCardDetails(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-card-details-filled.png', this.screenshotsDir));
        const termsAccepted = bookingArgs.termsAccepted || false;
        const bookingResult = await commonSteps.acceptTermsAndMakeBooking(page, this.screenshotsDir, termsAccepted, false);
        if (!bookingResult.success) {
          if (!bookingResult.termsAccepted) {
            throw new Error('Client did not accept terms - booking cancelled');
          } else {
            throw new Error(`Failed to complete booking: ${bookingResult.error}`);
          }
        }
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-booking-completed.png', this.screenshotsDir));
        console.log('✅ Step 9 completed: Payment processed and booking made');

        // STEP 10: Send booking confirmation email
        try {
          console.log('📧 Step 10: Sending booking confirmation email...');
          await commonSteps.sendBookingConfirmationEmail(page, this.screenshotsDir, 'itm');
          screenshots.push(await commonSteps.takeScreenshot(page, 'step-10-email-sent.png', this.screenshotsDir));
          console.log('✅ Step 10 completed: Booking confirmation email sent');
          confirmationEmailSent = true;
        } catch (emailError) {
          console.warn('⚠️ Failed to send confirmation email (non-critical):', emailError.message);
        }

      } else {
        // NEW CLIENT WORKFLOW
        // STEP 4: Navigate to Diaries and select session
        console.log('📅 Step 4: Navigating to Diaries and selecting session...');
        await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-session-selected.png', this.screenshotsDir));
        console.log('✅ Step 4 completed: Session selected');

        // STEP 5: Select booking options
        console.log('⚙️ Step 5: Selecting ITM booking options...');
        const bookingOptionsResult = await this.selectBookingOptions(page, bookingArgs);
        
        // Check if preferences are required
        if (bookingOptionsResult && bookingOptionsResult.requiresPreferences) {
          return {
            success: false,
            requiresPreferences: true,
            missingPreferences: bookingOptionsResult.missingPreferences,
            message: bookingOptionsResult.message,
            validOptions: bookingOptionsResult.validOptions,
            sessionDetails,
            screenshots
          };
        }
        
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-5-options-selected.png', this.screenshotsDir));
        console.log('✅ Step 5 completed: Booking options selected');

        // STEP 6: Click "New contact" button
        console.log('👤 Step 6: Creating new contact...');
        await commonSteps.createNewContact(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-new-contact-created.png', this.screenshotsDir));
        console.log('✅ Step 6 completed: New contact created');

        // STEP 7: Fill ALL contact details from scratch
        console.log('📝 Step 7: Filling all contact details...');
        const contactDetails = {
          title: bookingArgs.title,
          firstNames: bookingArgs.firstNames,
          surname: bookingArgs.surname,
          mobileNumber: bookingArgs.customerPhone,
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
        };
        await commonSteps.fillContactDetails(page, contactDetails, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-7-contact-details-filled.png', this.screenshotsDir));
        console.log('✅ Step 7 completed: All contact details filled');

        // STEP 8: Payment
        console.log('💳 Step 8: Processing payment...');
        await commonSteps.selectPaymentOption(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-payment-option-selected.png', this.screenshotsDir));
        await page.waitForTimeout(2000);
        await commonSteps.selectPaymentMethod(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-payment-method-selected.png', this.screenshotsDir));
        await page.waitForTimeout(2000);
        await commonSteps.fillCardDetails(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-card-details-filled.png', this.screenshotsDir));
        const termsAccepted = bookingArgs.termsAccepted || false;
        const bookingResult = await commonSteps.acceptTermsAndMakeBooking(page, this.screenshotsDir, termsAccepted, false);
        if (!bookingResult.success) {
          if (!bookingResult.termsAccepted) {
            throw new Error('Client did not accept terms - booking cancelled');
          } else {
            throw new Error(`Failed to complete booking: ${bookingResult.error}`);
          }
        }
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-booking-completed.png', this.screenshotsDir));
        console.log('✅ Step 8 completed: Payment processed and booking made');

        // STEP 9: Send booking confirmation email
        try {
          console.log('📧 Step 9: Sending booking confirmation email...');
          await commonSteps.sendBookingConfirmationEmail(page, this.screenshotsDir, 'itm');
          screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-email-sent.png', this.screenshotsDir));
          console.log('✅ Step 9 completed: Booking confirmation email sent');
          confirmationEmailSent = true;
        } catch (emailError) {
          console.warn('⚠️ Failed to send confirmation email (non-critical):', emailError.message);
        }
      }

      console.log('🎉 Service: All steps completed successfully!');
      return {
        success: true,
        sessionDetails,
        screenshots,
        clientEmail: bookingArgs.customerEmail,
        confirmationEmailSent: confirmationEmailSent || false
      };

    } catch (error) {
      console.error('❌ ITM booking demo failed at step:', error.message);
      console.error('❌ Service: Error stack:', error.stack);
      screenshots.push(await commonSteps.takeScreenshot(page, 'error-state.png', this.screenshotsDir));
      
      // Return error gracefully with user-friendly message
      const clientEmail = bookingArgs?.customerEmail;
      const errorContext = getErrorContext(error, 'create_booking');
      const userFriendlyError = formatUserFriendlyError(error, errorContext);
      
      return {
        success: false,
        error: userFriendlyError,
        technicalError: error.message, // Keep technical error for logging
        sessionDetails: sessionDetails,
        screenshots: screenshots,
        clientEmail: clientEmail
      };
    }
  }

  // STEP 1: Check availability and note details
async checkAvailabilityAndNoteDetails(page) {
  try {
    console.log('📅 Navigating to availability page...');
    
    // Navigate to public availability page
    await page.goto(this.crmCredentials.availabilityUrl);
    await page.waitForLoadState('networkidle');
    
      // Take screenshot of availability page
      await commonSteps.takeScreenshot(page, 'availability-page-loaded.png', this.screenshotsDir);
    
    // Wait for the availability table to be visible
    await page.waitForSelector('#availabilityTable', { timeout: 10000 });
    
    // Find the availability table by ID
    const availabilityTable = page.locator('#availabilityTable');
    await availabilityTable.waitFor({ state: 'visible' });
    
    // Wait for table to be populated with data rows
    await page.waitForSelector('#availabilityTable tbody tr.availabilityDataRow', { timeout: 10000 });
    
    // Get the LAST month cell (latest month)
    const lastMonthCell = availabilityTable.locator('td.availabilityMonthCell').last();
    const latestMonthYear = (await lastMonthCell.textContent()).trim();
    
    console.log(`📅 Latest month found: ${latestMonthYear}`);
    
    // Get all data rows
    const allDataRows = availabilityTable.locator('tbody tr.availabilityDataRow');
    const rowCount = await allDataRows.count();
    
    console.log(`📊 Total data rows found: ${rowCount}`);
    
    // Get the SECOND-TO-LAST data row (for testing)
    if (rowCount < 2) {
      throw new Error('Not enough availability entries found. Need at least 2 entries.');
    }
    const secondLastDataRow = allDataRows.nth(rowCount - 2);
    await secondLastDataRow.waitFor({ state: 'visible' });
    
    // Extract details from columns based on actual table structure
    // Column order: 0=date, 1=course, 2=location, 3=time, 4=price, 5=spaces button, 6=instructor
    const sessionDetails = {
      date: (await secondLastDataRow.locator('td').nth(0).textContent()).trim(),
      course: (await secondLastDataRow.locator('td').nth(1).textContent()).trim(),
      location: (await secondLastDataRow.locator('td').nth(2).textContent()).trim(), // Fixed: was incorrectly mapped to time
      time: (await secondLastDataRow.locator('td').nth(3).textContent()).trim(), // Fixed: was incorrectly mapped to location
      price: (await secondLastDataRow.locator('td').nth(4).textContent()).trim(), // Added: price field
      instructor: (await secondLastDataRow.locator('td').nth(6).textContent()).trim().replace(/^Instructor:\s*/i, ''), // Fixed: column 5 is "Spaces" button, instructor is in column 6, remove "Instructor: " prefix
      // Extract precise date from data attribute for calendar selection
      startDate: await secondLastDataRow.getAttribute('data-start_date'),
      // Use the latest month/year we extracted
      monthYear: latestMonthYear
    };
    
    console.log('📋 Extracted session details:', sessionDetails);
    return sessionDetails;
    
  } catch (error) {
    console.error('Error in checkAvailabilityAndNoteDetails:', error);
    throw new Error(`Failed to check availability: ${error.message}`);
  }
  }

  // STEP 8: Select booking options (ITM-specific)
  async selectBookingOptions(page, bookingArgs = {}) {
    try {
      console.log('⚙️ [STEP 8] Selecting ITM booking options...');
      
      // Step 1: Validate provided preferences (if any)
      const validBikeTypes = ['125cc automatic', '50cc automatic', '125cc manual'];
      const invalidPreferences = [];
      
      if (bookingArgs.bikeType) {
        const normalizedBikeType = bookingArgs.bikeType.trim().toLowerCase();
        const isValid = validBikeTypes.some(valid => valid.toLowerCase() === normalizedBikeType);
        if (!isValid) {
          invalidPreferences.push({
            preference: 'bikeType',
            providedValue: bookingArgs.bikeType,
            validOptions: validBikeTypes
          });
        }
      }
      
      if (invalidPreferences.length > 0) {
        const invalidPref = invalidPreferences[0];
        return {
          requiresPreferences: true,
          invalidPreferences: invalidPreferences.map(p => p.preference),
          message: `I'm sorry, but "${invalidPref.providedValue}" is not a valid bike type for the ITM course. Please choose one of: "${validBikeTypes.join('", "')}".`,
          validOptions: validBikeTypes
        };
      }
      
      // Step 2: Check for missing required preferences
      const missingPreferences = [];
      if (!bookingArgs.bikeType) {
        missingPreferences.push('bikeType');
      }
      
      if (missingPreferences.length > 0) {
        return {
          requiresPreferences: true,
          missingPreferences: missingPreferences,
          message: `I need to know your bike type preference for the ITM course. Would you like to do the course on a "125cc automatic (scooter)", a "50cc automatic", or a "125cc manual (geared)"?`,
          validOptions: validBikeTypes
        };
      }
      
      // WAIT FOR PRICE PAGE TO LOAD - 5 seconds (increased for iframe/popup loading)
      console.log('⏳ [STEP 8] Waiting for price page to load...');
      await page.waitForTimeout(5000);
      
      // Check for popup windows first
      const pages = page.context().pages();
      let targetPage = page;
      if (pages.length > 1) {
        console.log(`🔍 [STEP 8] Found ${pages.length} pages, checking for booking popup...`);
        for (let i = 0; i < pages.length; i++) {
          const pageTitle = await pages[i].title();
          const pageUrl = pages[i].url();
          console.log(`   Page ${i + 1}: Title="${pageTitle}", URL="${pageUrl.substring(0, 100)}..."`);
          if (pageTitle.includes('booking') || pageTitle.includes('Booking') || 
              pageUrl.includes('booking') || pageUrl.includes('Booking')) {
            targetPage = pages[i];
            console.log(`✅ [STEP 8] Using popup window for booking form`);
            break;
          }
        }
      }
      
      // Define popup selectors at function level so they're accessible everywhere
      const popupSelectors = [
        '.dx-popup-wrapper:has-text("Price")',
        '.dx-popup-wrapper:has-text("Booking")',
        '.dx-popup-wrapper:has-text("1. Price")',
        '.dx-popup-wrapper:has-text("Booking options")',
        '.dx-popup-wrapper:has(#priceDetailsContainer)',
        '.dx-popup-wrapper:has(.jqx_form)',
        '.dx-popup-wrapper .dx-wizard',
        '.dx-popup-wrapper .dx-wizard-step',
        '.dx-popup.dx-popup-fullscreen',
        '.dx-popup-wrapper[role="dialog"]',
        '.dx-popup-wrapper:visible',
        '.dx-popup-content:has-text("Price")',
        '.dx-popup-content:has-text("Booking options")',
        '.dx-popup-content:has(#priceDetailsContainer)',
        '.dx-popup-content:has(.jqx_form)'
      ];
      
      // Determine if booking form is in an iframe, popup, or on main page
      let searchContext = targetPage;
      let bookingIframe = null;
      let popupContainer = null;
      let bookingFormContainer = null;
      
      // PRIORITY 0: Search for booking form containers FIRST (#priceDetailsContainer or .jqx_form)
      // This is the most reliable way to find the booking form regardless of where it is
      console.log('🔍 [STEP 8] PRIORITY 0: Searching for booking form containers (#priceDetailsContainer or .jqx_form)...');
      
      const bookingFormSelectors = [
        '#priceDetailsContainer',
        '.jqx_form',
        '#priceDetailsContainer .jqx_form',
        '.jqx_form:has(#priceDetailsContainer)'
      ];
      
      // Check main page first
      for (const selector of bookingFormSelectors) {
        const container = targetPage.locator(selector).first();
        if (await container.count() > 0) {
          const isVisible = await container.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 8] Found booking form container on main page: "${selector}"`);
            bookingFormContainer = container;
            searchContext = bookingFormContainer;
            break;
          }
        }
      }
      
      // Check within diaries iframe (nested popup scenario)
      if (!bookingFormContainer) {
        console.log('🔍 [STEP 8] Checking for booking form within diaries iframe...');
        const diariesIframeExists = await targetPage.locator('#newDiaryDefault_iframe').count() > 0;
        if (diariesIframeExists) {
          const diariesIframe = targetPage.frameLocator('#newDiaryDefault_iframe');
          
          // Check for booking form directly in iframe
          for (const selector of bookingFormSelectors) {
            const container = diariesIframe.locator(selector).first();
            if (await container.count() > 0) {
              const isVisible = await container.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [STEP 8] Found booking form container in diaries iframe: "${selector}"`);
                bookingFormContainer = container;
                searchContext = bookingFormContainer;
                break;
              }
            }
          }
          
          // Check for popup within diaries iframe
          if (!bookingFormContainer) {
            console.log('🔍 [STEP 8] Checking for popup within diaries iframe...');
            const iframePopupSelectors = [
              '.dx-popup-wrapper:has(#priceDetailsContainer)',
              '.dx-popup-wrapper:has(.jqx_form)',
              '.dx-popup-wrapper:visible',
              '[role="dialog"]:has(#priceDetailsContainer)',
              '[role="dialog"]:has(.jqx_form)'
            ];
            
            for (const popupSelector of iframePopupSelectors) {
              const popup = diariesIframe.locator(popupSelector).first();
              if (await popup.count() > 0) {
                const isVisible = await popup.isVisible().catch(() => false);
                if (isVisible) {
                  // Check if booking form is inside this popup
                  const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
                  if (await containerInPopup.count() > 0) {
                    console.log(`✅ [STEP 8] Found booking form in popup within diaries iframe: "${popupSelector}"`);
                    popupContainer = popup;
                    bookingFormContainer = containerInPopup;
                    searchContext = bookingFormContainer;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      // Check within eventNewBooking2_iframe (the actual booking form iframe)
      if (!bookingFormContainer) {
        console.log('🔍 [STEP 8] Checking for booking form within eventNewBooking2_iframe...');
        const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
        if (eventBookingIframeExists) {
          const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
          
          // Wait for iframe to load
          await targetPage.waitForTimeout(2000);
          await targetPage.evaluate((id) => {
            return new Promise((resolve) => {
              const iframe = document.querySelector(`#${id}`);
              if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                resolve(true);
              } else {
                setTimeout(() => resolve(true), 1000);
              }
            });
          }, 'eventNewBooking2_iframe');
          
          // Check for booking form directly in iframe
          for (const selector of bookingFormSelectors) {
            const container = eventBookingIframe.locator(selector).first();
            if (await container.count() > 0) {
              const isVisible = await container.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [STEP 8] Found booking form container in eventNewBooking2_iframe: "${selector}"`);
                bookingFormContainer = container;
                searchContext = bookingFormContainer;
                break;
              }
            }
          }
          
          // If container not found, use iframe as context
          if (!bookingFormContainer) {
            console.log('✅ [STEP 8] Using eventNewBooking2_iframe as search context');
            bookingIframe = eventBookingIframe;
            searchContext = eventBookingIframe;
          }
        }
      }
      
      // PRIORITY 1: Check for DevExtreme popup/dialog (if container not found yet)
      if (!bookingFormContainer) {
        console.log('🔍 [STEP 8] PRIORITY 1: Checking for DevExtreme popup/dialog...');
        
        for (const popupSelector of popupSelectors) {
          const popup = targetPage.locator(popupSelector).first();
          if (await popup.count() > 0) {
            const isVisible = await popup.isVisible().catch(() => false);
            if (isVisible) {
              // Check if booking form is inside this popup
              const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
              if (await containerInPopup.count() > 0) {
                console.log(`✅ [STEP 8] Found booking form in DevExtreme popup: "${popupSelector}"`);
                popupContainer = popup;
                bookingFormContainer = containerInPopup;
                searchContext = bookingFormContainer;
                break;
              } else {
                console.log(`✅ [STEP 8] Found DevExtreme popup (no booking form container yet): "${popupSelector}"`);
                popupContainer = popup;
                searchContext = popupContainer;
              }
            }
          }
        }
      }
      
      // PRIORITY 2: Check for generic popups (not just DevExtreme)
      if (!bookingFormContainer && !popupContainer) {
        console.log('🔍 [STEP 8] PRIORITY 2: Checking for generic popups/dialogs...');
        const genericPopupSelectors = [
          '[role="dialog"]:has(#priceDetailsContainer)',
          '[role="dialog"]:has(.jqx_form)',
          '[role="dialog"]:visible',
          '.popup:has(#priceDetailsContainer)',
          '.popup:has(.jqx_form)',
          '.popup:visible',
          '.modal:has(#priceDetailsContainer)',
          '.modal:has(.jqx_form)',
          '.modal:visible',
          '.dialog:has(#priceDetailsContainer)',
          '.dialog:has(.jqx_form)',
          '.dialog:visible'
        ];
        
        for (const popupSelector of genericPopupSelectors) {
          const popup = targetPage.locator(popupSelector).first();
          if (await popup.count() > 0) {
            const isVisible = await popup.isVisible().catch(() => false);
            if (isVisible) {
              // Check if booking form is inside this popup
              const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
              if (await containerInPopup.count() > 0) {
                console.log(`✅ [STEP 8] Found booking form in generic popup: "${popupSelector}"`);
                popupContainer = popup;
                bookingFormContainer = containerInPopup;
                searchContext = bookingFormContainer;
                break;
              }
            }
          }
        }
      }
      
      // PRIORITY 3: Check for iframes that might contain the booking form
      // NOTE: Excluding 'newDiaryDefault_iframe' as it's the diaries iframe, not the booking form
      if (!bookingFormContainer && !popupContainer) {
        console.log('🔍 [STEP 8] PRIORITY 3: Checking for booking form iframe...');
        const possibleIframeIds = [
          'eventNewBooking2_iframe',  // This is the actual booking form iframe!
          'booking_iframe',
          'diaryNewCourseBooking_iframe',
          'courseBooking_iframe',
          'bookingWizard_iframe',
          'newBooking_iframe'
        ];
        
        for (const iframeId of possibleIframeIds) {
          const iframeExists = await targetPage.locator(`#${iframeId}`).count() > 0;
          if (iframeExists) {
            console.log(`✅ [STEP 8] Found iframe: #${iframeId}`);
            bookingIframe = targetPage.frameLocator(`#${iframeId}`);
            
            // Check if booking form is in this iframe
            for (const selector of bookingFormSelectors) {
              const container = bookingIframe.locator(selector).first();
              if (await container.count() > 0) {
                const isVisible = await container.isVisible().catch(() => false);
                if (isVisible) {
                  console.log(`✅ [STEP 8] Found booking form container in iframe #${iframeId}: "${selector}"`);
                  bookingFormContainer = container;
                  searchContext = bookingFormContainer;
                  break;
                }
              }
            }
            
            if (bookingFormContainer) {
              break;
            }
            
            // Wait for iframe to load
            await targetPage.waitForTimeout(2000);
            await targetPage.evaluate((id) => {
              return new Promise((resolve) => {
                const iframe = document.querySelector(`#${id}`);
                if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                  resolve(true);
                } else {
                  setTimeout(() => resolve(true), 1000);
                }
              });
            }, iframeId);
            
            // Use iframe as context if no container found yet
            if (!bookingFormContainer) {
              searchContext = bookingIframe;
            }
            break;
          }
        }
      }
      
      // PRIORITY 4: Fallback to main page if nothing found
      if (!bookingFormContainer && !popupContainer && !bookingIframe) {
        console.log('🔍 [STEP 8] PRIORITY 4: No container/popup/iframe found, using main page...');
        searchContext = targetPage;
      }
      
      // Debug: Log what we're searching in
      console.log('📊 [STEP 8] Context detection summary:');
      if (bookingFormContainer) {
        console.log('   ✅ Booking form container found - using as search context');
      } else if (popupContainer) {
        console.log('   ✅ Popup container found - using as search context');
      } else if (bookingIframe) {
        console.log('   ✅ Iframe found - using as search context');
      } else {
        console.log('   ⚠️ Using main page as search context');
      }
      
      // Try multiple selectors for "1. Price" header
      console.log('🔍 [STEP 8] Looking for "1. Price" header...');
      const priceHeaderSelectors = [
        'text=1. Price',
        'text="1. Price"',
        '*:has-text("1. Price")',
        'span:has-text("1. Price")',
        'div:has-text("1. Price")',
        '*:has-text("Price")',
        '.dx-wizard-step[aria-selected="true"]:has-text("Price")',
        '[role="tab"]:has-text("Price")'
      ];
      
      let priceHeader = null;
      for (const selector of priceHeaderSelectors) {
        try {
          priceHeader = searchContext.locator(selector).first();
          const count = await priceHeader.count();
          if (count > 0) {
            const isVisible = await priceHeader.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 8] Found "1. Price" using selector: "${selector}"`);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // If still not found, try waiting with a more flexible approach
      if (!priceHeader || await priceHeader.count() === 0) {
        console.log('⚠️ [STEP 8] "1. Price" not found with standard selectors, trying alternative approach...');
        await targetPage.waitForTimeout(2000);
        
        // Try to find any element containing "Price" in the visible text
        const anyPriceElement = searchContext.locator('*:has-text("Price")').first();
        if (await anyPriceElement.count() > 0) {
          const text = await anyPriceElement.textContent();
          if (text && text.includes('Price')) {
            console.log(`✅ [STEP 8] Found element with "Price" text: "${text.substring(0, 50)}"`);
            priceHeader = anyPriceElement;
          }
        }
      }
      
      // If still not found, proceed anyway (page might be loaded but selector is different)
      if (!priceHeader || await priceHeader.count() === 0) {
        console.log('⚠️ [STEP 8] Could not find "1. Price" header, but proceeding to check for booking options...');
        await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', this.screenshotsDir);
      } else {
        // Wait for price header to be visible
        await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
          console.log('⚠️ [STEP 8] Price header visibility check timed out, continuing...');
        });
        
        // Take screenshot of price page
        await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', this.screenshotsDir);
      }
      
      // Scroll to booking options
      console.log('📜 [STEP 8] Scrolling to booking options...');
      const bookingOptionsSelectors = [
        'text=Booking options',
        'span:has-text("Booking options")',
        'div:has-text("Booking options")',
        '*:has-text("Booking options")'
      ];
      
      let bookingOptionsSection = null;
      for (const selector of bookingOptionsSelectors) {
        try {
          bookingOptionsSection = searchContext.locator(selector).first();
          if (await bookingOptionsSection.count() > 0) {
            const isVisible = await bookingOptionsSection.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 8] Found "Booking options" using selector: "${selector}"`);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (bookingOptionsSection && await bookingOptionsSection.count() > 0) {
        await bookingOptionsSection.scrollIntoViewIfNeeded();
      } else {
        console.log('⚠️ [STEP 8] Could not find "Booking options" section, scrolling to bottom...');
        await targetPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      }
      
      // WAIT FOR OPTIONS TO BE VISIBLE - 2 seconds
      console.log('⏳ [STEP 8] Waiting for booking options to be visible...');
      await page.waitForTimeout(2000);
      
      // Select bike type from Booking options (ITM only offers 3 options as per documents)
      console.log('🚲 [STEP 8] Selecting bike type from Booking options...');
      await searchContext.locator('text=/Booking options/i').scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
      
      const bikeType = bookingArgs.bikeType || '125cc automatic';
      
      const bikeTypeMap = {
        '125cc automatic': /125cc automatic.*scooter/i,
        '50cc automatic': /50cc automatic/i,
        '125cc manual': /125cc manual.*geared/i
      };
      
      const bikePattern = bikeTypeMap[bikeType] || bikeTypeMap['125cc automatic'];
      console.log(`✅ [STEP 8] Selecting bike type: ${bikeType}`);
      
      // Find and select the bike type option using div-based checkbox structure
      // Options are in: .jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable
      // Checkbox is: .jqx_inputBookingOptionsSelect_check
      // Option text is in: .optionName span
      const allOptions = searchContext.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await allOptions.count();
      console.log(`🔍 [STEP 8] Found ${optionCount} selectable booking options`);
      
      let matchingOption = null;
      let matchingRowIndex = -1;
      
      // Iterate through all options to find matching bike type
      for (let i = 0; i < optionCount; i++) {
        const optionRow = allOptions.nth(i);
        const optionNameSpan = optionRow.locator('.optionName span');
        
        if (await optionNameSpan.count() > 0) {
          const optionText = await optionNameSpan.textContent();
          const normalizedText = optionText ? optionText.trim().toLowerCase() : '';
          
          // Check if option text matches the bike type pattern
          if (normalizedText && bikePattern.test(normalizedText)) {
            console.log(`✅ [STEP 8] Found matching option at index ${i}: "${optionText}"`);
            matchingOption = optionRow;
            matchingRowIndex = i;
            break;
          }
        }
      }
      
      if (matchingOption && matchingRowIndex >= 0) {
        // Click the checkbox div inside the matching row
        const checkDiv = matchingOption.locator('.jqx_inputBookingOptionsSelect_check').first();
        if (await checkDiv.count() > 0) {
          await checkDiv.click();
          console.log(`✅ [STEP 8] Clicked checkbox for bike type option at index ${matchingRowIndex}`);
        } else {
          // Fallback: click the row itself
          await matchingOption.click();
          console.log(`✅ [STEP 8] Clicked row for bike type option at index ${matchingRowIndex}`);
        }
      } else {
        // Fallback: try selecting first available option
        console.log('⚠️ [STEP 8] No matching bike type option found, selecting first available option');
        const firstOption = searchContext.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable').first();
        if (await firstOption.count() > 0) {
          const checkDiv = firstOption.locator('.jqx_inputBookingOptionsSelect_check').first();
          if (await checkDiv.count() > 0) {
            await checkDiv.click();
            console.log('✅ [STEP 8] Selected first available option as fallback');
          } else {
            await firstOption.click();
            console.log('✅ [STEP 8] Clicked first available option row as fallback');
          }
        } else {
          throw new Error('No selectable booking options found on price page');
        }
      }
      
      await page.waitForTimeout(1000);
      
      console.log(`✅ [STEP 8] Selected bike type option from booking form`);
      
      // Wait for selection to register
      await page.waitForTimeout(1000);
      
      // Take screenshot after selection
      await commonSteps.takeScreenshot(targetPage, this.screenshotsDir, 'bike-option-selected.png');
      
      // Click NEXT button using the specific ID from HTML structure
      console.log('➡️ [STEP 8] Clicking NEXT...');
      let nextButton = searchContext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
      
      // FALLBACK: Try alternative contexts if button not found
      if (await nextButton.count() === 0) {
        console.log('⚠️ [STEP 8] Next button not found in current context, trying fallback contexts...');
        
        // Strategy 1: Try within eventNewBooking2_iframe if we're using container context
        if (bookingFormContainer && !bookingIframe) {
          console.log('🔍 [STEP 8] Trying eventNewBooking2_iframe context for Next button...');
          const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
          if (eventBookingIframeExists) {
            const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
            const iframeNextButton = eventBookingIframe.locator('#diaryNewCourseBookingWiz_nextBtn').first();
            if (await iframeNextButton.count() > 0) {
              console.log('✅ [STEP 8] Found Next button in eventNewBooking2_iframe!');
              nextButton = iframeNextButton;
            }
          }
        }
        
        // Strategy 2: Try main page
        if ((await nextButton.count() === 0) && (popupContainer || bookingIframe || bookingFormContainer)) {
          const mainPageNextButton = targetPage.locator('#diaryNewCourseBookingWiz_nextBtn').first();
          if (await mainPageNextButton.count() > 0) {
            console.log('✅ [STEP 8] Found Next button on main page!');
            nextButton = mainPageNextButton;
          }
        }
        
        // Strategy 3: Try popup if not found (now popupSelectors is accessible)
        if ((await nextButton.count() === 0) && !popupContainer) {
          for (const popupSelector of popupSelectors) {
            const popup = targetPage.locator(popupSelector).first();
            if (await popup.count() > 0) {
              const isVisible = await popup.isVisible().catch(() => false);
              if (isVisible) {
                const popupNextButton = popup.locator('#diaryNewCourseBookingWiz_nextBtn').first();
                if (await popupNextButton.count() > 0) {
                  console.log(`✅ [STEP 8] Found Next button in popup: "${popupSelector}"`);
                  nextButton = popupNextButton;
                  break;
                }
              }
            }
          }
        }
      }
      
      if (await nextButton.count() === 0) {
        // Fallback: try other selectors in current context
        const nextButtonFallback = searchContext.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
        if (await nextButtonFallback.count() > 0) {
          await nextButtonFallback.click();
        } else {
          // Try main page with fallback selectors
          const mainPageFallback = targetPage.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
          if (await mainPageFallback.count() > 0) {
            console.log('✅ [STEP 8] Found Next button on main page with fallback selector!');
            await mainPageFallback.click();
          } else {
            throw new Error('Next button not found on booking options page');
          }
        }
      } else {
        await nextButton.waitFor({ state: 'visible', timeout: 5000 });
        await nextButton.click();
      }
      
      // WAIT FOR NEXT PAGE TO LOAD - Handle iframe navigation properly
      console.log('⏳ [STEP 8] Waiting for next page to load...');
      await page.waitForTimeout(3000);
      
      // If we're working in an iframe, wait for iframe content to update instead of main page
      if (bookingIframe || bookingFormContainer) {
        console.log('🔍 [STEP 8] Waiting for iframe content to update after navigation...');
        try {
          const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
          if (eventBookingIframeExists) {
            const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
            // Wait for iframe to be ready and check for new page content (contact lookup page)
            await page.waitForTimeout(2000);
            // Try to find indicators of the next page (contact lookup or add new contact)
            const contactLookupIndicators = eventBookingIframe.locator('text=lookup, text=contact, text=add new contact, button:has-text("lookup"), button:has-text("contact")').first();
            await contactLookupIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
              console.log('⚠️ [STEP 8] Contact lookup page indicators not found, but continuing...');
            });
            console.log('✅ [STEP 8] Iframe content updated - next page loaded');
          }
        } catch (e) {
          console.log(`⚠️ [STEP 8] Iframe wait check failed: ${e.message}, continuing...`);
        }
      } else {
        // Main page context - use normal wait
        await page.waitForLoadState('networkidle').catch(() => {
          console.log('⚠️ [STEP 8] Network idle wait failed, continuing...');
        });
      }
      
      console.log('✅ [STEP 8] Booking options selected and Next button clicked');
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      await commonSteps.takeScreenshot(page, 'booking-options-error.png', this.screenshotsDir);
      throw new Error(`Failed to select booking options: ${error.message}`);
    }
  }

  async executeITMBookingDemo(page) {
    // This method is for testing/demo purposes
    // Uses test data from environment variables
    // Workflow is identical to production - only difference is data source (env vs voice)
    
    // Load test data from environment
    const testMobile = process.env.TEST_CLIENT_MOBILE;
    const testEmail = process.env.TEST_CLIENT_EMAIL || process.env.CLIENT_EMAIL_ADDRESS;
    const testFullName = process.env.TEST_CLIENT_FULL_NAME;
    const testPostcode = process.env.TEST_CLIENT_POSTCODE;
    const testTelephone = process.env.TEST_CLIENT_TELEPHONE;
    
    if (!testMobile && !testEmail) {
      throw new Error('TEST_CLIENT_MOBILE or TEST_CLIENT_EMAIL (or CLIENT_EMAIL_ADDRESS) environment variable must be set');
    }
    
    if (!testFullName || !testPostcode || !testTelephone) {
      throw new Error('TEST_CLIENT_FULL_NAME, TEST_CLIENT_POSTCODE, and TEST_CLIENT_TELEPHONE environment variables must be set for verification');
    }

    // Generate test callSid for state tracking
    const testCallSid = `test-${Date.now()}`;
    
    // Initialize conversation state (same as production)
    // Note: Test sessions (starting with 'test-') are excluded from automatic cleanup
    const { conversations } = await import('../shared/state.js');
    const now = Date.now();
    conversations[testCallSid] = {
      transcript: [],
      language: 'en',
      startTime: now,
      lastActivityTime: now, // Set lastActivityTime to prevent immediate cleanup
      mobileSearchAttempts: {
        count: 0,
        lastAttempt: null,
        values: [],
        lastAttemptTime: null
      },
      verificationAttempts: {
        fullName: 0,
        postcode: 0,
        telephoneNumber: 0
      },
      clientDetails: null,
      clientVerified: false,
      clientVerifiedAt: null,
      verificationMethod: null,
      bookingConsent: {
        given: false,
        timestamp: null,
        dryRunDiff: null
      },
      policyCheck: {
        performed: false,
        timestamp: null,
        results: null
      }
    };

    // Create callContext with callSid for state tracking
    const callContext = {
      callSid: testCallSid
    };

    // Prepare booking arguments with test data
    const bookingArgs = {
      workflowType: 'existing',
      customerMobile: testMobile,
      customerEmail: testEmail,
      preferredDate: process.env.TEST_PREFERRED_DATE || '2026-03-29',
      preferredTime: process.env.TEST_PREFERRED_TIME || '17:00',
      location: process.env.TEST_LOCATION || 'Croydon, South London, CR0',
      // ITM-specific preferences
      bikeType: process.env.TEST_BIKE_TYPE || null,
      // Terms acceptance (convert string to boolean)
      termsAccepted: process.env.TEST_TERMS_ACCEPTED === 'true' || process.env.TEST_TERMS_ACCEPTED === '1' || false
    };

    console.log(`🧪 [TEST] Starting ITM booking demo with callSid: ${testCallSid}`);
    console.log(`🧪 [TEST] Using mobile: ${testMobile}, email: ${testEmail}`);

    let workflowResult;
    let maxIterations = 10; // Safety limit to prevent infinite loops
    let iteration = 0;

    // Execute workflow and handle all return states (same as agent would)
    while (iteration < maxIterations) {
      iteration++;
      console.log(`🧪 [TEST] Workflow iteration ${iteration}...`);

      // Call the booking workflow
      workflowResult = await this.executeBookingWorkflow(page, bookingArgs, callContext);

      // Handle retry prompt (mobile search failed)
      if (workflowResult.retryPrompt) {
        console.log(`🧪 [TEST] Received retry prompt: ${workflowResult.retryPrompt}`);
        const conversation = conversations[testCallSid];
        if (!conversation) {
          throw new Error(`Session ${testCallSid} was cleaned up during workflow`);
        }
        const attemptCount = conversation.mobileSearchAttempts?.count || 0;
        
        if (attemptCount >= 3) {
          // After 3 mobile attempts, switch to email search
          console.log(`🧪 [TEST] Mobile search exhausted after ${attemptCount} attempts, switching to email search`);
          bookingArgs.customerMobile = null; // Remove mobile to force email search
          continue; // Retry with email
        } else {
          // Simulate agent retrying with same mobile (for testing retry logic)
          // In real scenario, agent would ask user for mobile again
          console.log(`🧪 [TEST] Simulating mobile retry attempt ${attemptCount + 1}`);
          continue; // Retry with same mobile to test retry tracking
        }
      }

      // Handle verification requirement
      if (workflowResult.requiresVerification) {
        console.log(`🧪 [TEST] Client found, verification required`);
        console.log(`🧪 [TEST] Verification prompt: ${workflowResult.verificationPrompt}`);
        
        // Simulate agent calling client_verification tool with env data
        const clientVerificationTool = (await import('../tools/clientVerification.js')).default;
        const verificationResult = await clientVerificationTool.execute({
          fullName: testFullName,
          postcode: testPostcode,
          telephoneNumber: testTelephone
        }, callContext);

        if (verificationResult.verified) {
          console.log(`✅ [TEST] Client verification successful`);
          // Mark as verified in callContext so workflow continues
          callContext.clientVerified = true;
          const conversation = conversations[testCallSid];
          if (conversation) {
            conversation.clientVerified = true;
          }
          // Continue workflow
          continue;
        } else {
          throw new Error(`Client verification failed: ${verificationResult.message || 'Unknown error'}`);
        }
      }

      // Handle customer info requirement
      if (workflowResult.requiresCustomerInfo) {
        console.log(`🧪 [TEST] Customer info required: ${workflowResult.message}`);
        // This shouldn't happen in test mode as we provide all data upfront
        throw new Error(`Customer info required but should be provided from env: ${workflowResult.message}`);
      }

      // Handle preferences requirement
      if (workflowResult.requiresPreferences) {
        console.log(`🧪 [TEST] Booking preferences required: ${workflowResult.message}`);
        console.log(`🧪 [TEST] Missing preferences: ${JSON.stringify(workflowResult.missingPreferences || [])}`);
        console.log(`🧪 [TEST] Valid options: ${JSON.stringify(workflowResult.validOptions || {})}`);
        
        // Read missing preferences from env and add to bookingArgs
        const missingPrefs = workflowResult.missingPreferences || [];
        const validOptions = workflowResult.validOptions || {};
        
        for (const pref of missingPrefs) {
          const envVarName = `TEST_${pref.toUpperCase()}`;
          const envValue = process.env[envVarName];
          
          if (envValue) {
            console.log(`🧪 [TEST] Found ${pref} in env: ${envValue}`);
            bookingArgs[pref] = envValue;
          } else {
            // Try to get default from validOptions
            let defaultValue = null;
            
            // Check if validOptions is an object with the preference as a key
            if (validOptions[pref] && Array.isArray(validOptions[pref]) && validOptions[pref].length > 0) {
              defaultValue = validOptions[pref][0]; // Use first valid option as default
            } 
            // Check if validOptions is directly an array (for single preference)
            else if (Array.isArray(validOptions) && validOptions.length > 0) {
              defaultValue = validOptions[0];
            }
            
            if (defaultValue) {
              console.log(`🧪 [TEST] Using default ${pref}: ${defaultValue} (from valid options)`);
              bookingArgs[pref] = defaultValue;
            } else {
              const optionsDisplay = validOptions[pref] ? JSON.stringify(validOptions[pref]) : JSON.stringify(validOptions);
              throw new Error(`Missing required preference "${pref}" - please set ${envVarName} in .env file. Valid options: ${optionsDisplay}`);
            }
          }
        }
        
        // Retry workflow with updated preferences
        console.log(`🧪 [TEST] Retrying workflow with updated preferences...`);
        continue;
      }

      // If workflow completed successfully or failed, break
      if (workflowResult.success !== undefined) {
        break;
      }

      // If we get here without a clear result, something unexpected happened
      console.warn(`⚠️ [TEST] Unexpected workflow result state, breaking loop`);
      break;
    }

    if (iteration >= maxIterations) {
      throw new Error('Workflow exceeded maximum iterations - possible infinite loop');
    }

    // Get final conversation state for reporting
    const conversation = conversations[testCallSid];
    if (!conversation) {
      console.warn(`⚠️ [TEST] Session ${testCallSid} was cleaned up before completion`);
      // Return default state if session was cleaned up
      return {
        success: workflowResult.success !== false,
        sessionDetails: workflowResult.sessionDetails,
        screenshots: workflowResult.screenshots || [],
        clientEmail: workflowResult.clientEmail || testEmail,
        testState: {
          mobileSearchAttempts: { count: 0 },
          verificationAttempts: { fullName: 0, postcode: 0, telephoneNumber: 0 },
          clientVerified: false,
          policyCheck: { performed: false }
        },
        workflowSteps: {
          mobileSearchAttempts: 0,
          verificationCompleted: false,
          policyCheckPerformed: false,
          confirmationEmailSent: workflowResult.confirmationEmailSent || false
        }
      };
    }
    
    const finalState = {
      mobileSearchAttempts: conversation.mobileSearchAttempts || { count: 0 },
      verificationAttempts: conversation.verificationAttempts || { fullName: 0, postcode: 0, telephoneNumber: 0 },
      clientVerified: conversation.clientVerified || false,
      policyCheck: conversation.policyCheck || { performed: false }
    };

    console.log(`✅ [TEST] ITM booking demo completed`);
    console.log(`🧪 [TEST] Final state:`, JSON.stringify(finalState, null, 2));

    // Clean up test conversation state (optional - keep for debugging)
    // delete conversations[testCallSid];

    return {
      success: workflowResult.success,
      sessionDetails: workflowResult.sessionDetails,
      screenshots: workflowResult.screenshots || [],
      clientEmail: workflowResult.clientEmail || testEmail,
      testState: finalState,
      workflowSteps: {
        mobileSearchAttempts: finalState.mobileSearchAttempts?.count || 0,
        verificationCompleted: finalState.clientVerified || false,
        policyCheckPerformed: finalState.policyCheck?.performed || false,
        confirmationEmailSent: workflowResult.confirmationEmailSent || false
      }
    };
  }
}

export default new ITMBookingService();

