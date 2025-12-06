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
 * Helper function to select dropdown option with label and ID fallback
 */
async function selectDropdownOption(iframe, page, labelText, fieldId, optionValue) {
  try {
    // Try getByLabel first
    let field = iframe.getByLabel(labelText);
    let selectorUsed = `getByLabel("${labelText}")`;
    
    if (await field.count() === 0) {
      // Fallback to ID-based selector - click to open dropdown
      const dropdownInput = iframe.locator(`#${fieldId} .dx-texteditor-input`);
      await dropdownInput.click();
      await page.waitForTimeout(500);
      
      // Select option from dropdown
      const option = iframe.locator(`.dx-item:has-text("${optionValue}")`).first();
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
      const option = iframe.locator(`.dx-item:has-text("${optionValue}")`).first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
      console.log(`✅ [STEP 7] Selected ${labelText} = "${optionValue}" using fallback #${fieldId}`);
    } catch (fallbackError) {
      throw new Error(`Failed to select ${labelText}: ${error.message}`);
    }
  }
}

export async function fillContactDetails(page, contactDetails, screenshotsDir) {
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
    if (contactDetails.houseNumberOrName) {
      console.log(`📝 [STEP 7] Filling House number or name: ${contactDetails.houseNumberOrName}`);
      const houseNumberField = await fillTextField(eventBookingIframe, 'House number or name', 'cmp_buildingnumber', contactDetails.houseNumberOrName);
      
      // Press Tab to trigger address auto-population
      await houseNumberField.press('Tab');
      await page.waitForTimeout(2000);
      
      // Address 1 and Town/City should auto-populate
      // These will be verified by voice agent, so we just wait for them
      let address1Field = eventBookingIframe.getByLabel('Address 1');
      if (await address1Field.count() === 0) {
        address1Field = eventBookingIframe.locator('#cmp_address_1 .dx-texteditor-input');
      }
      
      let townCityField = eventBookingIframe.getByLabel('Town/City');
      if (await townCityField.count() === 0) {
        townCityField = eventBookingIframe.locator('#cmp_town .dx-texteditor-input');
      }
      
      if (await address1Field.count() > 0) {
        const address1 = await address1Field.inputValue();
        console.log(`📍 [STEP 7] Address 1 auto-populated: ${address1}`);
      }
      
      if (await townCityField.count() > 0) {
        const townCity = await townCityField.inputValue();
        console.log(`📍 [STEP 7] Town/City auto-populated: ${townCity}`);
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
    
    // 16. Click Next button
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

