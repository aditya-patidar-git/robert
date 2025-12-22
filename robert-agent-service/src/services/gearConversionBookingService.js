import * as commonSteps from './commonBookingSteps/index.js';
import { BaseBookingService } from './commonBookingSteps/BaseBookingService.js';

class GearConversionBookingService extends BaseBookingService {
  constructor() {
    super(
      'Gear Conversion', // courseType
      'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C07F8089718288E3', // availabilityUrl
      './screenshots/gear-conversion-booking' // screenshotsDir
    );
  }

  // Override executeExistingClientWorkflow to add email fallback logic (same as CBT)
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
    
    // Determine search type and value - mobile number takes priority
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
    
    if (searchResult.retryPrompt) {
      return {
        success: false,
        requiresCustomerInfo: true,
        retryPrompt: searchResult.retryPrompt,
        message: searchResult.retryPrompt,
        workflowType: 'existing'
      };
    }
    
    // Email fallback: If mobile search failed and we haven't tried email yet, try email
    if (!searchResult.found && searchType === 'mobile' && bookingArgs.customerEmail) {
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
        console.log('✅ Step 4-5 completed: Client found via email - requires verbal verification');
        
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
    } else if (!searchResult.found) {
      throw new Error(searchResult.error || 'Could not find client in CRM');
    } else {
      if (searchResult.clientDetails) {
        callContext.clientDetails = searchResult.clientDetails;
        bookingArgs.clientDetails = searchResult.clientDetails;
      }
      console.log('✅ Step 4-5 completed: Client found - requires verbal verification');
    }
    
    // IMPORTANT: Do not proceed to booking until verbal verification is complete
    if (searchResult.requiresVerification || (searchResult.found && !callContext.clientVerified)) {
      return {
        success: false,
        requiresVerification: true,
        verificationPrompt: searchResult.verificationPrompt,
        clientDetails: searchResult.clientDetails || callContext.clientDetails,
        message: searchResult.verificationPrompt || 'Client found but requires verbal verification before proceeding with booking'
      };
    }

    // Continue with rest of workflow (skip client search since we already did it)
    let paymentCompleted = false;

    // STEP 6: Navigate to Diaries and select session
    updatePhase('step6_select_session');
    checkCancellation();
    await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);
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

  // STEP 7: Select booking options for existing client (Gear Conversion-specific)
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

  // STEP 5: Select booking options for new client (Gear Conversion-specific)
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

  // Internal method: Select booking options (Gear Conversion-specific - duration selection)
  async selectBookingOptions(page, bookingArgs) {
    try {
      console.log('⚙️ [STEP 8] Selecting Gear Conversion booking options...');
      
      // Step 1: Validate provided preferences (if any)
      const validDurations = ['2', '3', '4'];
      const invalidPreferences = [];
      
      if (bookingArgs.duration) {
        // Normalize duration - convert to string and trim
        const normalizedDuration = String(bookingArgs.duration).trim();
        const isValid = validDurations.includes(normalizedDuration);
        if (!isValid) {
          invalidPreferences.push({
            preference: 'duration',
            providedValue: bookingArgs.duration,
            validOptions: validDurations
          });
        }
      }
      
      if (invalidPreferences.length > 0) {
        const invalidPref = invalidPreferences[0];
        return {
          requiresPreferences: true,
          invalidPreferences: invalidPreferences.map(p => p.preference),
          message: `I'm sorry, but "${invalidPref.providedValue}" is not a valid duration for the Gear Conversion course. Please choose one of: "${validDurations.join('", "')}" hours.`,
          validOptions: validDurations
        };
      }
      
      // Step 2: Check for missing required preferences
      const missingPreferences = [];
      if (!bookingArgs.duration) {
        missingPreferences.push('duration');
      }
      
      if (missingPreferences.length > 0) {
        return {
          requiresPreferences: true,
          missingPreferences: missingPreferences,
          message: `I need to know your preferred duration for the Gear Conversion course. Would you like a 2-hour, 3-hour, or 4-hour session?`,
          validOptions: validDurations
        };
      }
      
      await page.waitForTimeout(5000);
      
      const pages = page.context().pages();
      let targetPage = page;
      if (pages.length > 1) {
        for (let i = 0; i < pages.length; i++) {
          const pageTitle = await pages[i].title();
          const pageUrl = pages[i].url();
          if (pageTitle.includes('booking') || pageTitle.includes('Booking') || 
              pageUrl.includes('booking') || pageUrl.includes('Booking')) {
            targetPage = pages[i];
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
      
      const priceHeader = searchContext.locator('text=1. Price, *:has-text("1. Price")').first();
      await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      
      await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', this.screenshotsDir);
      
      // Select duration from Booking options (2 hours, 3 hours, or 4 hours)
      console.log('⏱️ [STEP 8] Selecting duration from Booking options...');
      await searchContext.locator('text=/Booking options/i').scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
      
      const duration = bookingArgs.duration; // Already validated above
      
      const durationMap = {
        '2': /2 hours/i,
        '3': /3 hours/i,
        '4': /4 hours/i
      };
      
      const durationPattern = durationMap[duration] || durationMap['2'];
      console.log(`✅ [STEP 8] Selecting duration: ${duration} hours`);
      
      // Find and select the duration option using div-based checkbox structure
      // Options are in: .jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable
      // Checkbox is: .jqx_inputBookingOptionsSelect_check
      // Option text is in: .optionName span
      const allOptions = searchContext.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await allOptions.count();
      console.log(`🔍 [STEP 8] Found ${optionCount} selectable booking options`);
      
      let matchingOption = null;
      let matchingRowIndex = -1;
      
      // Iterate through all options to find matching duration
      for (let i = 0; i < optionCount; i++) {
        const optionRow = allOptions.nth(i);
        const optionNameSpan = optionRow.locator('.optionName span');
        
        if (await optionNameSpan.count() > 0) {
          const optionText = await optionNameSpan.textContent();
          const normalizedText = optionText ? optionText.trim().toLowerCase() : '';
          
          // Check if option text matches the duration pattern
          if (normalizedText && durationPattern.test(normalizedText)) {
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
          console.log(`✅ [STEP 8] Clicked checkbox for duration option at index ${matchingRowIndex}`);
        } else {
          // Fallback: click the row itself
          await matchingOption.click();
          console.log(`✅ [STEP 8] Clicked row for duration option at index ${matchingRowIndex}`);
        }
      } else {
        // Fallback: try selecting first available option
        console.log('⚠️ [STEP 8] No matching duration option found, selecting first available option');
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
        }
      }
      
      await page.waitForTimeout(1000);
      
      // Click NEXT button
      console.log('➡️ [STEP 8] Clicking NEXT...');
      let nextButton = searchContext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
      
      if (await nextButton.count() === 0) {
        nextButton = searchContext.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
      }
      
      if (await nextButton.count() === 0) {
        throw new Error('Next button not found on booking options page');
      }
      
      await nextButton.waitFor({ state: 'visible', timeout: 5000 });
      await nextButton.click();
      
      await page.waitForTimeout(3000);
      
      if (bookingIframe) {
        await page.waitForTimeout(2000);
        const contactLookupIndicators = bookingIframe.locator('text=lookup, text=contact, text=add new contact').first();
        await contactLookupIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      }
      
      console.log('✅ [STEP 8] Gear Conversion booking options selected and Next button clicked');
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      await commonSteps.takeScreenshot(page, 'booking-options-error.png', this.screenshotsDir);
      throw new Error(`Failed to select Gear Conversion booking options: ${error.message}`);
    }
  }
}

export default new GearConversionBookingService();

