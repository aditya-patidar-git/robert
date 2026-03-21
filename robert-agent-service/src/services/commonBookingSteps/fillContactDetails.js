import { takeScreenshot } from './utils.js';

/** Agent-facing copy when CRM auto-filled Address 1 from postcode—only for requiresAddressConfirmation; not used elsewhere. */
export const ADDRESS_CONFIRMATION_AGENT_INSTRUCTION =
  'The system has auto-filled an address from the postcode. NARROW EXCEPTION (this confirmation turn only): you MAY briefly say minimal identifying parts so the caller knows which address they are confirming—e.g. the main street or building name and optionally the town or area. Do NOT read the postcode aloud. Do NOT read the full multi-line address line-by-line. Keep it to one short phrase, then ask if that is correct. When they say yes, call booking_step_fill_contact_details again with courseType, workflowType, and addressConfirmed: true only—the server remembers the contact details you already submitted. If they say no, ask only for the corrected first line, then call with correctedAddress as needed (other fields still remembered). After that call succeeds, chain to payment in the same turn—do not wait for the caller.';

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
 * @param {boolean} contactDetails.marketingConsent - Keep you updated (Yes/No in UI)
 * @param {boolean} contactDetails.dataSharing - Send details to others (Yes/No in UI)
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {boolean} addressConfirmed - Whether the client has confirmed the auto-populated address (default: false)
 * @param {string} correctedAddress - Corrected address if client said the auto-populated address was incorrect
 * @returns {Promise<{success: boolean, requiresAddressConfirmation?: boolean, autoPopulatedAddress?: string, townCity?: string, message?: string, instruction?: string}>}
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
    'full uk driving licence': 'Full UK car licence',
    'full uk driving license': 'Full UK car licence',
    'full car': 'Full UK car licence',
    'full uk manual bike': 'Full UK manual bike licence',
    'full manual bike': 'Full UK manual bike licence',
    'full uk automatic bike': 'Full UK automatic bike licence',
    'full eu motorcycle': 'Full EU Motorcycle Licence',
    'motorcycle': 'Full EU Motorcycle Licence',
    'motorcycle licence': 'Full EU Motorcycle Licence',
    'motorcycle license': 'Full EU Motorcycle Licence',
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
 * Returns the exact "Licence held" dropdown options as a comma-separated list for use in prompts.
 * Use this so the agent can list options and ask the caller to choose one; then pass the exact option text as licenceHeld.
 * @returns {string}
 */
export function getLicenceHeldOptionsForPrompt() {
  return LICENCE_HELD_EXACT_OPTIONS.join(', ');
}

/**
 * Exact "Hear about us?" dropdown options (CRM). Pass verbatim as hearAboutUs.
 */
export const HEAR_ABOUT_US_EXACT_OPTIONS = [
  'Friends',
  'Google',
  'Bing',
  'Yahoo',
  'Motorcycle Shop',
  'Recommendation',
  'Other websites',
  'RideTo',
  'Deliveroo',
  'UberEATS'
];

/**
 * Exact "Riding experience" dropdown options (CRM). Pass verbatim as ridingExperience.
 */
export const RIDING_EXPERIENCE_EXACT_OPTIONS = [
  'None',
  'None but can ride a push bike',
  'Some but a while ago',
  'Some recently',
  'Some/medium experience',
  'Had a previous CBT',
  'Experienced Rider'
];

export function getHearAboutUsOptionsForPrompt() {
  return HEAR_ABOUT_US_EXACT_OPTIONS.join(', ');
}

export function getRidingExperienceOptionsForPrompt() {
  return RIDING_EXPERIENCE_EXACT_OPTIONS.join(', ');
}

/**
 * Map caller phrasing to exact "Hear about us?" label.
 * @param {string} optionValue
 * @returns {string}
 */
function resolveHearAboutUsLabel(optionValue) {
  if (!optionValue || typeof optionValue !== 'string') return optionValue;
  const normalized = optionValue.trim().toLowerCase().replace(/\s+/g, ' ');
  const map = {
    friend: 'Friends',
    friends: 'Friends',
    google: 'Google',
    bing: 'Bing',
    yahoo: 'Yahoo',
    'motorcycle shop': 'Motorcycle Shop',
    recommendation: 'Recommendation',
    'other websites': 'Other websites',
    website: 'Other websites',
    websites: 'Other websites',
    rideto: 'RideTo',
    deliveroo: 'Deliveroo',
    ubereats: 'UberEATS',
    'uber eats': 'UberEATS',
    newspaper: 'Other websites',
    radio: 'Other websites',
    other: 'Other websites',
    somewhere: 'Other websites',
    online: 'Other websites'
  };
  if (map[normalized]) return map[normalized];
  const match = HEAR_ABOUT_US_EXACT_OPTIONS.find(opt => opt.trim().toLowerCase() === normalized);
  if (match) return match;
  return optionValue.trim();
}

/**
 * Map caller phrasing to exact "Riding experience" label.
 * @param {string} optionValue
 * @returns {string}
 */
function resolveRidingExperienceLabel(optionValue) {
  if (!optionValue || typeof optionValue !== 'string') return optionValue;
  const normalized = optionValue.trim().toLowerCase().replace(/\s+/g, ' ');
  const map = {
    none: 'None',
    beginner: 'None',
    'push bike': 'None but can ride a push bike',
    'a while ago': 'Some but a while ago',
    recently: 'Some recently',
    'some experience': 'Some/medium experience',
    medium: 'Some/medium experience',
    cbt: 'Had a previous CBT',
    'previous cbt': 'Had a previous CBT',
    experienced: 'Experienced Rider',
    'experienced rider': 'Experienced Rider'
  };
  if (map[normalized]) return map[normalized];
  const match = RIDING_EXPERIENCE_EXACT_OPTIONS.find(opt => opt.trim().toLowerCase() === normalized);
  if (match) return match;
  return optionValue.trim();
}

/** Timeout (ms) for DevExtreme dropdown overlay to become visible (increased to 10s for slow environments). */
const DROPDOWN_OVERLAY_TIMEOUT_MS = 10000;

/**
 * Select an option from a DevExtreme selectbox (shared overlay may render on `page` or `iframe`).
 * @param {string} [validOptionsHint] - Appended to errors (e.g. comma-separated list).
 * @returns {Promise<boolean>} true if the option was clicked
 */
async function selectOptionFromOverlay(iframe, page, fieldId, exactLabel, validOptionsHint = '') {
  // If focus is elsewhere, clicking the input may only focus; the dropdown button opens in one click.
  const dropArrow = iframe.locator(`#${fieldId} .dx-dropdowneditor-button`);
  if ((await dropArrow.count()) > 0) {
    await dropArrow.first().click();
  } else {
    await iframe.locator(`#${fieldId} .dx-texteditor-input`).click();
  }

  const overlaySelector = '.dx-overlay-wrapper.dx-dropdowneditor-overlay:not(.dx-state-invisible)';

  let portalOverlay = null;
  let resolvedContext = null;

  const deadline = Date.now() + DROPDOWN_OVERLAY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const pageCount = await page.locator(overlaySelector).filter({ hasText: exactLabel }).count();
    if (pageCount > 0) {
      portalOverlay = page.locator(overlaySelector).filter({ hasText: exactLabel });
      resolvedContext = 'page';
      break;
    }

    const iframeCount = await iframe.locator(overlaySelector).filter({ hasText: exactLabel }).count();
    if (iframeCount > 0) {
      portalOverlay = iframe.locator(overlaySelector).filter({ hasText: exactLabel });
      resolvedContext = 'iframe';
      break;
    }

    await page.waitForTimeout(200);
  }

  if (!portalOverlay || !resolvedContext) {
    throw new Error(
      `Overlay with "${exactLabel}" not found in either page or iframe after ${DROPDOWN_OVERLAY_TIMEOUT_MS}ms.` +
        (validOptionsHint ? ` Valid options: ${validOptionsHint}` : '')
    );
  }

  console.log(`📋 [STEP 7] Dropdown overlay resolved in: ${resolvedContext} (fieldId=${fieldId})`);

  await portalOverlay.waitFor({ state: 'visible', timeout: 5000 });

  const items = portalOverlay.locator('.dx-list-items .dx-item');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const text = (await item.locator('.dx-item-content').textContent()).trim();
    if (text === exactLabel) {
      await item.click();
      return true;
    }
  }

  throw new Error(
    `Option "${exactLabel}" not found in ${resolvedContext} overlay. Found ${count} items.` +
      (validOptionsHint ? ` Valid options: ${validOptionsHint}` : '')
  );
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
      const done = await selectOptionFromOverlay(iframe, page, fieldId, exactLabel, LICENCE_HELD_EXACT_OPTIONS.join(', '));
      if (done) {
        console.log(`✅ [STEP 7] Selected ${labelText} = "${exactLabel}" (from "${optionValue}") using overlay`);
        return;
      }
      throw new Error(`No option matching "${exactLabel}" in Licence held dropdown. Valid options: ${LICENCE_HELD_EXACT_OPTIONS.join(', ')}`);
    } catch (overlayError) {
      throw new Error(`Failed to select ${labelText}: ${overlayError.message}`);
    }
  }

  if (fieldId === 'cnt_hear_about') {
    const exactLabel = resolveHearAboutUsLabel(optionValue);
    try {
      await selectOptionFromOverlay(iframe, page, fieldId, exactLabel, HEAR_ABOUT_US_EXACT_OPTIONS.join(', '));
      console.log(`✅ [STEP 7] Selected ${labelText} = "${exactLabel}" (from "${optionValue}") using overlay`);
      return;
    } catch (overlayError) {
      throw new Error(`Failed to select ${labelText}: ${overlayError.message}`);
    }
  }

  if (fieldId === 'xid_29022') {
    const exactLabel = resolveRidingExperienceLabel(optionValue);
    try {
      await selectOptionFromOverlay(iframe, page, fieldId, exactLabel, RIDING_EXPERIENCE_EXACT_OPTIONS.join(', '));
      console.log(`✅ [STEP 7] Selected ${labelText} = "${exactLabel}" (from "${optionValue}") using overlay`);
      return;
    } catch (overlayError) {
      throw new Error(`Failed to select ${labelText}: ${overlayError.message}`);
    }
  }

  if (fieldId === 'cnt_GDPR_receive_own_marketing' || fieldId === 'cnt_GDPR_send_details_to_others') {
    let yn = String(optionValue).trim();
    if (/^yes$/i.test(yn) || yn === 'YES') yn = 'Yes';
    else if (/^no$/i.test(yn) || yn === 'NO') yn = 'No';
    try {
      await selectOptionFromOverlay(iframe, page, fieldId, yn, 'Yes, No');
      console.log(`✅ [STEP 7] Selected ${labelText} = "${yn}" using overlay`);
      return;
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
 * Screenshot, optional progress message, click Contact Details Next, wait for navigation.
 */
async function clickContactDetailsNextButton(eventBookingIframe, page, screenshotsDir, progressCallback) {
  await takeScreenshot(page, 'contact-details-filled.png', screenshotsDir);
  progressCallback?.({ message: 'Saving your details.' });

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

  console.log('⏳ [STEP 7] Waiting for next page to load...');
  await page.waitForTimeout(3000);

  await takeScreenshot(page, 'after-contact-details-next.png', screenshotsDir);
}

/**
 * Non-sensitive survey + GDPR Yes/No dropdowns (same DevExtreme overlay behaviour as Licence held).
 * @param {string[]} [skippedFields] - If provided, failed fields are pushed for partialFill reporting.
 */
async function fillSurveyAndGdprDropdowns(eventBookingIframe, page, contactDetails, skippedFields) {
  if (contactDetails.hearAboutUs) {
    try {
      console.log(`📝 [STEP 7] Filling Hear about us?: ${contactDetails.hearAboutUs}`);
      await selectDropdownOption(eventBookingIframe, page, 'Hear about us?', 'cnt_hear_about', contactDetails.hearAboutUs);
    } catch (e) {
      console.warn('⚠️ [STEP 7] Could not fill Hear about us?:', e.message);
      skippedFields?.push('hearAboutUs');
    }
  }
  if (contactDetails.ridingExperience) {
    try {
      console.log(`📝 [STEP 7] Filling riding experience: ${contactDetails.ridingExperience}`);
      await selectDropdownOption(eventBookingIframe, page, 'riding experience', 'xid_29022', contactDetails.ridingExperience);
    } catch (e) {
      console.warn('⚠️ [STEP 7] Could not fill riding experience:', e.message);
      skippedFields?.push('ridingExperience');
    }
  }
  if (contactDetails.marketingConsent !== undefined) {
    const value = contactDetails.marketingConsent ? 'Yes' : 'No';
    try {
      console.log(`📝 [STEP 7] Filling Keep you updated: ${value}`);
      await selectDropdownOption(eventBookingIframe, page, 'Keep you updated', 'cnt_GDPR_receive_own_marketing', value);
    } catch (e) {
      console.warn('⚠️ [STEP 7] Could not fill Keep you updated:', e.message);
      skippedFields?.push('marketingConsent');
    }
  }
  if (contactDetails.dataSharing !== undefined) {
    const value = contactDetails.dataSharing ? 'Yes' : 'No';
    try {
      console.log(`📝 [STEP 7] Filling Send details to others: ${value}`);
      await selectDropdownOption(eventBookingIframe, page, 'Send details to others', 'cnt_GDPR_send_details_to_others', value);
    } catch (e) {
      console.warn('⚠️ [STEP 7] Could not fill Send details to others:', e.message);
      skippedFields?.push('dataSharing');
    }
  }
}

/**
 * @param {boolean} [skipNextClick=false] - If true, fill all provided fields but do NOT click Next (used when required fields are missing so we don't navigate away).
 * @param {boolean} [addressConfirmShortcut=false] - If true (new client only), skip re-filling the full form: apply survey/GDPR dropdowns from contactDetails then Next. Used after caller confirms auto-populated address.
 */
export async function fillContactDetails(
  page,
  contactDetails,
  screenshotsDir,
  addressConfirmed = false,
  progressCallback = null,
  skipNextClick = false,
  addressConfirmShortcut = false
) {
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

    /** Fields we could not fill (e.g. Licence held timeout); continue with rest and still click Next. */
    const skippedFields = [];
    
    // Wait for form to be ready
    await page.waitForTimeout(2000);

    // New client: caller confirmed the auto-populated address and gave no correction—apply survey/GDPR dropdowns if provided, then Next (avoids re-filling text fields). Do not use for existing-client partial fills (they pass addressConfirmed=true for other reasons).
    if (addressConfirmShortcut && addressConfirmed && !contactDetails.correctedAddress && !skipNextClick) {
      console.log('✅ [STEP 7] Address confirmed with no correction—survey/GDPR dropdowns then Next');
      await fillSurveyAndGdprDropdowns(eventBookingIframe, page, contactDetails, skippedFields);
      await clickContactDetailsNextButton(eventBookingIframe, page, screenshotsDir, progressCallback);
      console.log('✅ [STEP 7] Contact details step completed (address-confirm short path)');
      return {
        success: true,
        partialFill: skippedFields.length > 0,
        skippedFields: skippedFields.length > 0 ? [...skippedFields] : undefined
      };
    }

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
          // Fill Licence held, NI, Driving licence BEFORE returning for address confirmation so form has all data; Next will be clicked on follow-up when addressConfirmed is true
          if (contactDetails.licenceHeld) {
            try {
              console.log(`📝 [STEP 7] Filling Licence held (before address confirmation): ${contactDetails.licenceHeld}`);
              await selectDropdownOption(eventBookingIframe, page, 'Licence held', 'xid_29019', contactDetails.licenceHeld);
            } catch (licenceErr) {
              console.warn('⚠️ [STEP 7] Could not fill Licence held:', licenceErr.message, '- continuing with next fields');
              skippedFields.push('licenceHeld');
            }
          }
          if (contactDetails.nationalInsuranceNumber) {
            console.log(`📝 [STEP 7] Filling National Insurance number (before address confirmation): ${contactDetails.nationalInsuranceNumber}`);
            await fillTextField(eventBookingIframe, 'National Insurance number', 'cnt_NI_number', contactDetails.nationalInsuranceNumber);
          }
          if (contactDetails.drivingLicenceNumber) {
            console.log(`📝 [STEP 7] Filling Driving licence number (before address confirmation): ${contactDetails.drivingLicenceNumber}`);
            if (contactDetails.licenceFormat === 'NI') {
              let gbButton = eventBookingIframe.getByRole('button', { name: 'GB' }).first();
              if (await gbButton.count() === 0) {
                gbButton = eventBookingIframe.locator('#cnt_driving_licence_no [role="button"][aria-label="GB"]').first();
              }
              if (await gbButton.count() > 0) {
                await gbButton.click();
                await page.waitForTimeout(500);
              }
            }
            await fillTextField(eventBookingIframe, 'Driving licence number', 'cnt_driving_licence_no', contactDetails.drivingLicenceNumber);
          }
          // Only return requiresAddressConfirmation if we're on the correct page.
          // Include partialFill/skippedFields when any field failed so coordinator can proceed without waiting.
          return {
            success: true,
            requiresAddressConfirmation: true,
            autoPopulatedAddress: autoPopulatedAddress,
            townCity: townCity,
            message: `Address auto-populated as: ${autoPopulatedAddress}. Please confirm with client before proceeding.`,
            instruction: ADDRESS_CONFIRMATION_AGENT_INSTRUCTION,
            partialFill: skippedFields.length > 0,
            skippedFields: skippedFields.length > 0 ? [...skippedFields] : undefined
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
    } else if (addressConfirmed && contactDetails.correctedAddress) {
      // Follow-up: caller gave a corrected first line — fill Address 1 once; if the CRM repopulates after this, we leave the field as-is and continue to Next.
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
    } else if (addressConfirmed) {
      console.log(`✅ [STEP 8] Address already confirmed, skipping house number fill`);
    }
    
    // 9. Licence held (lenient: skip on timeout/error and continue)
    if (contactDetails.licenceHeld) {
      try {
        console.log(`📝 [STEP 7] Filling Licence held: ${contactDetails.licenceHeld}`);
        await selectDropdownOption(eventBookingIframe, page, 'Licence held', 'xid_29019', contactDetails.licenceHeld);
      } catch (licenceErr) {
        console.warn('⚠️ [STEP 7] Could not fill Licence held:', licenceErr.message, '- continuing with next fields');
        skippedFields.push('licenceHeld');
      }
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
          gbButton = eventBookingIframe.locator('#cnt_driving_licence_no [role="button"][aria-label="GB"]').first();
        }
        if (await gbButton.count() > 0) {
          await gbButton.click();
          await page.waitForTimeout(500);
          console.log('✅ [STEP 7] Switched driving licence format to NI');
        }
      }
      
      await fillTextField(eventBookingIframe, 'Driving licence number', 'cnt_driving_licence_no', contactDetails.drivingLicenceNumber);
    }
    
    // 12–15. Hear about us, riding experience, Keep you updated, Send details to others
    await fillSurveyAndGdprDropdowns(eventBookingIframe, page, contactDetails, skippedFields);

    // 16. Click Next button only when skipNextClick is false (e.g. when required fields are complete)
    if (skipNextClick) {
      await takeScreenshot(page, 'contact-details-filled.png', screenshotsDir);
      progressCallback?.({ message: 'Saving your details.' });
      console.log('⏭️ [STEP 7] Skipping Next click (required fields incomplete—caller will collect and retry).');
      return;
    }

    await clickContactDetailsNextButton(eventBookingIframe, page, screenshotsDir, progressCallback);

    console.log('✅ [STEP 7] Contact details filled and Next button clicked');
    if (skippedFields.length > 0) {
      console.log('⚠️ [STEP 7] Some fields were skipped:', skippedFields.join(', '));
    }

    return {
      success: true,
      partialFill: skippedFields.length > 0,
      skippedFields: skippedFields.length > 0 ? skippedFields : undefined
    };
    
  } catch (error) {
    console.error('❌ [STEP 7] Error filling contact details:', error);
    await takeScreenshot(page, 'contact-details-error.png', screenshotsDir);
    throw new Error(`Failed to fill contact details: ${error.message}`);
  }
}

