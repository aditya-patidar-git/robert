import * as commonSteps from './commonBookingSteps/index.js';
import { BaseBookingService } from './commonBookingSteps/BaseBookingService.js';

class TfLBeyondCbtBookingService extends BaseBookingService {
  constructor() {
    super(
      'TfL Beyond CBT', // courseType
      'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=4A4B4A440C24B86F', // availabilityUrl
      './screenshots/tfl-beyond-cbt-booking' // screenshotsDir
    );
  }

  // Override executeExistingClientWorkflow to use TfL Diary and no payment
  async executeExistingClientWorkflow(page, bookingArgs, callContext, sessionDetails, screenshots, checkCancellation, updatePhase) {
    // STEP 4-5: Search for existing client with email fallback
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
    
    const callSid = callContext.callSid || 'unknown';
    const searchResult = await commonSteps.findAndVerifyClient(
      page, searchType, searchValue, this.screenshotsDir,
      bookingArgs.customerEmail, null, callSid
    );
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-5-client-found.png', this.screenshotsDir));
    
    if (!searchResult.found) {
      if (searchType === 'mobile' && bookingArgs.customerEmail) {
        console.log('⚠️ Mobile search failed, trying email search...');
        const emailSearchResult = await commonSteps.findAndVerifyClient(
          page, 'email', bookingArgs.customerEmail, this.screenshotsDir,
          bookingArgs.customerEmail, null, callSid
        );
        if (emailSearchResult.found) {
          if (emailSearchResult.clientDetails) {
            callContext.clientDetails = emailSearchResult.clientDetails;
            bookingArgs.clientDetails = emailSearchResult.clientDetails;
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
    }
    
    if (searchResult.requiresVerification || (searchResult.found && !callContext.clientVerified)) {
      return {
        success: false,
        requiresVerification: true,
        clientDetails: searchResult.clientDetails || callContext.clientDetails,
        message: 'Client found but requires verbal verification before proceeding with booking'
      };
    }

    // STEP 6: Navigate to TfL Diaries and select session
    updatePhase('step6_select_session');
    checkCancellation();
    await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir, 'TfL Diary');
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-session-selected.png', this.screenshotsDir));

    // STEP 7: Select booking options (course-specific)
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

    // STEP 9: Payment (No payment required for TfL courses)
    updatePhase('step9_payment');
    checkCancellation();
    const paymentResult = await this.step9ProcessPayment(page, bookingArgs, screenshots);
    const paymentCompleted = paymentResult.paymentCompleted || false;

    console.log('🎉 Service: All steps completed successfully!');
    return {
      success: true,
      sessionDetails,
      screenshots,
      clientEmail: bookingArgs.customerEmail,
      paymentCompleted: paymentCompleted
    };
  }

  // Override executeNewClientWorkflow to use TfL Diary and no payment
  async executeNewClientWorkflow(page, bookingArgs, callContext, sessionDetails, screenshots, checkCancellation, updatePhase) {
    // STEP 4: Navigate to TfL Diaries and select session
    updatePhase('step4_select_session');
    checkCancellation();
    await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir, 'TfL Diary');
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-session-selected.png', this.screenshotsDir));

    // STEP 5: Select booking options (course-specific)
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

    // Validate age (16+ for TfL courses)
    if (bookingArgs.dateOfBirth) {
      console.log('🔍 Step 7: Validating age (16+ required for TfL Beyond CBT)...');
      await commonSteps.validateAge(page, this.screenshotsDir, 'tfl', 16);
      console.log('✅ Step 7: Age validation passed');
    }

    // STEP 8: Payment (No payment required for TfL courses)
    updatePhase('step8_payment');
    checkCancellation();
    const paymentResult = await this.step9ProcessPayment(page, bookingArgs, screenshots);
    const paymentCompleted = paymentResult.paymentCompleted || false;

    console.log('🎉 Service: All steps completed successfully!');
    return {
      success: true,
      sessionDetails,
      screenshots,
      clientEmail: bookingArgs.customerEmail,
      paymentCompleted: paymentCompleted
    };
  }

  // Override step8FillContactDetails to use lookupContactAndWait for existing clients
  async step8FillContactDetails(page, bookingArgs, callContext, screenshots, workflowType) {
    if (workflowType === 'existing') {
      const clientEmail = bookingArgs.customerEmail || callContext.clientDetails?.email || bookingArgs.clientDetails?.email;
      if (!clientEmail) {
        throw new Error('Client email is required for contact lookup');
      }
      await commonSteps.lookupContactAndWait(page, clientEmail, this.screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-contact-details.png', this.screenshotsDir));
      console.log('✅ Step 8 completed: Contact details updated');
    } else {
      await super.step8FillContactDetails(page, bookingArgs, callContext, screenshots, workflowType);
    }
  }

  // Override step9ProcessPayment to handle no payment for TfL courses
  async step9ProcessPayment(page, bookingArgs, screenshots) {
    console.log('💳 Step 9: Selecting payment option (No payment required for TfL courses)...');
    await commonSteps.selectPaymentOption(page, this.screenshotsDir, 'none');
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-payment-option-selected.png', this.screenshotsDir));
    await page.waitForTimeout(2000);
    
    const termsAccepted = bookingArgs.termsAccepted || false;
    const bookingResult = await commonSteps.acceptTermsAndMakeBooking(page, this.screenshotsDir, termsAccepted, false);
    if (!bookingResult.success) {
      if (!bookingResult.termsAccepted) {
        return {
          success: false,
          paymentCompleted: false,
          error: 'Client did not accept terms - booking cancelled'
        };
      } else {
        return {
          success: false,
          paymentCompleted: false,
          error: `Failed to complete booking: ${bookingResult.error}`
        };
      }
    }
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-booking-completed.png', this.screenshotsDir));
    console.log('✅ Step 9 completed: Booking made (no payment required)');
    
    return {
      success: true,
      paymentCompleted: true,
      paymentMethod: 'none'
    };
  }

  // STEP 7: Select booking options for existing client (TfL Beyond CBT-specific)
  async step7SelectBookingOptions(page, bookingArgs, sessionDetails, screenshots, workflowType) {
    const result = await this.selectBookingOptions(page, bookingArgs);
    
    if (result && result.requiresPreferences) {
      return {
        success: false,
        requiresPreferences: true,
        missingPreferences: result.missingPreferences,
        message: result.message,
        validOptions: result.validOptions,
        sessionDetails,
        screenshots,
        clientEmail: bookingArgs.customerEmail
      };
    }
    
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-7-options-selected.png', this.screenshotsDir));
    console.log('✅ Step 7 completed: Booking options selected');
    return { success: true };
  }

  // STEP 5: Select booking options for new client (TfL Beyond CBT-specific)
  async step5SelectBookingOptions(page, bookingArgs, sessionDetails, screenshots) {
    const result = await this.selectBookingOptions(page, bookingArgs);
    
    if (result && result.requiresPreferences) {
      return {
        success: false,
        requiresPreferences: true,
        missingPreferences: result.missingPreferences,
        message: result.message,
        validOptions: result.validOptions,
        sessionDetails,
        screenshots
      };
    }
    
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-5-options-selected.png', this.screenshotsDir));
    console.log('✅ Step 5 completed: Booking options selected');
    return { success: true };
  }

  // Internal method: Select booking options (TfL Beyond CBT-specific - bike type selection)
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
      
      // Find and select the bike type option using div-based checkbox structure
      // Options are in: .jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable
      // Checkbox is: .jqx_inputBookingOptionsSelect_check
      // Option text is in: .optionName span
      const allOptions = searchContext.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await allOptions.count();
      console.log(`🔍 [STEP 7/5] Found ${optionCount} selectable booking options`);
      
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
            console.log(`✅ [STEP 7/5] Found matching option at index ${i}: "${optionText}"`);
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
          console.log(`✅ [STEP 7/5] Clicked checkbox for bike type option at index ${matchingRowIndex}`);
        } else {
          // Fallback: click the row itself
          await matchingOption.click();
          console.log(`✅ [STEP 7/5] Clicked row for bike type option at index ${matchingRowIndex}`);
        }
      } else {
        // Fallback: try selecting first available option
        console.log('⚠️ [STEP 7/5] No matching bike type option found, selecting first available option');
        const firstOption = searchContext.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable').first();
        if (await firstOption.count() > 0) {
          const checkDiv = firstOption.locator('.jqx_inputBookingOptionsSelect_check').first();
          if (await checkDiv.count() > 0) {
            await checkDiv.click();
            console.log('✅ [STEP 7/5] Selected first available option as fallback');
          } else {
            await firstOption.click();
            console.log('✅ [STEP 7/5] Clicked first available option row as fallback');
          }
        }
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

