/**
 * Existing Client Flow
 * Handles filling contact details for existing clients
 * Preserves all Playwright timing and state checks
 */

import * as commonSteps from '../../../../commonBookingSteps/index.js';
import { validateEmail } from './validators.js';

/**
 * Get client email from various sources
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @returns {Promise<string|null>} Client email or null
 */
async function getClientEmail(args, sessionState) {
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
      const { conversations } = await import('../../../../../shared/state.js');
      const conversation = conversations[callSid];
      
      if (conversation?.clientDetails?.email) {
        clientEmail = conversation.clientDetails.email;
        console.log(`✅ [STEP 8] Using email from conversation state (clientVerification/search_client): ${clientEmail}`);
      }
    }
  }
  
  return clientEmail;
}

/**
 * Execute existing client fill contact details flow
 * @param {Object} page - Playwright page object
 * @param {Object} args - Step arguments
 * @param {Object} sessionState - Current session state
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<Object>} Step execution result
 */
export async function executeExistingClientFlow(page, args, sessionState, screenshotsDir) {
  // Existing client: use lookupContactAndWait to fill missing fields
  let clientEmail = await getClientEmail(args, sessionState);
  
  // CRITICAL: Validate email - reject example/test emails
  if (clientEmail) {
    validateEmail(clientEmail);
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
    await commonSteps.lookupContactAndWait(page, clientEmail, screenshotsDir, clientPostcode, false);
  } else {
    // FIX 3: First call lookupContactAndWait to get to the client details page (skip Next click)
    // The Contact choice page should be traversed automatically without any questions
    await commonSteps.lookupContactAndWait(page, clientEmail, screenshotsDir, clientPostcode, true);
    
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
          await commonSteps.lookupContactAndWait(page, clientEmail, screenshotsDir, clientPostcode, false);
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
    await commonSteps.lookupContactAndWait(page, clientEmail, screenshotsDir, clientPostcode, false);
    
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
}
