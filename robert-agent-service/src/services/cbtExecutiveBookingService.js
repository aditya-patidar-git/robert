import * as commonSteps from './commonBookingSteps/index.js';
import { BaseBookingService } from './commonBookingSteps/BaseBookingService.js';

class CBTExecutiveBookingService extends BaseBookingService {
  constructor() {
    super(
      'CBT Executive', // courseType
      'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=06EF66470DC0CDC4', // availabilityUrl
      './screenshots/cbt-executive-booking' // screenshotsDir
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

  // STEP 7: Select booking options for existing client (CBT Executive-specific)
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

  // STEP 5: Select booking options for new client (CBT Executive-specific)
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

  // Internal method: Select booking options (CBT Executive-specific)
  async selectBookingOptions(page, bookingArgs) {
    try {
      console.log('⚙️ [STEP 8] Selecting CBT Executive booking options...');
      
      // Step 1: Validate provided preferences (if any)
      const validCbtTypes = ['standard', 'renewal'];
      const validBikeTypes = ['125cc automatic', '50cc automatic', '125cc manual', '500cc restricted', '600cc'];
      const invalidPreferences = [];
      
      if (bookingArgs.cbtType) {
        const normalizedCbtType = bookingArgs.cbtType.trim().toLowerCase();
        const isValid = validCbtTypes.some(valid => valid.toLowerCase() === normalizedCbtType);
        if (!isValid) {
          invalidPreferences.push({
            preference: 'cbtType',
            providedValue: bookingArgs.cbtType,
            validOptions: validCbtTypes
          });
        }
      }
      
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
        let message = `I'm sorry, but "${invalidPref.providedValue}" is not a valid ${invalidPref.preference === 'cbtType' ? 'CBT type' : 'bike type'} for the CBT Executive course. `;
        if (invalidPref.preference === 'cbtType') {
          message += `Please choose one of: "${validCbtTypes.join('", "')}".`;
        } else {
          message += `Please choose one of: "${validBikeTypes.join('", "')}".`;
        }
        
        return {
          requiresPreferences: true,
          invalidPreferences: invalidPreferences.map(p => p.preference),
          message: message,
          validOptions: {
            cbtType: validCbtTypes,
            bikeType: validBikeTypes
          }
        };
      }
      
      // Step 2: Check for missing required preferences
      const missingPreferences = [];
      if (!bookingArgs.cbtType) {
        missingPreferences.push('cbtType');
      }
      if (!bookingArgs.bikeType) {
        missingPreferences.push('bikeType');
      }
      
      if (missingPreferences.length > 0) {
        let message = 'I need some additional information to proceed with your CBT Executive booking. ';
        
        if (missingPreferences.includes('cbtType')) {
          message += 'Is this a CBT Standard or CBT Renewal? ';
        }
        if (missingPreferences.includes('bikeType')) {
          const { generateBikeTypeQuestion } = await import('./browser/preferenceValidator.js');
          message += generateBikeTypeQuestion('CBT Executive', validBikeTypes) + ' ';
        }
        
        return {
          requiresPreferences: true,
          missingPreferences: missingPreferences,
          message: message.trim(),
          validOptions: {
            cbtType: validCbtTypes,
            bikeType: validBikeTypes
          }
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
      
      // Find all booking option groups
      console.log('📋 [STEP 8] Finding all booking option groups...');
      const allGroups = searchContext.locator('.jqxInputBookingOptionsSelectGroupOuter');
      const groupCount = await allGroups.count();
      console.log(`📊 [STEP 8] Found ${groupCount} booking option group(s)`);
      
      if (groupCount === 0) {
        throw new Error('No booking option groups found on price page');
      }
      
      const cbtType = bookingArgs.cbtType; // Already validated above
      const bikeType = bookingArgs.bikeType; // Already validated above
      
      let cbtTypeSelected = false;
      let bikeTypeSelected = false;
      
      // Process each group to select required options
      for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
        const group = allGroups.nth(groupIndex);
        
        // Get group heading to identify what question this group is asking
        const groupHeading = group.locator('h1.jqx_formBoilerPlateText.jqx_formHeading span').first();
        const headingText = await groupHeading.textContent().catch(() => '');
        const normalizedHeading = headingText ? headingText.trim().toLowerCase() : '';
        
        console.log(`📋 [STEP 8] Processing group ${groupIndex + 1}/${groupCount}: "${normalizedHeading || '(no heading)'}"`);
        
        const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
        const optionCount = await groupOptions.count();
        console.log(`   Found ${optionCount} options in this group`);
        
        if (optionCount === 0) {
          console.log(`⚠️ [STEP 8] No options found in group "${normalizedHeading}", skipping...`);
          continue;
        }
        
        // STEP 1: Handle "CBT course type" group
        if (normalizedHeading.includes('cbt course type')) {
          console.log(`✅ [STEP 8] Found "CBT course type" group, selecting ${cbtType}...`);
          
          const cbtTypePattern = cbtType.toLowerCase() === 'renewal' 
            ? /cbt\s+renewal/i 
            : /cbt\s+standard/i;
          
          for (let i = 0; i < optionCount; i++) {
            const optionRow = groupOptions.nth(i);
            const optionNameSpan = optionRow.locator('.optionName span');
            
            if (await optionNameSpan.count() > 0) {
              const optionText = await optionNameSpan.textContent();
              const normalizedText = optionText ? optionText.trim().toLowerCase() : '';
              
              if (normalizedText && cbtTypePattern.test(normalizedText)) {
                console.log(`✅ [STEP 8] Found matching CBT type option: "${optionText}"`);
                const checkDiv = optionRow.locator('.jqx_inputBookingOptionsSelect_check').first();
                if (await checkDiv.count() > 0) {
                  await checkDiv.click();
                  console.log(`✅ [STEP 8] Selected CBT type: "${optionText}"`);
                  cbtTypeSelected = true;
                  await page.waitForTimeout(500);
                  break;
                } else {
                  await optionRow.click();
                  console.log(`✅ [STEP 8] Clicked CBT type row: "${optionText}"`);
                  cbtTypeSelected = true;
                  await page.waitForTimeout(500);
                  break;
                }
              }
            }
          }
          
          if (!cbtTypeSelected) {
            console.log(`⚠️ [STEP 8] Could not find ${cbtType} option, trying radio button fallback...`);
            // Fallback to radio button approach
            if (cbtType.toLowerCase() === 'renewal') {
              const renewalRadio = searchContext.locator('[role="radio"]:has-text("CBT Renewal"), input[type="radio"][value*="Renewal"]').first();
              if (await renewalRadio.count() > 0) {
                await renewalRadio.check();
                cbtTypeSelected = true;
              }
            } else {
              const standardRadio = searchContext.locator('[role="radio"]:has-text("CBT Standard"), input[type="radio"][value*="Standard"]').first();
              if (await standardRadio.count() > 0) {
                await standardRadio.check();
                cbtTypeSelected = true;
              }
            }
          }
          continue; // Move to next group
        }
        
        // STEP 2: Skip "Full Licence courses" group (not relevant for CBT Executive)
        if (normalizedHeading.includes('full licence')) {
          console.log(`⏭️ [STEP 8] Skipping "Full Licence courses" group (not relevant for CBT Executive)`);
          continue;
        }
        
        // STEP 3: Handle bike type group (group_id="0" or no specific heading)
        // This is the main group for bike type selection
        if (!normalizedHeading || normalizedHeading === '' || normalizedHeading.includes('bike') || normalizedHeading.includes('motorcycle')) {
          console.log('🚲 [STEP 8] This appears to be the bike type group, selecting bike type...');
          
          const bikeTypeMap = {
            '125cc automatic': /125\s*cc\s+automatic.*scooter/i,
            '50cc automatic': /50\s*cc\s+automatic/i,
            '125cc manual': /125\s*cc\s+manual.*geared/i,
            '500cc restricted': /500\s*cc\s+restricted/i,
            '600cc': /600\s*cc/i
          };
          
          const bikePattern = bikeTypeMap[bikeType] || bikeTypeMap['125cc automatic'];
          console.log(`✅ [STEP 8] Selecting bike type: ${bikeType}`);
          
          for (let i = 0; i < optionCount; i++) {
            const optionRow = groupOptions.nth(i);
            const optionNameSpan = optionRow.locator('.optionName span');
            
            if (await optionNameSpan.count() > 0) {
              const optionText = await optionNameSpan.textContent();
              const normalizedText = optionText ? optionText.trim().toLowerCase() : '';
              
              if (normalizedText && bikePattern.test(normalizedText)) {
                console.log(`✅ [STEP 8] Found matching bike type option: "${optionText}"`);
                const checkDiv = optionRow.locator('.jqx_inputBookingOptionsSelect_check').first();
                if (await checkDiv.count() > 0) {
                  await checkDiv.click();
                  console.log(`✅ [STEP 8] Selected bike type: "${optionText}"`);
                  bikeTypeSelected = true;
                  await page.waitForTimeout(500);
                  break;
                } else {
                  await optionRow.click();
                  console.log(`✅ [STEP 8] Clicked bike type row: "${optionText}"`);
                  bikeTypeSelected = true;
                  await page.waitForTimeout(500);
                  break;
                }
              }
            }
          }
          
          if (!bikeTypeSelected) {
            console.log(`⚠️ [STEP 8] No matching bike type found in this group`);
          }
          continue; // Move to next group
        }
      }
      
      // Verify both options were selected
      if (!cbtTypeSelected) {
        console.log(`⚠️ [STEP 8] WARNING: CBT type was not selected`);
      }
      if (!bikeTypeSelected) {
        console.log(`⚠️ [STEP 8] WARNING: Bike type was not selected`);
        // Fallback: try selecting first available option from any group (excluding CBT type group)
        for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
          const group = allGroups.nth(groupIndex);
          const groupHeading = group.locator('h1.jqx_formBoilerPlateText.jqx_formHeading span').first();
          const headingText = await groupHeading.textContent().catch(() => '');
          const normalizedHeading = headingText ? headingText.trim().toLowerCase() : '';
          
          if (normalizedHeading.includes('cbt course type') || normalizedHeading.includes('full licence')) {
            continue; // Skip CBT type and Full Licence groups
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
            bikeTypeSelected = true;
            console.log(`✅ [STEP 8] Selected first available option as fallback for bike type`);
            break;
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
      
      console.log('✅ [STEP 8] CBT Executive booking options selected and Next button clicked');
      
      // Return success - booking options were selected
      return {
        success: true,
        message: 'Booking options selected successfully'
      };
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      await commonSteps.takeScreenshot(page, 'booking-options-error.png', this.screenshotsDir);
      throw new Error(`Failed to select CBT Executive booking options: ${error.message}`);
    }
  }
}

export default new CBTExecutiveBookingService();

