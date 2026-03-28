import { format } from 'date-fns';
import { takeScreenshot } from './utils.js';

/**
 * Maps courseType enum to the correct confirmation email template name
 * @param {string} courseType - Course type enum value
 * @returns {string} Template name to search for in stationery grid
 */
export function getConfirmationTemplateName(courseType) {
  const courseTypeLower = courseType.toLowerCase();
  
  if (courseTypeLower.includes('itm') || courseTypeLower.includes('introduction to motorcycling')) {
    return 'ITM / Gear Conversion confirmation';
  }
  if (courseTypeLower.includes('gear conversion')) {
    return 'ITM / Gear Conversion confirmation';
  }
  if (courseTypeLower.includes('private lesson')) {
    return 'ITM / Gear Conversion confirmation';
  }
  if (courseTypeLower.includes('cbt')) {
    return 'CBT - Booking confirmation';
  }
  if (courseTypeLower.includes('tfl') && courseTypeLower.includes('beyond')) {
    return 'TfL Sessions - Booking confirmation';
  }
  if (courseTypeLower.includes('tfl')) {
    return 'TfL Sessions - Booking confirmation';
  }
  if (courseTypeLower.includes('full licence') || courseTypeLower.includes('das')) {
    return 'DAS/A2/A1 - BOOKING CONFIRMATION EMAIL';
  }
  
  return 'ITM / Gear Conversion confirmation'; // Default fallback
}

/**
 * Finds the "Send a confirmation" button in the afterBookingMenu
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @returns {Promise<Locator>} The list item element to click
 */
export async function findSendConfirmationButton(page, searchContext) {
  console.log('🔍 [STATIONERY] Looking for "Send a confirmation" button in #afterBookingMenu...');
  
  // Locate the afterBookingMenu container
  const menuContainer = searchContext.locator('#afterBookingMenu');
  const containerExists = await menuContainer.count() > 0;
  
  if (!containerExists) {
    throw new Error('Could not find #afterBookingMenu container');
  }
  
  // Find the list item with heading "Send a confirmation"
  // Use filter with hasText to find the item containing the heading text
  const listItem = menuContainer.locator('div.dx-item.dx-list-item').filter({
    hasText: /Send a confirmation/i
  }).first();
  
  const itemExists = await listItem.count() > 0;
  if (!itemExists) {
    throw new Error('Could not find "Send a confirmation" list item in #afterBookingMenu');
  }
  
  console.log('✅ [STATIONERY] Found "Send a confirmation" button');
  return listItem;
}

/**
 * Selects a stationery template from the stationery grid
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @param {string} templateName - Name of the template to select
 * @returns {Promise<void>}
 */
export async function selectStationeryTemplate(page, searchContext, templateName) {
  console.log(`🔍 [STATIONERY] Looking for template: "${templateName}" in #stationeryGrid_page...`);
  
  // Locate the stationery grid page container
  const gridContainer = searchContext.locator('#stationeryGrid_page');
  const containerExists = await gridContainer.count() > 0;
  
  if (!containerExists) {
    throw new Error('Could not find #stationeryGrid_page container');
  }
  
  // Find all template rows
  const templateRows = gridContainer.locator('tr.jqx_quickGridRow');
  const rowCount = await templateRows.count();
  
  if (rowCount === 0) {
    throw new Error('No template rows found in #stationeryGrid_page');
  }
  
  console.log(`📊 [STATIONERY] Found ${rowCount} template rows, searching for "${templateName}"...`);
  
  // Search through rows to find matching template
  let matchingRow = null;
  
  for (let i = 0; i < rowCount; i++) {
    const row = templateRows.nth(i);
    const rowText = await row.textContent();
    const normalizedRowText = rowText ? rowText.trim() : '';
    
    // Check for exact match or partial match (template name might be part of longer text)
    if (normalizedRowText.includes(templateName) || templateName.includes(normalizedRowText)) {
      console.log(`✅ [STATIONERY] Found matching template at row ${i + 1}: "${normalizedRowText.substring(0, 100)}..."`);
      matchingRow = row;
      break;
    }
  }
  
  if (!matchingRow) {
    throw new Error(`Could not find template: "${templateName}" in stationery grid`);
  }
  
  // Click on the matching row
  console.log(`🖱️ [STATIONERY] Clicking template row...`);
  await matchingRow.click();
  await page.waitForTimeout(2000);
}

/**
 * Clicks the Preview button (#btnPreview)
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @returns {Promise<void>}
 */
export async function clickPreviewButton(page, searchContext) {
  console.log('🔍 [STATIONERY] Looking for Preview button (#btnPreview)...');
  
  const previewButton = searchContext.locator('#btnPreview');
  const buttonExists = await previewButton.count() > 0;
  
  if (!buttonExists) {
    throw new Error('Could not find Preview button (#btnPreview)');
  }
  
  const isVisible = await previewButton.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('⚠️ [STATIONERY] Preview button not visible, scrolling into view...');
    await previewButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  }
  
  console.log('🖱️ [STATIONERY] Clicking Preview button...');
  await previewButton.click();
  await page.waitForTimeout(1000);
  
  console.log('✅ [STATIONERY] Preview button clicked');
}

/**
 * Clicks the Email button (#btnEmail)
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @returns {Promise<void>}
 */
export async function clickEmailButton(page, searchContext) {
  console.log('🔍 [STATIONERY] Looking for Email button (#btnEmail)...');
  
  const emailButton = searchContext.locator('#btnEmail');
  const buttonExists = await emailButton.count() > 0;
  
  if (!buttonExists) {
    throw new Error('Could not find Email button (#btnEmail)');
  }
  
  const isVisible = await emailButton.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('⚠️ [STATIONERY] Email button not visible, scrolling into view...');
    await emailButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  }
  
  console.log('🖱️ [STATIONERY] Clicking Email button...');
  await emailButton.click();
  await page.waitForTimeout(2000);
  
  console.log('✅ [STATIONERY] Email button clicked');
}

/**
 * Clicks the Back button (#btnClose)
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @returns {Promise<void>}
 */
export async function clickBackButton(page, searchContext) {
  console.log('🔍 [STATIONERY] Looking for Back button (#btnClose)...');
  
  const backButton = searchContext.locator('#btnClose');
  const buttonExists = await backButton.count() > 0;
  
  if (!buttonExists) {
    throw new Error('Could not find Back button (#btnClose)');
  }
  
  const isVisible = await backButton.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('⚠️ [STATIONERY] Back button not visible, scrolling into view...');
    await backButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  }
  
  console.log('🖱️ [STATIONERY] Clicking Back button...');
  await backButton.click();
  await page.waitForTimeout(2000);
  
  console.log('✅ [STATIONERY] Back button clicked');
}

/**
 * Waits for the "Email has been sent" confirmation message
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @returns {Promise<boolean>} True if confirmation found, false otherwise
 */
export async function waitForEmailSentConfirmation(page, searchContext) {
  console.log('⏳ [STATIONERY] Waiting for email sent confirmation...');
  
  const confirmationSelectors = [
    'text=/Email has been sent/i',
    'text=/email.*sent/i',
    'text=/success/i',
    '.success-message',
    '.alert-success'
  ];
  
  let confirmationFound = false;
  for (const selector of confirmationSelectors) {
    try {
      const confirmation = searchContext.locator(selector).first();
      if (await confirmation.count() > 0) {
        await confirmation.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        const isVisible = await confirmation.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`✅ [STATIONERY] Email sent confirmation found using selector: "${selector}"`);
          confirmationFound = true;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!confirmationFound) {
    console.log('⚠️ [STATIONERY] Email sent confirmation not immediately visible, but continuing...');
  }
  
  return confirmationFound;
}

/** Normalize list text for fuzzy matching (Unicode dashes, spaces). */
export function normalizeSmsListText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function presetSubstringMatches(optionText, presetTemplateName) {
  const o = normalizeSmsListText(optionText);
  const p = normalizeSmsListText(presetTemplateName);
  if (!o || !p) return false;
  if (o.includes(p) || p.includes(o)) return true;
  const head = p.length >= 28 ? p.slice(0, 28) : p;
  return o.includes(head);
}

/**
 * Maps courseType enum to the correct SMS preset template name (CRM labels).
 * @param {string} courseType - Course type enum value (can be simplified or full enum format)
 * @returns {string} SMS preset template name to search for in dropdown
 */
export function getSMSPresetTemplateName(courseType) {
  const raw = courseType == null ? '' : String(courseType);
  const courseTypeLower = raw.toLowerCase();

  if (courseTypeLower.includes('itm') || courseTypeLower.includes('introduction to motorcycling')) {
    return 'London: ITM / Gear Conversion / Private Motorcycling Lessons Booking Confirmation';
  }
  if (courseTypeLower.includes('gear conversion')) {
    return 'London: ITM / Gear Conversion / Private Motorcycling Lessons Booking Confirmation';
  }
  if (courseTypeLower.includes('private lesson')) {
    return 'London: ITM / Gear Conversion / Private Motorcycling Lessons Booking Confirmation';
  }
  if (courseTypeLower.includes('cbt')) {
    return 'CBT Booking Confirmation';
  }
  if (courseTypeLower.includes('tfl') && courseTypeLower.includes('beyond')) {
    return 'TfL - Beyond CBT Booking Confirmation';
  }
  if (courseTypeLower.includes('tfl') && (courseTypeLower.includes('one-to-one') || courseTypeLower.includes('1-2-1'))) {
    return 'TfL - 1-2-1 Motorcycle Skills Booking Confirmation - WITH TRAINING SITE ADDRESS';
  }
  if (courseTypeLower.includes('tfl')) {
    return 'TfL - 1-2-1 Motorcycle Skills Booking Confirmation - WITH TRAINING SITE ADDRESS';
  }
  if (courseTypeLower.includes('full licence') || courseTypeLower.includes('das') || courseTypeLower.includes('full motorcycle licence')) {
    return 'DAS / A2 / A1 / ERS / Full Licence Assessment Booking Confirmation';
  }

  return 'London: ITM / Gear Conversion / Private Motorcycling Lessons Booking Confirmation';
}

/**
 * Parse session slot date into a Date (UK DD/MM/YYYY or ISO).
 * @param {Object} sd - sessionDetails
 * @returns {Date|null}
 */
export function parseSessionDateFromDetails(sd) {
  if (!sd || typeof sd !== 'object') return null;
  const tryParse = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    const ddmmyyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      return new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  let d = tryParse(sd.startDate);
  if (d) return d;
  d = tryParse(sd.date);
  return d;
}

/**
 * Build needles to match the CRM "Choose a course" line: `Course … on DD Mon YYYY at HH:MM`.
 * @param {string} courseType
 * @param {Object} sessionDetails
 * @returns {{ dateNeedle: string, timeNeedle: string, courseNeedles: string[] }|null}
 */
export function buildSmsCourseMatchNeedles(courseType, sessionDetails) {
  if (!sessionDetails || typeof sessionDetails !== 'object') return null;
  const dt = parseSessionDateFromDetails(sessionDetails);
  if (!dt) return null;
  const dateNeedle = format(dt, 'd MMM yyyy');
  const timeRaw = sessionDetails.time != null ? String(sessionDetails.time).trim() : '';
  const timeMatch = timeRaw.match(/\b(\d{1,2}):(\d{2})\b/);
  const timeNeedle = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '';
  if (!timeNeedle) return null;

  const ct = (courseType == null ? '' : String(courseType)).toLowerCase();
  const courseNeedles = [];
  if (ct.includes('itm') || ct.includes('introduction to motorcycling')) {
    courseNeedles.push('itm - introduction to motorcycle', 'introduction to motorcycling');
  } else if (ct.includes('gear conversion')) {
    courseNeedles.push('gear conversion');
  } else if (ct.includes('private lesson')) {
    courseNeedles.push('private motorcycling');
  } else if (ct.includes('cbt') || ct.includes('compulsory basic')) {
    courseNeedles.push('compulsory basic training (cbt)', 'cbt)');
  } else if (ct.includes('beyond') && ct.includes('tfl')) {
    courseNeedles.push('tfl - beyond cbt', 'skills for delivery');
  } else if (ct.includes('tfl')) {
    courseNeedles.push('tfl - 1-2-1 motorcycle skills');
  } else if (ct.includes('full licence') || ct.includes('das') || ct.includes('full motorcycle licence')) {
    courseNeedles.push('full motorcycle licence assessment');
  } else {
    courseNeedles.push(ct.slice(0, 40));
  }

  return { dateNeedle, timeNeedle, courseNeedles };
}

/**
 * Finds the "Send SMS" button in the afterBookingMenu
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @returns {Promise<Locator>} The list item element to click
 */
export async function findSendSMSButton(page, searchContext) {
  console.log('🔍 [SMS] Looking for "Send SMS" button in #afterBookingMenu...');
  
  // Locate the afterBookingMenu container (reuse same pattern as findSendConfirmationButton)
  const menuContainer = searchContext.locator('#afterBookingMenu');
  const containerExists = await menuContainer.count() > 0;
  
  if (!containerExists) {
    throw new Error('Could not find #afterBookingMenu container');
  }
  
  // Find the list item with heading "Send SMS"
  const listItem = menuContainer.locator('div.dx-item.dx-list-item').filter({
    hasText: /Send SMS/i
  }).first();
  
  const itemExists = await listItem.count() > 0;
  if (!itemExists) {
    throw new Error('Could not find "Send SMS" list item in #afterBookingMenu');
  }
  
  console.log('✅ [SMS] Found "Send SMS" button');
  return listItem;
}

/**
 * Open DevExtreme SMS dropdown and return option locators (same pattern as preset / course rows).
 * @param {import('playwright').Page} page
 * @param {import('playwright').FrameLocator|import('playwright').Page} searchContext
 * @param {import('playwright').Locator} dropdownRow
 */
async function openSmsDevExtremeDropdown(page, searchContext, dropdownRow) {
  await dropdownRow.click();
  await page.waitForTimeout(2000);
  await page.waitForTimeout(1000);

  let dropdownOverlay = searchContext.locator('div.dx-dropdownlist-popup-wrapper').last();
  let overlayExists = await dropdownOverlay.count() > 0;
  if (!overlayExists) {
    dropdownOverlay = page.locator('body > div.dx-dropdownlist-popup-wrapper').last();
    overlayExists = await dropdownOverlay.count() > 0;
  }
  if (!overlayExists) {
    throw new Error('Could not find dropdown overlay');
  }

  let dropdownList = dropdownOverlay.locator('.dx-list-items[role="listbox"]');
  let listExists = (await dropdownList.count()) > 0;
  if (!listExists) {
    dropdownList = dropdownOverlay.locator('.dx-list[role="listbox"]');
    listExists = (await dropdownList.count()) > 0;
  }
  if (!listExists) {
    throw new Error('Could not find dropdown list container');
  }

  const options = dropdownList.locator('div.dx-list-item[role="option"]');
  return { options };
}

/**
 * Selects an SMS preset template from the dropdown
 * @param {import('playwright').Page} page - Playwright page object
 * @param {import('playwright').FrameLocator|import('playwright').Page} searchContext - Search context (main page or iframe)
 * @param {string} presetTemplateName - Name of the preset template to select
 * @param {string|null} [venueHint] - Training site / location for CBT lines (`CBT Booking Confirmation - VENUE`)
 * @returns {Promise<void>}
 */
export async function selectSMSPreset(page, searchContext, presetTemplateName, venueHint = null) {
  console.log(`🔍 [SMS] Looking for preset dropdown #SMSmessage_row_2...`);

  const presetDropdownRow = searchContext.locator('#SMSmessage_row_2');
  const rowExists = await presetDropdownRow.count() > 0;
  if (!rowExists) {
    throw new Error('Could not find preset dropdown row (#SMSmessage_row_2)');
  }

  console.log('🖱️ [SMS] Clicking preset dropdown to open...');
  console.log('⏳ [SMS] Waiting for dropdown overlay to appear...');
  const { options: presetOptions } = await openSmsDevExtremeDropdown(page, searchContext, presetDropdownRow);
  const optionCount = await presetOptions.count();

  if (optionCount === 0) {
    throw new Error('No preset options found in dropdown');
  }

  const cbtBase = 'CBT Booking Confirmation';
  const isCbtPreset =
    normalizeSmsListText(presetTemplateName) === normalizeSmsListText(cbtBase) ||
    presetTemplateName.trim() === cbtBase;

  console.log(`📊 [SMS] Found ${optionCount} preset options, searching for "${presetTemplateName}"...`);

  let matchingOption = null;

  if (isCbtPreset) {
    const venueNorm = venueHint ? normalizeSmsListText(venueHint) : '';
    const cbtMatches = [];
    for (let i = 0; i < optionCount; i++) {
      const option = presetOptions.nth(i);
      const optionContent = option.locator('.dx-item-content.dx-list-item-content');
      const optionText = await optionContent.textContent();
      const t = optionText ? optionText.trim() : '';
      if (!presetSubstringMatches(t, cbtBase)) continue;
      if (venueNorm && !normalizeSmsListText(t).includes(venueNorm)) continue;
      cbtMatches.push({ option, text: t });
    }
    if (cbtMatches.length >= 1) {
      matchingOption = cbtMatches[0].option;
      console.log(`✅ [SMS] CBT preset selected: "${cbtMatches[0].text}"`);
    } else {
      for (let i = 0; i < optionCount; i++) {
        const option = presetOptions.nth(i);
        const optionContent = option.locator('.dx-item-content.dx-list-item-content');
        const optionText = await optionContent.textContent();
        const t = optionText ? optionText.trim() : '';
        if (presetSubstringMatches(t, cbtBase)) {
          console.warn(`⚠️ [SMS] CBT venue "${venueHint}" not matched; using first CBT line: "${t}"`);
          matchingOption = option;
          break;
        }
      }
    }
  } else {
    for (let i = 0; i < optionCount; i++) {
      const option = presetOptions.nth(i);
      const optionContent = option.locator('.dx-item-content.dx-list-item-content');
      const optionText = await optionContent.textContent();
      const normalizedOptionText = optionText ? optionText.trim() : '';
      console.log(`   Preset Option ${i + 1}: "${normalizedOptionText}"`);
      if (presetSubstringMatches(normalizedOptionText, presetTemplateName)) {
        console.log(`✅ [SMS] Found matching preset option: "${normalizedOptionText}"`);
        matchingOption = option;
        break;
      }
    }
  }

  if (!matchingOption) {
    throw new Error(`Could not find preset template: "${presetTemplateName}" in dropdown`);
  }

  const isVisible = await matchingOption.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('🔍 [SMS] Preset option not visible, scrolling...');
    await matchingOption.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  }

  await matchingOption.waitFor({ state: 'visible', timeout: 5000 });
  console.log('🖱️ [SMS] Clicking preset option...');
  await matchingOption.click();
  await page.waitForTimeout(2000);

  console.log('✅ [SMS] Preset selected successfully');
}

/**
 * Resolve "(optional) Choose a course" row — same table pattern as #SMSmessage_row_2.
 * @param {import('playwright').FrameLocator|import('playwright').Page} searchContext
 * @returns {Promise<import('playwright').Locator|null>}
 */
export async function resolveSmsCourseDropdownRow(searchContext) {
  const ids = ['#SMSmessage_row_3', '#SMSmessage_row_4', '#SMSmessage_row_5'];
  for (const id of ids) {
    const loc = searchContext.locator(id);
    if (await loc.count() > 0) {
      console.log(`🔍 [SMS] Using course dropdown row ${id}`);
      return loc;
    }
  }
  const byLabel = searchContext.locator('tr, div').filter({ hasText: /Choose a course/i }).first();
  if (await byLabel.count() > 0) {
    console.log('🔍 [SMS] Using course dropdown row matched by "Choose a course" label');
    return byLabel;
  }
  return null;
}

/**
 * Select the booking session line in "Choose a course" so the SMS body matches the booking.
 * @param {import('playwright').Page} page
 * @param {import('playwright').FrameLocator|import('playwright').Page} searchContext
 * @param {Object} sessionDetails
 * @param {string} courseType
 * @returns {Promise<void>}
 */
export async function selectSMSCourseOption(page, searchContext, sessionDetails, courseType) {
  const needles = buildSmsCourseMatchNeedles(courseType, sessionDetails);
  if (!needles) {
    console.log('ℹ️ [SMS] No session date/time for course line match — skipping "Choose a course"');
    return;
  }

  const { dateNeedle, timeNeedle, courseNeedles } = needles;
  const courseRow = await resolveSmsCourseDropdownRow(searchContext);
  if (!courseRow) {
    console.log('ℹ️ [SMS] No "Choose a course" row found — skipping');
    return;
  }

  console.log(`🔍 [SMS] Opening "Choose a course" dropdown (date="${dateNeedle}", time="${timeNeedle}")...`);
  const { options: courseOptions } = await openSmsDevExtremeDropdown(page, searchContext, courseRow);
  const optionCount = await courseOptions.count();
  if (optionCount === 0) {
    throw new Error('Choose a course dropdown opened but has no options');
  }

  const dateN = normalizeSmsListText(dateNeedle);
  const timeN = timeNeedle;

  let matchingOption = null;
  for (let i = 0; i < optionCount; i++) {
    const option = courseOptions.nth(i);
    const optionContent = option.locator('.dx-item-content.dx-list-item-content');
    const optionText = await optionContent.textContent();
    const t = optionText ? optionText.trim() : '';
    const n = normalizeSmsListText(t);
    const hasDate = n.includes(dateN);
    const hasTime = n.includes(timeN);
    const hasCourse = courseNeedles.some((needle) => n.includes(normalizeSmsListText(needle)));
    console.log(`   Course option ${i + 1}: "${t.substring(0, 120)}..." date=${hasDate} time=${hasTime} course=${hasCourse}`);
    if (hasDate && hasTime && hasCourse) {
      matchingOption = option;
      break;
    }
  }

  if (!matchingOption) {
    for (let i = 0; i < optionCount; i++) {
      const option = courseOptions.nth(i);
      const optionContent = option.locator('.dx-item-content.dx-list-item-content');
      const optionText = await optionContent.textContent();
      const t = optionText ? optionText.trim() : '';
      const n = normalizeSmsListText(t);
      if (n.includes(dateN) && n.includes(timeN)) {
        console.warn(`⚠️ [SMS] Relaxed match (date+time only): "${t.substring(0, 120)}..."`);
        matchingOption = option;
        break;
      }
    }
  }

  if (!matchingOption) {
    throw new Error(
      `Could not match "Choose a course" option for date "${dateNeedle}" at ${timeNeedle}. Check sessionDetails.date/startDate and time.`
    );
  }

  await matchingOption.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  await matchingOption.waitFor({ state: 'visible', timeout: 5000 });
  await matchingOption.click();
  await page.waitForTimeout(1500);
  console.log('✅ [SMS] Choose a course option selected');
}

/**
 * Clicks the Send message button (#btnSendMessage)
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @returns {Promise<void>}
 */
export async function clickSendMessageButton(page, searchContext) {
  console.log('🔍 [SMS] Looking for Send message button (#btnSendMessage)...');
  
  const sendMessageButton = searchContext.locator('#btnSendMessage');
  const buttonExists = await sendMessageButton.count() > 0;
  
  if (!buttonExists) {
    throw new Error('Could not find Send message button (#btnSendMessage)');
  }
  
  const isVisible = await sendMessageButton.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('⚠️ [SMS] Send message button not visible, scrolling into view...');
    await sendMessageButton.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  }
  
  console.log('🖱️ [SMS] Clicking Send message button...');
  await sendMessageButton.click();
  await page.waitForTimeout(2000);
  
  console.log('✅ [SMS] Send message button clicked');
}
