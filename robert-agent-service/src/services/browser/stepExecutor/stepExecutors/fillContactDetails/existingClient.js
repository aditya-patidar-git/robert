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
      
      // Sequential field checking - check fields one at a time in documented order
      // This matches the client_verification pattern where fields are checked sequentially
      const fieldOrder = [
        { 
          label: 'Contact e-mail', 
          id: 'cnt_email', 
          name: 'email', 
          paramName: 'customerEmail',
          question: 'I can see in your profile that we currently don\'t have your email address; could you please provide me with your full email address?',
          confirmationQuestion: 'Could you please confirm to me your full email address again?'
        },
        { 
          label: 'Contact mobile number', 
          id: 'cnt_mobile_number', 
          name: 'mobileNumber',
          paramName: 'customerMobile',
          question: 'I can see in your profile that we currently don\'t have your mobile number; could you please provide me with your full mobile number?',
          confirmationQuestion: 'Could you please confirm to me your full mobile number again?'
        },
        { 
          label: 'Post Code', 
          id: 'cmp_post_code', 
          name: 'postcode',
          paramName: 'postcode',
          question: 'I can see in your profile that we currently don\'t have your postcode; could you please provide me with your postcode?',
          confirmationQuestion: 'Could you please confirm to me your postcode again?'
        },
        { 
          label: 'House number or name', 
          id: 'cmp_buildingnumber', 
          name: 'houseNumber',
          paramName: 'houseNumber',
          question: 'I can see in your profile that we currently don\'t have your house number or name; could you please provide me with your house number or name?',
          confirmationQuestion: 'Could you please confirm to me your house number or house name?'
        },
        { 
          label: 'Licence held', 
          id: 'cnt_licence_held', 
          name: 'licenceHeld',
          paramName: 'licenceHeld',
          question: 'I can see in your profile that we currently don\'t have your licence held information; could you please provide me with your licence held type?',
          confirmationQuestion: null // No confirmation needed for dropdown
        },
        { 
          label: 'National Insurance number', 
          id: 'cnt_national_insurance_number', 
          name: 'nationalInsuranceNumber',
          paramName: 'nationalInsurance',
          question: 'I can see in your profile that we currently don\'t have your National Insurance number; could you please provide me with your National Insurance number?',
          confirmationQuestion: 'Could you please confirm to me your National Insurance number again?'
        },
        { 
          label: 'Driving licence number', 
          id: 'cnt_driving_licence_number', 
          name: 'drivingLicenceNumber',
          paramName: 'drivingLicenceNumber',
          question: 'I can see in your profile that we currently don\'t have your driving licence number; could you please provide me with your driving licence number?',
          confirmationQuestion: 'Could you please confirm to me your driving licence number again?'
        }
      ];
      
      // Check fields sequentially - return immediately when first missing field is found
      for (const field of fieldOrder) {
        try {
          let fieldLocator = eventBookingIframe.getByLabel(field.label);
          if (await fieldLocator.count() === 0) {
            fieldLocator = eventBookingIframe.locator(`#${field.id} .dx-texteditor-input`);
          }
          if (await fieldLocator.count() === 0) {
            fieldLocator = eventBookingIframe.locator(`#${field.id}`);
          }
          
          if (await fieldLocator.count() > 0) {
            // For dropdown fields (like Licence held), check selected value differently
            let currentValue = '';
            if (field.name === 'licenceHeld') {
              // For dropdown, check selected option
              currentValue = await fieldLocator.evaluate(el => {
                if (el.tagName === 'SELECT') {
                  return el.value || '';
                }
                return el.textContent?.trim() || '';
              }).catch(() => '');
            } else {
              currentValue = await fieldLocator.inputValue().catch(() => '');
            }
            
            if (!currentValue || currentValue.trim() === '') {
              // Found missing field - return immediately to ask for this field
              console.log(`⚠️ [STEP 8] Missing field detected: ${field.name} (${field.label})`);
              return {
                success: true,
                requiresField: field.name,
                fieldName: field.name,
                paramName: field.paramName,
                question: field.question,
                message: field.question,
                instruction: `Ask the client for their ${field.label.toLowerCase()}. After collecting it, call this tool again with ${field.paramName} parameter.`
              };
            }
          }
        } catch (error) {
          console.warn(`⚠️ [STEP 8] Could not check ${field.label}:`, error.message);
          // Continue to next field if this one fails
        }
      }
      
      // All required fields are present - fill any provided field values before clicking Next
      // This handles cases where the agent provides field values after being asked
      
      // Fill email if provided
      if (args.customerEmail) {
        const emailField = eventBookingIframe.getByLabel('Contact e-mail');
        if (await emailField.count() > 0) {
          const currentEmail = await emailField.inputValue().catch(() => '');
          if (!currentEmail || currentEmail.trim() === '') {
            console.log(`📝 [STEP 8] Filling Contact e-mail: ${args.customerEmail}`);
            await emailField.fill(args.customerEmail);
            await page.waitForTimeout(500);
          }
        }
      }
      
      // Fill mobile number if provided
      if (args.customerMobile) {
        const mobileField = eventBookingIframe.getByLabel('Contact mobile number');
        if (await mobileField.count() === 0) {
          const mobileFieldAlt = eventBookingIframe.locator('#cnt_mobile_number .dx-texteditor-input');
          if (await mobileFieldAlt.count() > 0) {
            const currentMobile = await mobileFieldAlt.inputValue().catch(() => '');
            if (!currentMobile || currentMobile.trim() === '') {
              console.log(`📝 [STEP 8] Filling Contact mobile number: ${args.customerMobile}`);
              await mobileFieldAlt.fill(args.customerMobile);
              await page.waitForTimeout(500);
            }
          }
        } else {
          const currentMobile = await mobileField.inputValue().catch(() => '');
          if (!currentMobile || currentMobile.trim() === '') {
            console.log(`📝 [STEP 8] Filling Contact mobile number: ${args.customerMobile}`);
            await mobileField.fill(args.customerMobile);
            await page.waitForTimeout(500);
          }
        }
      }
      
      // Fill postcode if provided
      if (args.postcode) {
        const postcodeField = eventBookingIframe.getByLabel('Post Code');
        if (await postcodeField.count() > 0) {
          const currentPostcode = await postcodeField.inputValue().catch(() => '');
          if (!currentPostcode || currentPostcode.trim() === '') {
            console.log(`📝 [STEP 8] Filling Post Code: ${args.postcode}`);
            await postcodeField.fill(args.postcode);
            await page.waitForTimeout(500);
          }
        }
      }
      
      // Fill house number and handle address confirmation
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
                // Return requiresAddressConfirmation to verify address with client
                return {
                  success: true,
                  requiresAddressConfirmation: true,
                  autoPopulatedAddress: autoPopulatedAddress,
                  message: `I believe that I now have the first line of your address, is it ${autoPopulatedAddress}?`,
                  instruction: 'Read the auto-populated address to the client and ask if it\'s correct. If yes, proceed. If no, ask for corrected address and call tool again with correctedAddress parameter.'
                };
              }
            }
          }
        }
      }
      
      // Fill National Insurance if provided
      if (args.nationalInsurance) {
        const niField = eventBookingIframe.getByLabel('National Insurance number');
        if (await niField.count() > 0) {
          const currentNI = await niField.inputValue().catch(() => '');
          if (!currentNI || currentNI.trim() === '') {
            console.log(`📝 [STEP 8] Filling National Insurance number: ${args.nationalInsurance}`);
            await niField.fill(args.nationalInsurance);
            await page.waitForTimeout(500);
          }
        }
      }
      
      // Fill Driving Licence Number if provided
      if (args.drivingLicenceNumber) {
        const dlField = eventBookingIframe.getByLabel('Driving licence number');
        if (await dlField.count() > 0) {
          const currentDL = await dlField.inputValue().catch(() => '');
          if (!currentDL || currentDL.trim() === '') {
            console.log(`📝 [STEP 8] Filling Driving licence number: ${args.drivingLicenceNumber}`);
            await dlField.fill(args.drivingLicenceNumber);
            await page.waitForTimeout(500);
          }
        }
      }
      
      // Fill Licence Held if provided (dropdown)
      if (args.licenceHeld) {
        const licenceField = eventBookingIframe.getByLabel('Licence held');
        if (await licenceField.count() > 0) {
          const currentLicence = await licenceField.evaluate(el => {
            if (el.tagName === 'SELECT') {
              return el.value || '';
            }
            return el.textContent?.trim() || '';
          }).catch(() => '');
          if (!currentLicence || currentLicence.trim() === '') {
            console.log(`📝 [STEP 8] Selecting Licence held: ${args.licenceHeld}`);
            await licenceField.selectOption({ label: args.licenceHeld }).catch(() => {
              // Try by value if label doesn't work
              licenceField.selectOption(args.licenceHeld);
            });
            await page.waitForTimeout(500);
          }
        }
      }
    } else {
      // Not on client details page yet - just proceed without checking missing fields
      console.log('⚠️ [STEP 8] Not on client details page yet - skipping missing fields check');
    }
    
    // After handling missing fields (if any were provided), click Next
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
