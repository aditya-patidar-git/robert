import fs from 'fs';
import path from 'path';
import * as commonSteps from './commonBookingSteps/index.js';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';

class TfLBeyondCbtBookingService {
  constructor() {
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: process.env.CRM_LOGIN || 'universalmct',
      username: process.env.CRM_USERNAME || 'auagent',
      password: process.env.CRM_PASSWORD || 'Robert2025!',
      availabilityUrl: 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=4A4B4A440C24B86F'
    };
    this.screenshotsDir = './screenshots/tfl-beyond-cbt-booking';
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  async executeBookingWorkflow(page, bookingArgs, callContext = {}) {
    const screenshots = [];
    let sessionDetails = null;
    const workflowType = bookingArgs.workflowType || 'existing';

    try {
      console.log(`🚀 Starting TfL Beyond CBT booking workflow (${workflowType} client)...`);

      sessionDetails = bookingArgs.sessionDetails;
      if (!sessionDetails) {
        console.warn('⚠️ No availability data found - creating default sessionDetails to continue workflow');
        sessionDetails = {
          date: bookingArgs.preferredDate ? new Date(bookingArgs.preferredDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBD',
          course: 'TfL Beyond CBT - Skills for Delivery Riders',
          location: bookingArgs.location || 'TBD',
          time: bookingArgs.preferredTime || 'TBD',
          price: 'FREE',
          instructor: 'TBD',
          startDate: bookingArgs.preferredDate || new Date().toISOString().split('T')[0],
          monthYear: bookingArgs.preferredDate ? new Date(bookingArgs.preferredDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
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
        
        const currentUrl = page.url();
        if (currentUrl.includes('bookcbtnow.com') || currentUrl.includes('gateway.aspx')) {
          console.log('🔐 Step 2: Navigating to CRM dashboard (page was on availability URL)...');
          await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
          await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
          console.log('✅ Step 2: Confirmed on CRM dashboard');
        }
        
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-login-success.png', this.screenshotsDir));
        console.log('✅ Step 2 completed: Login successful');
      } else {
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

      if (workflowType === 'existing') {
        // EXISTING CLIENT WORKFLOW
        console.log('👤 Step 4-5: Finding existing client...');
        
        if (!bookingArgs.customerMobile && !bookingArgs.customerPhone && !bookingArgs.customerEmail) {
          console.log('⚠️ Step 4-5: Customer info missing - asking agent to collect');
          return {
            success: false,
            requiresCustomerInfo: true,
            message: 'To search for your existing profile, I need either your mobile number or email address. Could you please provide one of these?',
            workflowType: 'existing'
          };
        }
        
        let searchType = 'email';
        let searchValue = bookingArgs.customerEmail;
        
        if (bookingArgs.customerMobile || bookingArgs.customerPhone) {
          searchType = 'mobile';
          searchValue = bookingArgs.customerMobile || bookingArgs.customerPhone;
          console.log('🔍 Service: Searching by mobile number first:', searchValue);
        } else if (bookingArgs.customerEmail) {
          searchType = 'email';
          searchValue = bookingArgs.customerEmail;
          console.log('🔍 Service: Searching by email:', searchValue);
        }
        
        const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, this.screenshotsDir, bookingArgs.customerEmail);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-5-client-found.png', this.screenshotsDir));
        
        if (!searchResult.found) {
          if (searchType === 'mobile' && bookingArgs.customerEmail) {
            console.log('⚠️ Mobile search failed, trying email search...');
            const emailSearchResult = await commonSteps.findAndVerifyClient(page, 'email', bookingArgs.customerEmail, this.screenshotsDir, bookingArgs.customerEmail);
            if (emailSearchResult.found) {
              if (emailSearchResult.clientDetails) {
                callContext.clientDetails = emailSearchResult.clientDetails;
                bookingArgs.clientDetails = emailSearchResult.clientDetails;
              }
              console.log('✅ Step 4-5 completed: Client found via email - requires verbal verification');
            } else {
              throw new Error('Could not find client with mobile number or email address');
            }
          } else {
            throw new Error('Could not find client in CRM');
          }
        } else {
          if (searchResult.clientDetails) {
            callContext.clientDetails = searchResult.clientDetails;
            bookingArgs.clientDetails = searchResult.clientDetails;
          }
          console.log('✅ Step 4-5 completed: Client found - requires verbal verification');
        }
        
        if (searchResult.requiresVerification || (searchResult.found && !callContext.clientVerified)) {
          return {
            success: false,
            requiresVerification: true,
            clientDetails: searchResult.clientDetails || callContext.clientDetails,
            message: 'Client found but requires verbal verification before proceeding with booking'
          };
        }

        // STEP 6: Navigate to Diaries and select session (TfL Diary)
        console.log('📅 Step 6: Navigating to TfL Diaries and selecting session...');
        await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir, 'TfL Diary');
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-session-selected.png', this.screenshotsDir));
        console.log('✅ Step 6 completed: Session selected');

        // STEP 7: Select booking options
        console.log('⚙️ Step 7: Selecting TfL Beyond CBT booking options...');
        const bookingOptionsResult = await this.selectBookingOptions(page, bookingArgs);
        
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

        // STEP 9: Payment (No payment required for TfL courses)
        console.log('💳 Step 9: Selecting payment option (No payment required)...');
        await commonSteps.selectPaymentOption(page, this.screenshotsDir, 'none');
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-payment-option-selected.png', this.screenshotsDir));
        await page.waitForTimeout(2000);
        
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
        console.log('✅ Step 9 completed: Booking made (no payment required)');

        // STEP 10: Send booking confirmation email
        console.log('📧 Step 10: Sending booking confirmation email...');
        await commonSteps.sendBookingConfirmationEmail(page, this.screenshotsDir, 'tfl');
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-10-confirmation-email-sent.png', this.screenshotsDir));
        console.log('✅ Step 10 completed: Booking confirmation email sent');

        // STEP 11: Send Terms & Conditions email
        console.log('📧 Step 11: Sending Terms & Conditions email...');
        await commonSteps.sendTermsAndConditionsEmail(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-11-terms-email-sent.png', this.screenshotsDir));
        console.log('✅ Step 11 completed: Terms & Conditions email sent');

        // STEP 12: Send SMS confirmation
        console.log('📱 Step 12: Sending SMS confirmation...');
        await commonSteps.sendSMSConfirmation(page, this.screenshotsDir, 'tfl-beyond-cbt');
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-12-sms-sent.png', this.screenshotsDir));
        console.log('✅ Step 12 completed: SMS confirmation sent');

      } else {
        // NEW CLIENT WORKFLOW
        // STEP 4: Navigate to Diaries and select session (TfL Diary)
        console.log('📅 Step 4: Navigating to TfL Diaries and selecting session...');
        await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir, 'TfL Diary');
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-session-selected.png', this.screenshotsDir));
        console.log('✅ Step 4 completed: Session selected');

        // STEP 5: Select booking options
        console.log('⚙️ Step 5: Selecting TfL Beyond CBT booking options...');
        const bookingOptionsResult = await this.selectBookingOptions(page, bookingArgs);
        
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

        // Validate age (16+ for TfL courses)
        if (contactDetails.dateOfBirth) {
          console.log('🔍 Step 7: Validating age (16+ required for TfL Beyond CBT)...');
          await commonSteps.validateAge(page, this.screenshotsDir, 'tfl', 16);
          console.log('✅ Step 7: Age validation passed');
        }

        // STEP 8: Payment (No payment required for TfL courses)
        console.log('💳 Step 8: Selecting payment option (No payment required)...');
        await commonSteps.selectPaymentOption(page, this.screenshotsDir, 'none');
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-payment-option-selected.png', this.screenshotsDir));
        await page.waitForTimeout(2000);
        
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
        console.log('✅ Step 8 completed: Booking made (no payment required)');

        // STEP 9: Send booking confirmation email
        console.log('📧 Step 9: Sending booking confirmation email...');
        await commonSteps.sendBookingConfirmationEmail(page, this.screenshotsDir, 'tfl');
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-confirmation-email-sent.png', this.screenshotsDir));
        console.log('✅ Step 9 completed: Booking confirmation email sent');

        // STEP 10: Send Terms & Conditions email
        console.log('📧 Step 10: Sending Terms & Conditions email...');
        await commonSteps.sendTermsAndConditionsEmail(page, this.screenshotsDir);
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-10-terms-email-sent.png', this.screenshotsDir));
        console.log('✅ Step 10 completed: Terms & Conditions email sent');

        // STEP 11: Send SMS confirmation
        console.log('📱 Step 11: Sending SMS confirmation...');
        await commonSteps.sendSMSConfirmation(page, this.screenshotsDir, 'tfl-beyond-cbt');
        screenshots.push(await commonSteps.takeScreenshot(page, 'step-11-sms-sent.png', this.screenshotsDir));
        console.log('✅ Step 11 completed: SMS confirmation sent');
      }

      console.log('🎉 Service: All steps completed successfully!');
      return {
        success: true,
        sessionDetails,
        screenshots,
        clientEmail: bookingArgs.customerEmail
      };

    } catch (error) {
      console.error('❌ TfL Beyond CBT booking failed at step:', error.message);
      console.error('❌ Service: Error stack:', error.stack);
      screenshots.push(await commonSteps.takeScreenshot(page, 'error-state.png', this.screenshotsDir));
      
      const errorContext = getErrorContext(error, 'create_booking');
      const userFriendlyError = formatUserFriendlyError(error, errorContext);
      
      return {
        success: false,
        error: userFriendlyError,
        technicalError: error.message,
        sessionDetails: sessionDetails,
        screenshots: screenshots,
        clientEmail: bookingArgs.customerEmail
      };
    }
  }

  // STEP 1: Check availability and note details (TfL Beyond CBT-specific)
  async checkAvailabilityAndNoteDetails(page) {
    try {
      console.log('📅 Navigating to TfL Beyond CBT availability page...');
      
      await page.goto(this.crmCredentials.availabilityUrl);
      await page.waitForLoadState('networkidle');
      
      await commonSteps.takeScreenshot(page, 'availability-page-loaded.png', this.screenshotsDir);
      
      await page.waitForSelector('#availabilityTable', { timeout: 10000 });
      
      const availabilityTable = page.locator('#availabilityTable');
      await availabilityTable.waitFor({ state: 'visible' });
      
      await page.waitForSelector('#availabilityTable tbody tr.availabilityDataRow', { timeout: 10000 });
      
      const lastMonthCell = availabilityTable.locator('td.availabilityMonthCell').last();
      const latestMonthYear = (await lastMonthCell.textContent()).trim();
      
      console.log(`📅 Latest month found: ${latestMonthYear}`);
      
      const allDataRows = availabilityTable.locator('tbody tr.availabilityDataRow');
      const rowCount = await allDataRows.count();
      
      console.log(`📊 Total data rows found: ${rowCount}`);
      
      const lastDataRow = allDataRows.last();
      await lastDataRow.waitFor({ state: 'visible' });
      
      const sessionDetails = {
        date: (await lastDataRow.locator('td').nth(0).textContent()).trim(),
        course: (await lastDataRow.locator('td').nth(1).textContent()).trim(),
        location: (await lastDataRow.locator('td').nth(2).textContent()).trim(),
        time: (await lastDataRow.locator('td').nth(3).textContent()).trim(),
        price: (await lastDataRow.locator('td').nth(4).textContent()).trim(),
        instructor: (await lastDataRow.locator('td').nth(6).textContent()).trim().replace(/^Instructor:\s*/i, ''),
        startDate: await lastDataRow.getAttribute('data-start_date'),
        monthYear: latestMonthYear
      };
      
      console.log('📋 Extracted TfL Beyond CBT session details:', sessionDetails);
      return sessionDetails;
      
    } catch (error) {
      console.error('Error in checkAvailabilityAndNoteDetails:', error);
      throw new Error(`Failed to check TfL Beyond CBT availability: ${error.message}`);
    }
  }

  // STEP 7/5: Select booking options (TfL Beyond CBT-specific)
  async selectBookingOptions(page, bookingArgs) {
    try {
      console.log('⚙️ [STEP 7/5] Selecting TfL Beyond CBT booking options...');
      
      // Validate provided bike type (NO "Own bike" option for Beyond CBT)
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
        let message = `I'm sorry, but "${invalidPref.providedValue}" is not a valid bike type for the TfL Beyond CBT course. `;
        message += `Please choose one of: "${validBikeTypes.join('", "')}".`;
        
        return {
          requiresPreferences: true,
          invalidPreferences: invalidPreferences.map(p => p.preference),
          message: message,
          validOptions: {
            bikeType: validBikeTypes
          }
        };
      }
      
      // Check for missing required preferences
      const missingPreferences = [];
      if (!bookingArgs.bikeType) {
        missingPreferences.push('bikeType');
      }
      
      if (missingPreferences.length > 0) {
        let message = 'I need some additional information to proceed with your TfL Beyond CBT booking. ';
        message += 'Which bike type would you prefer: "125cc automatic (scooter)", "50cc automatic", or "125cc manual (geared)"?';
        
        return {
          requiresPreferences: true,
          missingPreferences: missingPreferences,
          message: message.trim(),
          validOptions: {
            bikeType: validBikeTypes
          }
        };
      }
      
      // Wait for price page to load
      console.log('⏳ [STEP 7/5] Waiting for price page to load...');
      await page.waitForTimeout(5000);
      
      // Check for popup windows
      const pages = page.context().pages();
      let targetPage = page;
      if (pages.length > 1) {
        console.log(`🔍 [STEP 7/5] Found ${pages.length} pages, checking for booking popup...`);
        for (let i = 0; i < pages.length; i++) {
          const pageTitle = await pages[i].title();
          const pageUrl = pages[i].url();
          if (pageTitle.includes('booking') || pageTitle.includes('Booking') || 
              pageUrl.includes('booking') || pageUrl.includes('Booking')) {
            targetPage = pages[i];
            console.log(`✅ [STEP 7/5] Using popup window for booking form`);
            break;
          }
        }
      }
      
      let searchContext = targetPage;
      let bookingIframe = null;
      
      const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
      if (eventBookingIframeExists) {
        bookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
        searchContext = bookingIframe;
        await targetPage.waitForTimeout(2000);
      }
      
      // Wait for "1. Price" header
      console.log('🔍 [STEP 7/5] Looking for "1. Price" header...');
      const priceHeader = searchContext.locator('text=1. Price, *:has-text("1. Price")').first();
      await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
        console.log('⚠️ [STEP 7/5] Price header visibility check timed out, continuing...');
      });
      
      await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', this.screenshotsDir);
      
      // Select bike type from Booking options
      console.log('🚲 [STEP 7/5] Selecting bike type from Booking options...');
      await searchContext.locator('text=/Booking options/i').scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
      
      const bikeType = bookingArgs.bikeType.trim().toLowerCase();
      
      const bikeTypeMap = {
        '125cc automatic': /125cc automatic.*scooter/i,
        '50cc automatic': /50cc automatic/i,
        '125cc manual': /125cc manual.*geared/i
      };
      
      const bikePattern = bikeTypeMap[bikeType] || bikeTypeMap['125cc automatic'];
      console.log(`✅ [STEP 7/5] Selecting bike type: ${bikeType}`);
      
      // Find and select the bike type option
      const bikeOption = searchContext.locator(`[role="radio"]:has-text("${bikePattern.source}"), input[type="radio"]`).filter({ hasText: bikePattern }).first();
      
      if (await bikeOption.count() === 0) {
        // Fallback: try selecting first available option
        const firstOption = searchContext.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable').first();
        if (await firstOption.count() > 0) {
          const checkDiv = firstOption.locator('.jqx_inputBookingOptionsSelect_check').first();
          if (await checkDiv.count() > 0) {
            await checkDiv.click();
          } else {
            await firstOption.click();
          }
        }
      } else {
        await bikeOption.check();
      }
      
      await page.waitForTimeout(1000);
      
      // Click NEXT button
      console.log('➡️ [STEP 7/5] Clicking NEXT...');
      let nextButton = searchContext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
      
      if (await nextButton.count() === 0) {
        nextButton = searchContext.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
      }
      
      if (await nextButton.count() === 0) {
        throw new Error('Next button not found on booking options page');
      }
      
      await nextButton.waitFor({ state: 'visible', timeout: 5000 });
      await nextButton.click();
      
      console.log('⏳ [STEP 7/5] Waiting for next page to load...');
      await page.waitForTimeout(3000);
      
      if (bookingIframe) {
        await page.waitForTimeout(2000);
        const contactLookupIndicators = bookingIframe.locator('text=lookup, text=contact, text=add new contact').first();
        await contactLookupIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
          console.log('⚠️ [STEP 7/5] Contact lookup page indicators not found, but continuing...');
        });
      }
      
      console.log('✅ [STEP 7/5] TfL Beyond CBT booking options selected and Next button clicked');
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      await commonSteps.takeScreenshot(page, 'booking-options-error.png', this.screenshotsDir);
      throw new Error(`Failed to select TfL Beyond CBT booking options: ${error.message}`);
    }
  }
}

export default new TfLBeyondCbtBookingService();

