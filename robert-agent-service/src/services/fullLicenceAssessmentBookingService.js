import * as commonSteps from './commonBookingSteps/index.js';
import { BaseBookingService } from './commonBookingSteps/BaseBookingService.js';

class FullLicenceAssessmentBookingService extends BaseBookingService {
  constructor() {
    super(
      'Full Licence Assessment', // courseType
      'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=024D486FF2ED0D87', // availabilityUrl
      './screenshots/full-licence-assessment-booking' // screenshotsDir
    );
  }

  // Override executeExistingClientWorkflow (Full Licence Assessment uses regular diary, requires payment)
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

    // STEP 6: Navigate to Diaries and select session (regular diary, not TfL)
    updatePhase('step6_select_session');
    checkCancellation();
    await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);

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

    // STEP 9: Payment (Full Licence Assessment requires payment)
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

  // Override executeNewClientWorkflow (Full Licence Assessment uses regular diary, requires payment)
  async executeNewClientWorkflow(page, bookingArgs, callContext, sessionDetails, screenshots, checkCancellation, updatePhase) {
    // STEP 4: Navigate to Diaries and select session
    updatePhase('step4_select_session');
    checkCancellation();
    await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);

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

    // STEP 7: Fill ALL contact details from scratch
    updatePhase('step7_fill_contact_details');
    checkCancellation();
    await this.step7FillContactDetails(page, bookingArgs, callContext, screenshots, 'new');

    // STEP 8: Payment (Full Licence Assessment requires payment)
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
      console.log('✅ Step 8 completed: Contact details updated');
    } else {
      await super.step8FillContactDetails(page, bookingArgs, callContext, screenshots, workflowType);
    }
  }

  // STEP 7: Select booking options for existing client (Full Licence Assessment-specific)
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
    
    console.log('✅ Step 7 completed: Booking options selected');
    return { success: true };
  }

  // STEP 5: Select booking options for new client (Full Licence Assessment-specific)
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
    
    console.log('✅ Step 5 completed: Booking options selected');
    return { success: true };
  }

  // Internal method: Select booking options (Full Licence Assessment-specific - licence category and transmission)
  async selectBookingOptions(page, bookingArgs) {
    try {
      console.log('⚙️ [STEP 7/5] Selecting Full Licence Assessment booking options...');
      
      // Validate provided licence category and transmission
      const validLicenceCategories = ['A1', 'A2', 'A', 'DAS'];
      const validTransmissions = ['automatic', 'manual'];
      const invalidPreferences = [];
      
      if (bookingArgs.licenceCategory) {
        const normalizedCategory = bookingArgs.licenceCategory.trim().toUpperCase();
        const isValid = validLicenceCategories.some(valid => valid.toUpperCase() === normalizedCategory);
        if (!isValid) {
          invalidPreferences.push({
            preference: 'licenceCategory',
            providedValue: bookingArgs.licenceCategory,
            validOptions: validLicenceCategories
          });
        }
      }
      
      if (bookingArgs.transmission || bookingArgs.bikeType) {
        const transmission = (bookingArgs.transmission || bookingArgs.bikeType).trim().toLowerCase();
        const isValid = validTransmissions.some(valid => valid.toLowerCase() === transmission);
        if (!isValid) {
          invalidPreferences.push({
            preference: 'transmission',
            providedValue: bookingArgs.transmission || bookingArgs.bikeType,
            validOptions: validTransmissions
          });
        }
      }
      
      if (invalidPreferences.length > 0) {
        const invalidPref = invalidPreferences[0];
        let message = `I'm sorry, but "${invalidPref.providedValue}" is not a valid ${invalidPref.preference === 'licenceCategory' ? 'licence category' : 'transmission type'} for the Full Licence Assessment. `;
        if (invalidPref.preference === 'licenceCategory') {
          message += `Please choose one of: "${validLicenceCategories.join('", "')}".`;
        } else {
          message += `Please choose one of: "${validTransmissions.join('", "')}".`;
        }
        
        return {
          requiresPreferences: true,
          invalidPreferences: invalidPreferences.map(p => p.preference),
          message: message,
          validOptions: {
            licenceCategory: validLicenceCategories,
            transmission: validTransmissions
          }
        };
      }
      
      // Check for missing required preferences
      const missingPreferences = [];
      if (!bookingArgs.licenceCategory) {
        missingPreferences.push('licenceCategory');
      }
      if (!bookingArgs.transmission && !bookingArgs.bikeType) {
        missingPreferences.push('transmission');
      }
      
      if (missingPreferences.length > 0) {
        let message = 'I need some additional information to proceed with your Full Licence Assessment booking. ';
        
        if (missingPreferences.includes('licenceCategory')) {
          message += 'What licence category are you assessing for: A1, A2, or A/DAS? ';
        }
        if (missingPreferences.includes('transmission')) {
          message += 'Do you prefer automatic or manual transmission?';
        }
        
        return {
          requiresPreferences: true,
          missingPreferences: missingPreferences,
          message: message.trim(),
          validOptions: {
            licenceCategory: validLicenceCategories,
            transmission: validTransmissions
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
      
      
      // Find all booking option groups
      console.log('📋 [STEP 7/5] Finding all booking option groups...');
      const allGroups = searchContext.locator('.jqxInputBookingOptionsSelectGroupOuter');
      const groupCount = await allGroups.count();
      console.log(`📊 [STEP 7/5] Found ${groupCount} booking option group(s)`);
      
      if (groupCount === 0) {
        throw new Error('No booking option groups found on price page');
      }
      
      const licenceCategory = bookingArgs.licenceCategory.trim().toUpperCase();
      const transmission = (bookingArgs.transmission || bookingArgs.bikeType || '').trim().toLowerCase();
      
      // Build expected option text pattern
      let expectedOptionPattern = null;
      if (licenceCategory === 'A1') {
        expectedOptionPattern = transmission === 'automatic' ? /A1.*125cc.*automatic/i : /A1.*125cc.*manual/i;
      } else if (licenceCategory === 'A2') {
        expectedOptionPattern = transmission === 'automatic' ? /A2.*automatic/i : /A2.*manual/i;
      } else if (licenceCategory === 'A' || licenceCategory === 'DAS') {
        expectedOptionPattern = transmission === 'automatic' ? /A\/DAS.*automatic/i : /A\/DAS.*manual/i;
      }
      
      console.log(`✅ [STEP 7/5] Selecting option for ${licenceCategory} ${transmission}`);
      
      let optionSelected = false;
      
      // Process each group to find and select the matching option
      for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
        const group = allGroups.nth(groupIndex);
        
        // Get group heading to identify what question this group is asking
        const groupHeading = group.locator('h1.jqx_formBoilerPlateText.jqx_formHeading span').first();
        const headingText = await groupHeading.textContent().catch(() => '');
        const normalizedHeading = headingText ? headingText.trim().toLowerCase() : '';
        
        console.log(`📋 [STEP 7/5] Processing group ${groupIndex + 1}/${groupCount}: "${normalizedHeading || '(no heading)'}"`);
        
        // Skip CBT course type group (not relevant for Full Licence Assessment)
        if (normalizedHeading.includes('cbt course type')) {
          console.log(`⏭️ [STEP 7/5] Skipping "${normalizedHeading}" group (not relevant for Full Licence Assessment)`);
          continue;
        }
        
        const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
        const optionCount = await groupOptions.count();
        console.log(`   Found ${optionCount} options in this group`);
        
        if (optionCount === 0) {
          console.log(`⚠️ [STEP 7/5] No options found in group "${normalizedHeading}", skipping...`);
          continue;
        }
        
        // This should be the Full Licence courses group
        if (expectedOptionPattern) {
          for (let i = 0; i < optionCount; i++) {
            const optionRow = groupOptions.nth(i);
            const optionNameSpan = optionRow.locator('.optionName span');
            
            if (await optionNameSpan.count() > 0) {
              const optionText = await optionNameSpan.textContent();
              
              if (optionText && expectedOptionPattern.test(optionText)) {
                console.log(`✅ [STEP 7/5] Found matching option: "${optionText}"`);
                const checkDiv = optionRow.locator('.jqx_inputBookingOptionsSelect_check').first();
                if (await checkDiv.count() > 0) {
                  await checkDiv.click();
                  console.log(`✅ [STEP 7/5] Selected option: "${optionText}"`);
                  optionSelected = true;
                  await page.waitForTimeout(500);
                  break;
                } else {
                  await optionRow.click();
                  console.log(`✅ [STEP 7/5] Clicked option row: "${optionText}"`);
                  optionSelected = true;
                  await page.waitForTimeout(500);
                  break;
                }
              }
            }
          }
        }
        
        if (optionSelected) {
          break; // Found and selected, no need to check other groups
        }
      }
      
      // Fallback: try selecting first available option if pattern matching failed
      if (!optionSelected) {
        console.log(`⚠️ [STEP 7/5] WARNING: No matching option found, trying fallback...`);
        for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
          const group = allGroups.nth(groupIndex);
          const groupHeading = group.locator('h1.jqx_formBoilerPlateText.jqx_formHeading span').first();
          const headingText = await groupHeading.textContent().catch(() => '');
          const normalizedHeading = headingText ? headingText.trim().toLowerCase() : '';
          
          if (normalizedHeading.includes('cbt course type')) {
            continue; // Skip CBT type group
          }
          
          const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
          if (await groupOptions.count() > 0) {
            const firstOption = groupOptions.first();
            const checkDiv = firstOption.locator('.jqx_inputBookingOptionsSelect_check').first();
            if (await checkDiv.count() > 0) {
              await checkDiv.click();
            } else {
              await firstOption.click();
            }
            optionSelected = true;
            console.log(`✅ [STEP 7/5] Selected first available option as fallback`);
            break;
          }
        }
      }
      
      await page.waitForTimeout(1000);
      
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
      
      console.log('✅ [STEP 7/5] Full Licence Assessment booking options selected and Next button clicked');
      
      // Return success - booking options were selected
      return {
        success: true,
        message: 'Booking options selected successfully'
      };
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      throw new Error(`Failed to select Full Licence Assessment booking options: ${error.message}`);
    }
  }
}

export default new FullLicenceAssessmentBookingService();

