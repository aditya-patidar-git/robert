import { takeScreenshot, extractLocationIdentifier } from '../../utils.js';

/**
 * Selects a location from the location dropdown.
 * @param {import('playwright').Page} page - Playwright page object.
 * @param {Object} sessionDetails - Session details containing location information.
 * @param {string} sessionDetails.location - Location name to match.
 * @param {string} screenshotsDir - Directory to save screenshots.
 * @returns {Promise<void>}
 */
export async function selectLocation(page, sessionDetails, screenshotsDir) {
  // Select location from dropdown (after date selection)
  console.log(`📍 [STEP 6-7] Selecting location from dropdown...`);
  console.log(`📋 Location from Step 1: "${sessionDetails.location}"`);
  
  // Extract location identifier for matching
  const locationIdentifier = extractLocationIdentifier(sessionDetails.location);
  
  if (!locationIdentifier) {
    console.log(`⚠️ [STEP 6-7] Could not extract location identifier from "${sessionDetails.location}", skipping location selection`);
    return;
  }
  
  console.log(`📍 [STEP 6-7] Extracted location identifier: "${locationIdentifier}"`);
  
  // Determine if we need to work with iframe or main page (same as date selector)
  const diariesIframeExists = await page.locator('#newDiaryDefault_iframe').count() > 0;
  let locationDropdown;
  let searchContext;
  
  if (diariesIframeExists) {
    console.log('🔍 [STEP 6-7] Working with Diaries iframe for location dropdown...');
    const iframe = page.frameLocator('#newDiaryDefault_iframe');
    locationDropdown = iframe.locator('#diary_ids').first();
    searchContext = iframe;
  } else {
    console.log('🔍 [STEP 6-7] Working with main page for location dropdown...');
    locationDropdown = page.locator('#diary_ids').first();
    searchContext = page;
  }
  
  // Wait for dropdown to be visible
  await locationDropdown.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ [STEP 6-7] Found location dropdown');
  
  // Click on the dropdown to open it (same pattern as Contacts tab)
  console.log('📍 [STEP 6-7] Clicking location dropdown to open...');
  // Try clicking the dropdown button first (more specific), then fallback to the container
  const dropdownButton = locationDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
  if (await dropdownButton.count() > 0) {
    await dropdownButton.click();
  } else {
    // Fallback: click on the dropdown container itself
    await locationDropdown.click();
  }
  
  // WAIT FOR DROPDOWN MENU TO APPEAR - 2 seconds (same as Contacts tab)
  console.log('⏳ [STEP 6-7] Waiting for location dropdown menu to appear...');
  await page.waitForTimeout(2000);
  
  // Take screenshot of opened dropdown
  await takeScreenshot(page, 'location-dropdown-opened.png', screenshotsDir);
  
  // Find all location options in the dropdown (same pattern as Contacts tab)
  // Options are in: .dx-list-item[role="option"] with text in .dx-item-content.dx-list-item-content
  const locationOptions = searchContext.locator('div.dx-list-item[role="option"]');
  const optionCount = await locationOptions.count();
  console.log(`📊 [STEP 6-7] Found ${optionCount} location options in dropdown`);
  
  // Find matching option (partial match)
  let matchingOption = null;
  const locationIdentifierLower = locationIdentifier.toLowerCase();
  
  for (let i = 0; i < optionCount; i++) {
    const option = locationOptions.nth(i);
    const optionText = await option.locator('.dx-item-content.dx-list-item-content').textContent();
    const optionTextLower = optionText ? optionText.trim().toLowerCase() : '';
    
    console.log(`   Option ${i + 1}: "${optionText}"`);
    
    // Check if location identifier matches (partial match)
    // Match if: identifier is in option text, or first word of option (city name) is in identifier
    const optionFirstWord = optionTextLower.split(',')[0].trim();
    if (optionTextLower.includes(locationIdentifierLower) || 
        locationIdentifierLower.includes(optionFirstWord) ||
        optionFirstWord.includes(locationIdentifierLower)) {
      console.log(`✅ [STEP 6-7] Found matching location option: "${optionText}"`);
      matchingOption = option;
      break;
    }
  }
  
  if (matchingOption) {
    // Check if it's visible, if not, scroll (same pattern as Contacts tab)
    const isMatchingOptionVisible = await matchingOption.isVisible();
    console.log(`🔍 [STEP 6-7] Matching option visible: ${isMatchingOptionVisible}`);
    
    if (!isMatchingOptionVisible) {
      console.log('🔍 [STEP 6-7] Matching option not visible, scrolling in dropdown...');
      
      // Scroll up in the dropdown menu to make option visible
      await page.keyboard.press('Home'); // Go to top of dropdown
      await page.waitForTimeout(1000);
      
      // Alternative: try to scroll the dropdown container
      const dropdownMenu = searchContext.locator('[role="listbox"], .dx-dropdownlist, .dx-list, .dx-list-items').first();
      if (await dropdownMenu.count() > 0) {
        await dropdownMenu.evaluate(el => el.scrollTop = 0);
        await page.waitForTimeout(1000);
      }
    }
    
    // Now try to find and click the matching option
    await matchingOption.waitFor({ state: 'visible', timeout: 5000 });
    console.log('📍 [STEP 6-7] Matching location option is now visible, clicking...');
    await matchingOption.click();
    
    // WAIT FOR LOCATION SELECTION TO BE APPLIED - 2 seconds (same as Contacts tab)
    console.log('⏳ [STEP 6-7] Waiting for location selection...');
    await page.waitForTimeout(2000);
    
    // Take screenshot after location selection
    await takeScreenshot(page, 'location-selected.png', screenshotsDir);
    console.log('✅ [STEP 6-7] Location selected successfully');
  } else {
    console.log(`⚠️ [STEP 6-7] No matching location option found for "${locationIdentifier}"`);
    console.log(`⚠️ [STEP 6-7] Available options were checked, but none matched. Continuing without location selection...`);
    // Close dropdown if it's still open (press Escape)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
}
