import { takeScreenshot } from './utils.js';

/**
 * Send SMS confirmation after booking is completed
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} courseType - Course type: 'tfl-one-to-one', 'tfl-beyond-cbt', or 'full-licence'
 */
export async function sendSMSConfirmation(page, screenshotsDir, courseType = 'tfl-one-to-one') {
  try {
    console.log('📱 [SMS] Sending SMS confirmation...');
    
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // Determine if we need to work with iframe or main page
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    
    // Find and click "Back" button
    console.log('🔍 [SMS] Looking for Back button...');
    let backButton = null;
    
    const backSelectors = [
      'button:has-text("Back")',
      'button:has-text("BACK")',
      '[role="button"]:has-text(/^back$/i)',
      '.dx-button:has-text(/^back$/i)',
      'a:has-text("Back")',
      'input[type="button"][value*="Back" i]',
      'input[type="submit"][value*="Back" i]'
    ];
    
    // Try main page first
    for (const selector of backSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [SMS] Found Back button using selector: "${selector}"`);
            backButton = button;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Try iframe if not found on main page
    if (!backButton && eventBookingIframeExists) {
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      for (const selector of backSelectors) {
        try {
          const button = iframe.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [SMS] Found Back button in iframe using selector: "${selector}"`);
              backButton = button;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!backButton) {
      throw new Error('Could not find Back button');
    }
    
    // Click Back button
    console.log('🖱️ [SMS] Clicking Back button...');
    await backButton.click();
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'back-clicked-sms.png', screenshotsDir);
    
    // Find and click "Send SMS" button
    console.log('🔍 [SMS] Looking for "Send SMS" button...');
    let sendSMSButton = null;
    
    const sendSMSSelectors = [
      'button:has-text("Send SMS")',
      'button:has-text("SEND SMS")',
      'button:has-text("Send SMS")',
      '[role="button"]:has-text(/send.*sms/i)',
      '.dx-button:has-text(/send.*sms/i)',
      'a:has-text("Send SMS")',
      'a:has-text("SEND SMS")'
    ];
    
    // Try main page first
    for (const selector of sendSMSSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [SMS] Found Send SMS button using selector: "${selector}"`);
            sendSMSButton = button;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Try iframe if not found on main page
    if (!sendSMSButton && eventBookingIframeExists) {
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      for (const selector of sendSMSSelectors) {
        try {
          const button = iframe.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [SMS] Found Send SMS button in iframe using selector: "${selector}"`);
              sendSMSButton = button;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!sendSMSButton) {
      throw new Error('Could not find "Send SMS" button');
    }
    
    // Click Send SMS button
    console.log('🖱️ [SMS] Clicking "Send SMS" button...');
    await sendSMSButton.click();
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'sms-page-loaded.png', screenshotsDir);
    
    // Determine preset template name based on course type
    let presetTemplateName = '';
    if (courseType === 'tfl-one-to-one') {
      presetTemplateName = 'TfL - 1-2-1 Motorcycle Skills Booking Confirmation – WITH TRAINING SITE ADDRESS';
    } else if (courseType === 'tfl-beyond-cbt') {
      presetTemplateName = 'TfL – Beyond CBT Booking Confirmation';
    } else if (courseType === 'full-licence') {
      presetTemplateName = 'DAS/A2/A1/ERS/Full Licence Assessment SMS Booking Confirmation';
    } else if (courseType === 'itm' || courseType === 'gear-conversion' || courseType === 'private-lesson') {
      presetTemplateName = 'ITM / Gear Conversion / Private Motorcycling SMS Booking Confirmation';
    } else if (courseType === 'cbt' || courseType === 'cbt-executive') {
      // CBT courses may have their own SMS template, using ITM template as fallback
      presetTemplateName = 'ITM / Gear Conversion / Private Motorcycling SMS Booking Confirmation';
    } else {
      presetTemplateName = 'TfL - 1-2-1 Motorcycle Skills Booking Confirmation – WITH TRAINING SITE ADDRESS'; // Default
    }
    
    console.log(`🔍 [SMS] Looking for preset template: "${presetTemplateName}"`);
    
    // Find preset dropdown - try multiple selectors
    let presetDropdown = null;
    let searchContext = page;
    
    if (eventBookingIframeExists) {
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    }
    
    const presetDropdownSelectors = [
      'select[name*="preset"]',
      'select[name*="Preset"]',
      'select[id*="preset"]',
      '[data-onchange*="preset"]',
      '.dx-dropdowneditor:has-text("preset")',
      'select:has(option:has-text("preset"))',
      'label:has-text("preset") + select',
      'label:has-text("Preset") + select',
      'label:has-text("Choose a preset") + select'
    ];
    
    for (const selector of presetDropdownSelectors) {
      try {
        const dropdown = searchContext.locator(selector).first();
        if (await dropdown.count() > 0) {
          const isVisible = await dropdown.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [SMS] Found preset dropdown using selector: "${selector}"`);
            presetDropdown = dropdown;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // If not found, try DevExtreme dropdown pattern
    if (!presetDropdown) {
      const dxDropdown = searchContext.locator('.dx-dropdowneditor, [role="combobox"]').first();
      if (await dxDropdown.count() > 0) {
        const isVisible = await dxDropdown.isVisible().catch(() => false);
        if (isVisible) {
          console.log('✅ [SMS] Found preset dropdown using DevExtreme pattern');
          presetDropdown = dxDropdown;
        }
      }
    }
    
    if (!presetDropdown) {
      throw new Error('Could not find preset dropdown');
    }
    
    // Click dropdown to open
    console.log('🖱️ [SMS] Clicking preset dropdown to open...');
    const dropdownButton = presetDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
    if (await dropdownButton.count() > 0) {
      await dropdownButton.click();
    } else {
      await presetDropdown.click();
    }
    
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'preset-dropdown-opened.png', screenshotsDir);
    
    // Find preset option in dropdown
    const presetOptions = searchContext.locator('div.dx-list-item[role="option"]');
    const presetOptionCount = await presetOptions.count();
    console.log(`📊 [SMS] Found ${presetOptionCount} preset options in dropdown`);
    
    let matchingPresetOption = null;
    
    for (let i = 0; i < presetOptionCount; i++) {
      const option = presetOptions.nth(i);
      const optionText = await option.locator('.dx-item-content.dx-list-item-content').textContent();
      const optionTextTrimmed = optionText ? optionText.trim() : '';
      
      console.log(`   Preset Option ${i + 1}: "${optionTextTrimmed}"`);
      
      // Check if option text matches or contains preset template name (partial match for long names)
      if (optionTextTrimmed.includes(presetTemplateName) || 
          presetTemplateName.includes(optionTextTrimmed) ||
          optionTextTrimmed.toLowerCase().includes(presetTemplateName.toLowerCase().substring(0, 20))) {
        console.log(`✅ [SMS] Found matching preset option: "${optionTextTrimmed}"`);
        matchingPresetOption = option;
        break;
      }
    }
    
    if (!matchingPresetOption) {
      throw new Error(`Could not find preset template: "${presetTemplateName}"`);
    }
    
    // Check if visible, scroll if needed
    const isPresetVisible = await matchingPresetOption.isVisible();
    if (!isPresetVisible) {
      console.log('🔍 [SMS] Preset option not visible, scrolling...');
      await page.keyboard.press('Home');
      await page.waitForTimeout(1000);
    }
    
    // Click preset option
    await matchingPresetOption.waitFor({ state: 'visible', timeout: 5000 });
    console.log('🖱️ [SMS] Clicking preset option...');
    await matchingPresetOption.click();
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'preset-selected.png', screenshotsDir);
    
    // Find course dropdown - "(optional) Choose a course"
    console.log('🔍 [SMS] Looking for course dropdown...');
    let courseDropdown = null;
    
    const courseDropdownSelectors = [
      'select[name*="course"]',
      'select[name*="Course"]',
      'select[id*="course"]',
      '[data-onchange*="course"]',
      '.dx-dropdowneditor:has-text("course")',
      'label:has-text("course") + select',
      'label:has-text("Course") + select',
      'label:has-text("Choose a course") + select'
    ];
    
    for (const selector of courseDropdownSelectors) {
      try {
        const dropdown = searchContext.locator(selector).first();
        if (await dropdown.count() > 0) {
          const isVisible = await dropdown.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [SMS] Found course dropdown using selector: "${selector}"`);
            courseDropdown = dropdown;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // If not found, try DevExtreme dropdown pattern
    if (!courseDropdown) {
      const dxDropdowns = searchContext.locator('.dx-dropdowneditor, [role="combobox"]');
      const dxCount = await dxDropdowns.count();
      // Try the second dropdown (first is preset, second should be course)
      if (dxCount > 1) {
        courseDropdown = dxDropdowns.nth(1);
        console.log('✅ [SMS] Found course dropdown as second DevExtreme dropdown');
      }
    }
    
    if (courseDropdown) {
      // Click course dropdown to open
      console.log('🖱️ [SMS] Clicking course dropdown to open...');
      const courseDropdownButton = courseDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
      if (await courseDropdownButton.count() > 0) {
        await courseDropdownButton.click();
      } else {
        await courseDropdown.click();
      }
      
      await page.waitForTimeout(2000);
      
      // Select first course option (should be the most recent booking)
      const courseOptions = searchContext.locator('div.dx-list-item[role="option"]');
      const courseOptionCount = await courseOptions.count();
      
      if (courseOptionCount > 0) {
        console.log(`📊 [SMS] Found ${courseOptionCount} course options, selecting first one (most recent booking)...`);
        const firstCourseOption = courseOptions.first();
        await firstCourseOption.click();
        await page.waitForTimeout(1000);
      } else {
        console.log('⚠️ [SMS] No course options found, continuing...');
      }
      
      await takeScreenshot(page, 'course-selected.png', screenshotsDir);
    } else {
      console.log('⚠️ [SMS] Course dropdown not found, continuing without course selection...');
    }
    
    // Find and click "Send the message" button
    console.log('🔍 [SMS] Looking for "Send the message" button...');
    let sendMessageButton = null;
    
    const sendMessageSelectors = [
      'button:has-text("Send the message")',
      'button:has-text("SEND THE MESSAGE")',
      'button:has-text("Send the Message")',
      '[role="button"]:has-text(/send.*message/i)',
      '.dx-button:has-text(/send.*message/i)',
      'input[type="button"][value*="Send the message" i]',
      'input[type="submit"][value*="Send the message" i]'
    ];
    
    for (const selector of sendMessageSelectors) {
      try {
        const button = searchContext.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [SMS] Found Send the message button using selector: "${selector}"`);
            sendMessageButton = button;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!sendMessageButton) {
      throw new Error('Could not find "Send the message" button');
    }
    
    // Click Send the message button
    console.log('🖱️ [SMS] Clicking "Send the message" button...');
    await sendMessageButton.click();
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'sms-sent.png', screenshotsDir);
    console.log('✅ [SMS] SMS confirmation sent successfully');
    
  } catch (error) {
    console.error('❌ [SMS] Error sending SMS confirmation:', error);
    await takeScreenshot(page, 'sms-error.png', screenshotsDir);
    throw new Error(`Failed to send SMS confirmation: ${error.message}`);
  }
}

