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

/**
 * Maps courseType enum to the correct SMS preset template name
 * @param {string} courseType - Course type enum value (can be simplified or full enum format)
 * @returns {string} SMS preset template name to search for in dropdown
 */
export function getSMSPresetTemplateName(courseType) {
  const courseTypeLower = courseType.toLowerCase();
  
  if (courseTypeLower.includes('itm') || courseTypeLower.includes('introduction to motorcycling')) {
    return 'ITM / Gear Conversion / Private Motorcycling SMS Booking Confirmation';
  }
  if (courseTypeLower.includes('gear conversion')) {
    return 'ITM / Gear Conversion / Private Motorcycling SMS Booking Confirmation';
  }
  if (courseTypeLower.includes('private lesson')) {
    return 'ITM / Gear Conversion / Private Motorcycling SMS Booking Confirmation';
  }
  if (courseTypeLower.includes('cbt')) {
    return 'CBT Booking Confirmation';
  }
  if (courseTypeLower.includes('tfl') && courseTypeLower.includes('beyond')) {
    return 'TfL – Beyond CBT Booking Confirmation';
  }
  if (courseTypeLower.includes('tfl') && (courseTypeLower.includes('one-to-one') || courseTypeLower.includes('1-2-1'))) {
    return 'TfL - 1-2-1 Motorcycle Skills Booking Confirmation – WITH TRAINING SITE ADDRESS';
  }
  if (courseTypeLower.includes('tfl')) {
    return 'TfL - 1-2-1 Motorcycle Skills Booking Confirmation – WITH TRAINING SITE ADDRESS';
  }
  if (courseTypeLower.includes('full licence') || courseTypeLower.includes('das')) {
    return 'DAS/A2/A1/ERS/Full Licence Assessment SMS Booking Confirmation';
  }
  
  return 'ITM / Gear Conversion / Private Motorcycling SMS Booking Confirmation'; // Default fallback
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
 * Selects an SMS preset template from the dropdown
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|Page} searchContext - Search context (main page or iframe)
 * @param {string} presetTemplateName - Name of the preset template to select
 * @returns {Promise<void>}
 */
export async function selectSMSPreset(page, searchContext, presetTemplateName) {
  console.log(`🔍 [SMS] Looking for preset dropdown #SMSmessage_row_2...`);
  
  // Locate the preset dropdown row
  const presetDropdownRow = searchContext.locator('#SMSmessage_row_2');
  const rowExists = await presetDropdownRow.count() > 0;
  
  if (!rowExists) {
    throw new Error('Could not find preset dropdown row (#SMSmessage_row_2)');
  }
  
  // Click to open the dropdown
  console.log('🖱️ [SMS] Clicking preset dropdown to open...');
  await presetDropdownRow.click();
  await page.waitForTimeout(2000);
  
  // Wait for DevExtreme dropdown overlay to appear (last direct child of body)
  console.log('⏳ [SMS] Waiting for dropdown overlay to appear...');
  await page.waitForTimeout(1000);
  
  // Find the dropdown overlay (last direct child of body with class dx-dropdownlist-popup-wrapper)
  const dropdownOverlay = page.locator('body > div.dx-dropdownlist-popup-wrapper').last();
  const overlayExists = await dropdownOverlay.count() > 0;
  
  if (!overlayExists) {
    throw new Error('Could not find dropdown overlay');
  }
  
  // Find dropdown list container with class dx-list and role="listbox"
  const dropdownList = dropdownOverlay.locator('.dx-list[role="listbox"]');
  const listExists = await dropdownList.count() > 0;
  
  if (!listExists) {
    throw new Error('Could not find dropdown list container');
  }
  
  // Find all preset options
  const presetOptions = dropdownList.locator('div.dx-list-item[role="option"]');
  const optionCount = await presetOptions.count();
  
  if (optionCount === 0) {
    throw new Error('No preset options found in dropdown');
  }
  
  console.log(`📊 [SMS] Found ${optionCount} preset options, searching for "${presetTemplateName}"...`);
  
  // Search through options to find matching preset
  let matchingOption = null;
  
  for (let i = 0; i < optionCount; i++) {
    const option = presetOptions.nth(i);
    const optionContent = option.locator('.dx-item-content.dx-list-item-content');
    const optionText = await optionContent.textContent();
    const normalizedOptionText = optionText ? optionText.trim() : '';
    
    console.log(`   Preset Option ${i + 1}: "${normalizedOptionText}"`);
    
    // Check for exact match or partial match (e.g., "CBT Booking Confirmation" matches "CBT Booking Confirmation - ALPERTON")
    if (normalizedOptionText.includes(presetTemplateName) || 
        presetTemplateName.includes(normalizedOptionText) ||
        normalizedOptionText.toLowerCase().includes(presetTemplateName.toLowerCase().substring(0, 20))) {
      console.log(`✅ [SMS] Found matching preset option: "${normalizedOptionText}"`);
      matchingOption = option;
      break;
    }
  }
  
  if (!matchingOption) {
    throw new Error(`Could not find preset template: "${presetTemplateName}" in dropdown`);
  }
  
  // Check if visible, scroll if needed
  const isVisible = await matchingOption.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('🔍 [SMS] Preset option not visible, scrolling...');
    await matchingOption.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  }
  
  // Click preset option
  await matchingOption.waitFor({ state: 'visible', timeout: 5000 });
  console.log('🖱️ [SMS] Clicking preset option...');
  await matchingOption.click();
  await page.waitForTimeout(2000);
  
  console.log('✅ [SMS] Preset selected successfully');
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
