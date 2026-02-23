import { takeScreenshot } from './utils.js';

/**
 * Step 7 (New client workflow): Fill all contact details from scratch
 * @param {Page} page - Playwright page object
 * @param {Object} contactDetails - Contact details object
 * @param {string} contactDetails.title - Title (Mr, Mrs, Miss, etc.)
 * @param {string} contactDetails.firstNames - First and middle names
 * @param {string} contactDetails.surname - Surname
 * @param {string} contactDetails.mobileNumber - Contact mobile number (11 digits, UK format)
 * @param {string} contactDetails.email - Contact e-mail address
 * @param {string} contactDetails.dateOfBirth - Date of birth
 * @param {string} contactDetails.postcode - Post code
 * @param {string} contactDetails.houseNumberOrName - House number or name
 * @param {string} contactDetails.licenceHeld - Licence held type
 * @param {string} contactDetails.nationalInsuranceNumber - National Insurance number
 * @param {string} contactDetails.drivingLicenceNumber - Driving licence number
 * @param {string} contactDetails.licenceFormat - 'GB' or 'NI' for driving licence format
 * @param {string} contactDetails.hearAboutUs - How did they hear about us
 * @param {string} contactDetails.ridingExperience - Riding experience level
 * @param {boolean} contactDetails.marketingConsent - Keep you updated (YES/NO)
 * @param {boolean} contactDetails.dataSharing - Send details to others (YES/NO)
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {boolean} addressConfirmed - Whether the client has confirmed the auto-populated address (default: false)
 * @param {string} correctedAddress - Corrected address if client said the auto-populated address was incorrect
 * @returns {Promise<{success: boolean, requiresAddressConfirmation?: boolean, autoPopulatedAddress?: string, townCity?: string, message?: string}>}
 */

/**
 * Helper function to fill a text field with label and ID fallback
 */
async function fillTextField(iframe, labelText, fieldId, value) {
  let field = iframe.getByLabel(labelText);
  let selectorUsed = `getByLabel("${labelText}")`;
  
  if (await field.count() === 0) {
    // Fallback to ID-based selector
    field = iframe.locator(`#${fieldId} .dx-texteditor-input`);
    selectorUsed = `#${fieldId} .dx-texteditor-input`;
  }
  
  await field.fill(value);
  console.log(`✅ [STEP 7] Filled ${labelText} using ${selectorUsed}`);
  return field;
}

/**
 * Exact option labels for the "Licence held" dropdown (order matches UI).
 * Used to map client phrases to exact dropdown text and to avoid matching
 * other dropdowns (e.g. Riding experience "full control" option).
 */
const LICENCE_HELD_EXACT_OPTIONS = [
  'Prov licence with valid cat A',
  'Prov licence cat P only',
  'European license with D9 counterpart',
  'Foreign licence',
  'No licence',
  'Full UK car licence',
  'Full UK automatic bike licence',
  'Full UK manual bike licence',
  'Full EU Motorcycle Licence'
];

/**
 * Map client phrase to exact "Licence held" dropdown label.
 * @param {string} optionValue - Raw value (e.g. "full", "provisional")
 * @returns {string} Exact label to select, or optionValue if it already matches an option
 */
function resolveLicenceHeldLabel(optionValue) {
  if (!optionValue || typeof optionValue !== 'string') return optionValue;
  const normalized = optionValue.trim().toLowerCase().replace(/\s+/g, ' ');
  const map = {
    'provisional': 'Prov licence with valid cat A',
    'prov': 'Prov licence with valid cat A',
    'prov licence cat p': 'Prov licence cat P only',
    'cat p only': 'Prov licence cat P only',
    'full': 'Full UK car licence',
    'full licence': 'Full UK car licence',
    'full uk car': 'Full UK car licence',
    'full car': 'Full UK car licence',
    'full uk manual bike': 'Full UK manual bike licence',
    'full manual bike': 'Full UK manual bike licence',
    'full uk automatic bike': 'Full UK automatic bike licence',
    'full eu motorcycle': 'Full EU Motorcycle Licence',
    'european': 'European license with D9 counterpart',
    'european d9': 'European license with D9 counterpart',
    'd9': 'European license with D9 counterpart',
    'foreign': 'Foreign licence',
    'no licence': 'No licence'
  };
  if (map[normalized]) return map[normalized];
  // Exact match (case-insensitive) against known options
  const match = LICENCE_HELD_EXACT_OPTIONS.find(opt => opt.trim().toLowerCase() === normalized);
  if (match) return match;
  return optionValue;
}

/**
 * Select option from a DevExtreme dropdown by scoping to the visible overlay.
 * Avoids matching options from other dropdowns (e.g. Riding experience).
 * @returns {Promise<boolean>} true if selection was done via overlay
 */
async function selectOptionFromOverlay(iframe, page, fieldId, exactLabel) {
  const dropdownInput = iframe.locator(`#${fieldId} .dx-texteditor-input`);
  await dropdownInput.click();
  await page.waitForTimeout(500);
  const overlay = iframe.locator('.dx-dropdowneditor-overlay .dx-list-items');
  await overlay.waitFor({ state: 'visible', timeout: 5000 });
  const optionsContainer = iframe.locator('.dx-dropdowneditor-overlay .dx-list-items');
  const items = optionsContainer.locator('.dx-item');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const content = item.locator('.dx-item-content');
    const text = (await content.textContent()).trim();
    if (text === exactLabel) {
      await item.waitFor({ state: 'visible', timeout: 5000 });
      await item.click();
      return true;
    }
  }
  return false;
}

/**
 * Helper function to select dropdown option with label and ID fallback.
 * For "Licence held" we scope to the open overlay and use exact label mapping
 * so we never match the Riding experience "full control" option.
 */
async function selectDropdownOption(iframe, page, labelText, fieldId, optionValue) {
  const isLicenceHeld = fieldId === 'xid_29019' || labelText === 'Licence held';

  if (isLicenceHeld) {
    const exactLabel = resolveLicenceHeldLabel(optionValue);
    try {
      const done = await selectOptionFromOverlay(iframe, page, fieldId, exactLabel);
      if (done) {
        console.log(`✅ [STEP 7] Selected ${labelText} = "${exactLabel}" (from "${optionValue}") using overlay`);
        return;
      }
      throw new Error(`No option matching "${exactLabel}" in Licence held dropdown. Valid options: ${LICENCE_HELD_EXACT_OPTIONS.join(', ')}`);
    } catch (overlayError) {
      throw new Error(`Failed to select ${labelText}: ${overlayError.message}`);
    }
  }

  try {
    // Try getByLabel first
    let field = iframe.getByLabel(labelText);
    let selectorUsed = `getByLabel("${labelText}")`;

    if (await field.count() === 0) {
      // Fallback to ID-based selector - click to open dropdown
      const dropdownInput = iframe.locator(`#${fieldId} .dx-texteditor-input`);
      await dropdownInput.click();
      await page.waitForTimeout(500);

      // For non-Licence-held dropdowns, try overlay first to avoid cross-matches, then global
      const overlay = iframe.locator('.dx-dropdowneditor-overlay .dx-list-items');
      const overlayVisible = await overlay.isVisible().catch(() => false);
      const optionsRoot = overlayVisible ? overlay : iframe;
      const option = optionsRoot.locator(`.dx-item:has-text("${optionValue}")`).first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
      selectorUsed = `#${fieldId} dropdown`;
      console.log(`✅ [STEP 7] Selected ${labelText} = "${optionValue}" using ${selectorUsed}`);
      return;
    }

    // Use getByLabel selectOption
    await field.selectOption({ label: optionValue });
    console.log(`✅ [STEP 7] Selected ${labelText} = "${optionValue}" using ${selectorUsed}`);
  } catch (error) {
    // Fallback: try ID-based approach
    try {
      const dropdownInput = iframe.locator(`#${fieldId} .dx-texteditor-input`);
      await dropdownInput.click();
      await page.waitForTimeout(500);
      const overlay = iframe.locator('.dx-dropdowneditor-overlay .dx-list-items');
      const overlayVisible = await overlay.isVisible().catch(() => false);
      const optionsRoot = overlayVisible ? overlay : iframe;
      const option = optionsRoot.locator(`.dx-item:has-text("${optionValue}")`).first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
      console.log(`✅ [STEP 7] Selected ${labelText} = "${optionValue}" using fallback #${fieldId}`);
    } catch (fallbackError) {
      throw new Error(`Failed to select ${labelText}: ${fallbackError.message}`);
    }
  }
}

/**
 * @param {boolean} [skipNextClick=false] - If true, fill all provided fields but do NOT click Next (used when required fields are missing so we don't navigate away).
 */
export async function fillContactDetails(page, contactDetails, screenshotsDir, addressConfirmed = false, progressCallback = null, skipNextClick = false) {
  try {
    console.log('📝 [STEP 7] Filling contact details for new client...');
    
    // Wait for contact form to be ready
    await page.waitForTimeout(2000);
    
    // The contact form is inside eventNewBooking2_iframe
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    if (!eventBookingIframeExists) {
      throw new Error('eventNewBooking2_iframe not found - contact form may not have loaded');
    }
    
    const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
    
    // Wait for form to be ready
    await page.waitForTimeout(2000);
    
    // 1. Title
    if (contactDetails.title) {
      console.log(`📝 [STEP 7] Filling Title: ${contactDetails.title}`);
      await selectDropdownOption(eventBookingIframe, page, 'Title', 'cnt_title', contactDetails.title);
    }
    
    // 2. First Names (fixed label: "First Names" with capital N)
    if (contactDetails.firstNames) {
      console.log(`📝 [STEP 7] Filling First Names: ${contactDetails.firstNames}`);
      await fillTextField(eventBookingIframe, 'First Names', 'cnt_first_names', contactDetails.firstNames);
    }
    
    // 3. Surname
    if (contactDetails.surname) {
      console.log(`📝 [STEP 7] Filling Surname: ${contactDetails.surname}`);
      await fillTextField(eventBookingIframe, 'Surname', 'cnt_surname', contactDetails.surname);
    }
    
    // 4. Contact mobile number
    if (contactDetails.mobileNumber) {
      console.log(`📝 [STEP 7] Filling Contact mobile number: ${contactDetails.mobileNumber}`);
      await fillTextField(eventBookingIframe, 'Contact mobile number', 'cnt_mobile_number', contactDetails.mobileNumber);
    }
    
    // 5. Contact e-mail
    if (contactDetails.email) {
      console.log(`📝 [STEP 7] Filling Contact e-mail: ${contactDetails.email}`);
      await fillTextField(eventBookingIframe, 'Contact e-mail', 'cnt_email', contactDetails.email);
    }
    
    // 6. Date of birth
    if (contactDetails.dateOfBirth) {
      console.log(`📝 [STEP 7] Filling Date of birth: ${contactDetails.dateOfBirth}`);
      await fillTextField(eventBookingIframe, 'Date of birth', 'cnt_birthdate', contactDetails.dateOfBirth);
      await page.waitForTimeout(1000); // Wait for age to auto-calculate
      
      // Check age (must be 16+) - Updated to use #cnt_age
      let ageElement = eventBookingIframe.locator('#cnt_age input[role="spinbutton"]');
      if (await ageElement.count() === 0) {
        ageElement = eventBookingIframe.locator('#cnt_age .dx-texteditor-input');
      }
      if (await ageElement.count() === 0) {
        ageElement = eventBookingIframe.locator('#cnt_age');
      }
      
      if (await ageElement.count() > 0) {
        const ageText = await ageElement.inputValue().catch(async () => {
          return await ageElement.textContent();
        });
        const age = parseInt(ageText);
        if (!isNaN(age) && age < 16) {
          throw new Error('Client is under 16 - not eligible for ITM');
        }
        if (!isNaN(age)) {
          console.log(`✅ [STEP 7] Age verified: ${age} years old`);
        }
      }
    }
    
    // 7. Post Code (fixed label: "Post Code" with capital C)
    if (contactDetails.postcode) {
      console.log(`📝 [STEP 7] Filling Post Code: ${contactDetails.postcode}`);
      await fillTextField(eventBookingIframe, 'Post Code', 'cmp_post_code', contactDetails.postcode);
    }
    
    // 8. House number or name
    let autoPopulatedAddress = null;
    let townCity = null;
    if (contactDetails.houseNumberOrName && !addressConfirmed) {
      // Only fill house number if address hasn't been confirmed yet (first call)
      console.log(`📝 [STEP 8] House number field is empty on client details page`);
      console.log(`📝 [STEP 8] Filling House number or name: ${contactDetails.houseNumberOrName}`);
      
      try {
        const houseNumberField = await fillTextField(eventBookingIframe, 'House number or name', 'cmp_buildingnumber', contactDetails.houseNumberOrName);
        
        // Press Tab to trigger address auto-population
        await houseNumberField.press('Tab');
        await page.waitForTimeout(2000);
      
      // Address 1 and Town/City should auto-populate
      // Read the auto-populated address for confirmation
      let address1Field = eventBookingIframe.getByLabel('Address 1');
      if (await address1Field.count() === 0) {
        address1Field = eventBookingIframe.locator('#cmp_address_1 .dx-texteditor-input');
      }
      
      let townCityField = eventBookingIframe.getByLabel('Town/City');
      if (await townCityField.count() === 0) {
        townCityField = eventBookingIframe.locator('#cmp_town .dx-texteditor-input');
      }
      
      if (await address1Field.count() > 0) {
        autoPopulatedAddress = await address1Field.inputValue();
        console.log(`📍 [STEP 7] Address 1 auto-populated: ${autoPopulatedAddress}`);
      }
      
      if (await townCityField.count() > 0) {
        townCity = await townCityField.inputValue();
        console.log(`📍 [STEP 7] Town/City auto-populated: ${townCity}`);
      }
      
        // CRITICAL FIX: Only return requiresAddressConfirmation if we're on the Contact Details page
        // This prevents asking for confirmation on LookupContactPage where the house number field doesn't exist
        const eventBookingIframeStillExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
        if (!eventBookingIframeStillExists) {
          // We're not on the Contact Details page anymore - don't ask for confirmation
          console.log('⚠️ [STEP 8] Not on Contact Details page anymore - skipping address confirmation');
          // Continue with the flow without confirmation
        } else if (autoPopulatedAddress && autoPopulatedAddress.trim() !== '') {
          // Only return requiresAddressConfirmation if we're on the correct page
          return {
            success: true,
            requiresAddressConfirmation: true,
            autoPopulatedAddress: autoPopulatedAddress,
            townCity: townCity,
            message: `Address auto-populated as: ${autoPopulatedAddress}. Please confirm with client before proceeding.`
          };
        }
      } catch (error) {
        // If field is not visible/editable, check if address was already confirmed
        if (addressConfirmed) {
          console.log(`⚠️ [STEP 8] House number field not accessible, but addressConfirmed=true, skipping house number fill`);
          // Continue without filling house number - address was already confirmed
        } else {
          // Re-throw if this is the first attempt and address not confirmed
          console.error(`❌ [STEP 8] Error filling house number field:`, error.message);
          throw error;
        }
      }
    } else if (addressConfirmed) {
      console.log(`✅ [STEP 8] Address already confirmed, skipping house number fill`);
    } else if (addressConfirmed && contactDetails.correctedAddress) {
      // Address was confirmed but incorrect, update it
      console.log(`📝 [STEP 7] Updating Address 1 with corrected address: ${contactDetails.correctedAddress}`);
      let address1Field = eventBookingIframe.getByLabel('Address 1');
      if (await address1Field.count() === 0) {
        address1Field = eventBookingIframe.locator('#cmp_address_1 .dx-texteditor-input');
      }
      if (await address1Field.count() > 0) {
        await address1Field.fill(contactDetails.correctedAddress);
        console.log(`✅ [STEP 7] Address 1 updated with corrected address`);
        await page.waitForTimeout(500);
      }
    }
    
    // 9. Licence held
    if (contactDetails.licenceHeld) {
      console.log(`📝 [STEP 7] Filling Licence held: ${contactDetails.licenceHeld}`);
      await selectDropdownOption(eventBookingIframe, page, 'Licence held', 'xid_29019', contactDetails.licenceHeld);
    }
    
    // 10. National Insurance number
    if (contactDetails.nationalInsuranceNumber) {
      console.log(`📝 [STEP 7] Filling National Insurance number: ${contactDetails.nationalInsuranceNumber}`);
      await fillTextField(eventBookingIframe, 'National Insurance number', 'cnt_NI_number', contactDetails.nationalInsuranceNumber);
    }
    
    // 11. Driving licence number
    if (contactDetails.drivingLicenceNumber) {
      console.log(`📝 [STEP 7] Filling Driving licence number: ${contactDetails.drivingLicenceNumber}`);
      
      // Handle GB/NI format - Updated with ID-based fallback
      if (contactDetails.licenceFormat === 'NI') {
        let gbButton = eventBookingIframe.getByRole('button', { name: 'GB' }).first();
        if (await gbButton.count() === 0) {
          gbButton = eventBookingIframe.locator('#cnt_driving_licence_no button[aria-label="GB"]').first();
        }
        if (await gbButton.count() > 0) {
          await gbButton.click();
          await page.waitForTimeout(500);
          console.log('✅ [STEP 7] Switched driving licence format to NI');
        }
      }
      
      await fillTextField(eventBookingIframe, 'Driving licence number', 'cnt_driving_licence_no', contactDetails.drivingLicenceNumber);
    }
    
    // 12. Hear about us? (fixed label: added question mark)
    if (contactDetails.hearAboutUs) {
      console.log(`📝 [STEP 7] Filling Hear about us?: ${contactDetails.hearAboutUs}`);
      await selectDropdownOption(eventBookingIframe, page, 'Hear about us?', 'cnt_hear_about', contactDetails.hearAboutUs);
    }
    
    // 13. Riding experience (keep lowercase 'r' - matches HTML)
    if (contactDetails.ridingExperience) {
      console.log(`📝 [STEP 7] Filling riding experience: ${contactDetails.ridingExperience}`);
      await selectDropdownOption(eventBookingIframe, page, 'riding experience', 'xid_29022', contactDetails.ridingExperience);
    }
    
    // 14. Keep you updated
    if (contactDetails.marketingConsent !== undefined) {
      const value = contactDetails.marketingConsent ? 'YES' : 'NO';
      console.log(`📝 [STEP 7] Filling Keep you updated: ${value}`);
      await selectDropdownOption(eventBookingIframe, page, 'Keep you updated', 'cnt_GDPR_receive_own_marketing', value);
    }
    
    // 15. Send details to others
    if (contactDetails.dataSharing !== undefined) {
      const value = contactDetails.dataSharing ? 'YES' : 'NO';
      console.log(`📝 [STEP 7] Filling Send details to others: ${value}`);
      await selectDropdownOption(eventBookingIframe, page, 'Send details to others', 'cnt_GDPR_send_details_to_others', value);
    }
    
    // Take screenshot before clicking Next
    await takeScreenshot(page, 'contact-details-filled.png', screenshotsDir);
    progressCallback?.({ message: 'Saving your details.' });
    
    // 16. Click Next button only when skipNextClick is false (e.g. when required fields are complete)
    if (skipNextClick) {
      console.log('⏭️ [STEP 7] Skipping Next click (required fields incomplete—caller will collect and retry).');
      return;
    }
    
    // If address confirmation is required, it should have been returned earlier
    console.log('👆 [STEP 7] Clicking Next button...');
    let nextButton = eventBookingIframe.locator('#diaryNewCourseBookingWiz_nextBtn').first();
    
    if (await nextButton.count() === 0) {
      nextButton = eventBookingIframe.locator('[aria-label="Next"], [aria-label="next"]').first();
    }
    
    if (await nextButton.count() === 0) {
      nextButton = eventBookingIframe.locator('button:has-text("Next"), button:has-text("next")').first();
    }
    
    if (await nextButton.count() === 0) {
      throw new Error('Next button not found on contact details page');
    }
    
    await nextButton.waitFor({ state: 'visible', timeout: 5000 });
    await nextButton.click();
    
    // Wait for next page to load
    console.log('⏳ [STEP 7] Waiting for next page to load...');
    await page.waitForTimeout(3000);
    
    // Take screenshot after clicking Next
    await takeScreenshot(page, 'after-contact-details-next.png', screenshotsDir);
    
    console.log('✅ [STEP 7] Contact details filled and Next button clicked');
    
  } catch (error) {
    console.error('❌ [STEP 7] Error filling contact details:', error);
    await takeScreenshot(page, 'contact-details-error.png', screenshotsDir);
    throw new Error(`Failed to fill contact details: ${error.message}`);
  }
}

