import { takeScreenshot, waitForThenOptionalDelay, CRM_STABILITY_DELAY_MS } from '../../utils.js';

/**
 * Selects a calendar type from the calendar type dropdown (Day planner or TfL Diary).
 * @param {import('playwright').Page} page - Playwright page object.
 * @param {string} diaryType - Optional diary type: 'TfL Diary' for TfL courses, undefined/default for standard 'Day planner'.
 * @param {string} screenshotsDir - Directory to save screenshots.
 * @returns {Promise<void>}
 */
export async function selectCalendarType(page, diaryType, screenshotsDir) {
  console.log(`📅 [STEP 6-7] Selecting calendar type from dropdown...`);

  // Determine if we need to work with iframe or main page (reuse diariesIframeExists from date selection)
  // Check again to ensure iframe still exists (it may have changed)
  const calendarTypeIframeExists = await page.locator('#newDiaryDefault_iframe').count() > 0;
  let calendarTypeDropdown = null;
  let calendarSearchContext;
  
  if (calendarTypeIframeExists) {
    console.log('🔍 [STEP 6-7] Working with Diaries iframe for calendar type dropdown...');
    const iframe = page.frameLocator('#newDiaryDefault_iframe');
    calendarSearchContext = iframe;
  } else {
    console.log('🔍 [STEP 6-7] Working with main page for calendar type dropdown...');
    calendarSearchContext = page;
  }
  
  // Try multiple selectors to find calendar type dropdown (try in order, stop when found)
  const calendarTypeSelectors = [
    'input[placeholder="Choose..."]', // Primary selector based on placeholder
    'input[aria-haspopup="listbox"][role="combobox"]', // Role-based selector
    '.dx-texteditor-input[placeholder="Choose..."]', // DevExtreme-specific selector
    'input[placeholder*="Choose"]', // Partial placeholder match
    '.dx-dropdowneditor input[placeholder="Choose..."]', // Parent container with DevExtreme class
  ];
  
  for (const selector of calendarTypeSelectors) {
    try {
      const dropdown = calendarSearchContext.locator(selector).first();
      if (await dropdown.count() > 0) {
        const isVisible = await dropdown.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`✅ [STEP 6-7] Found calendar type dropdown using selector: "${selector}"`);
          // Find parent container (dropdown editor) for clicking
          const parentContainer = dropdown.locator('..').locator('..').locator('..').first();
          if (await parentContainer.count() > 0) {
            calendarTypeDropdown = parentContainer;
          } else {
            calendarTypeDropdown = dropdown;
          }
          break;
        }
      }
    } catch (e) {
      // Continue to next selector
      continue;
    }
  }
  
  // If not found in current context, try main page
  if (!calendarTypeDropdown) {
    console.log('🔍 [STEP 6-7] Calendar type dropdown not found in current context, trying main page...');
    for (const selector of calendarTypeSelectors) {
      try {
        const dropdown = page.locator(selector).first();
        if (await dropdown.count() > 0) {
          const isVisible = await dropdown.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 6-7] Found calendar type dropdown on main page using selector: "${selector}"`);
            const parentContainer = dropdown.locator('..').locator('..').locator('..').first();
            if (await parentContainer.count() > 0) {
              calendarTypeDropdown = parentContainer;
            } else {
              calendarTypeDropdown = dropdown;
            }
            calendarSearchContext = page;
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
        continue;
      }
    }
  }
  
  if (!calendarTypeDropdown) {
    console.log('⚠️ [STEP 6-7] Calendar type dropdown not found, continuing without calendar type selection...');
    return;
  }
  
  // Wait for dropdown to be visible
  await calendarTypeDropdown.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
    console.log('⚠️ [STEP 6-7] Calendar type dropdown visibility check timed out, continuing...');
  });
  console.log('✅ [STEP 6-7] Found calendar type dropdown');
  
  // Click on the dropdown to open it (same pattern as location dropdown)
  console.log('📅 [STEP 6-7] Clicking calendar type dropdown to open...');
  // Try clicking the dropdown button first (more specific), then fallback to the container
  const dropdownButton = calendarTypeDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
  if (await dropdownButton.count() > 0) {
    await dropdownButton.click();
  } else {
    // Fallback: click on the dropdown container or input field
    const inputField = calendarTypeDropdown.locator('input[placeholder="Choose..."]').first();
    if (await inputField.count() > 0) {
      await inputField.click();
    } else {
      await calendarTypeDropdown.click();
    }
  }
  
  console.log('⏳ [STEP 6-7] Waiting for calendar type dropdown menu to appear...');
  await waitForThenOptionalDelay(page, calendarSearchContext.locator('div.dx-list-item[role="option"]').first(), { state: 'attached', timeout: 5000, delayMs: CRM_STABILITY_DELAY_MS });

  await takeScreenshot(page, 'calendar-type-dropdown-opened.png', screenshotsDir);

  const calendarTypeOptions = calendarSearchContext.locator('div.dx-list-item[role="option"]');
  const optionCount = await calendarTypeOptions.count();
  console.log(`📊 [STEP 6-7] Found ${optionCount} calendar type options in dropdown`);
  
  // Determine target option text based on diaryType parameter
  // Default to "Day planner" for backward compatibility
  const targetOptionText = diaryType === 'TfL Diary' ? 'TfL Diary' : 'Day planner';
  console.log(`📅 [STEP 6-7] Looking for calendar type: "${targetOptionText}"`);
  let matchingOption = null;
  
  for (let i = 0; i < optionCount; i++) {
    const option = calendarTypeOptions.nth(i);
    const optionText = await option.locator('.dx-item-content.dx-list-item-content').textContent();
    const optionTextTrimmed = optionText ? optionText.trim() : '';
    
    console.log(`   Option ${i + 1}: "${optionTextTrimmed}"`);
    
    // Check if option text matches "Day planner" (case-insensitive)
    if (optionTextTrimmed.toLowerCase() === targetOptionText.toLowerCase()) {
      console.log(`✅ [STEP 6-7] Found matching calendar type option: "${optionTextTrimmed}"`);
      matchingOption = option;
      break;
    }
  }
  
  if (matchingOption) {
    // Check if it's visible, if not, scroll (same pattern as location dropdown)
    const isMatchingOptionVisible = await matchingOption.isVisible();
    console.log(`🔍 [STEP 6-7] Matching option visible: ${isMatchingOptionVisible}`);
    
    if (!isMatchingOptionVisible) {
      console.log('🔍 [STEP 6-7] Matching option not visible, scrolling in dropdown...');
      
      // Scroll up in the dropdown menu to make option visible
      await page.keyboard.press('Home');
      await page.waitForTimeout(CRM_STABILITY_DELAY_MS);

      const dropdownMenu = calendarSearchContext.locator('[role="listbox"], .dx-dropdownlist, .dx-list, .dx-list-items').first();
      if (await dropdownMenu.count() > 0) {
        await dropdownMenu.evaluate(el => el.scrollTop = 0);
        await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
      }
    }

    await matchingOption.waitFor({ state: 'visible', timeout: 5000 });
    console.log('📅 [STEP 6-7] Matching calendar type option is now visible, clicking...');
    await matchingOption.click();

    console.log('⏳ [STEP 6-7] Waiting for calendar type selection...');
    await waitForThenOptionalDelay(page, calendarTypeDropdown, { state: 'visible', timeout: 5000, delayMs: CRM_STABILITY_DELAY_MS });
    
    // Take screenshot after calendar type selection
    await takeScreenshot(page, 'calendar-type-selected.png', screenshotsDir);
    console.log(`✅ [STEP 6-7] Calendar type "${targetOptionText}" selected successfully`);
  } else {
    console.log(`⚠️ [STEP 6-7] No matching calendar type option found for "${targetOptionText}"`);
    console.log(`⚠️ [STEP 6-7] Available options were checked, but none matched. Continuing without calendar type selection...`);
    // Close dropdown if it's still open (press Escape)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
  }
}
