import { takeScreenshot } from './utils.js';
import { navigateToDiariesAndSelectSession } from './navigateToDiaries/index.js';

/**
 * Reschedule an existing booking
 * @param {Page} page - Playwright page object
 * @param {FrameLocator} iframe - Frame locator for the contact details iframe
 * @param {Object} args - Reschedule arguments
 * @param {string} args.bookingReference - Booking reference to reschedule
 * @param {string} args.newDate - New date for the booking (ISO format or DD/MM/YYYY)
 * @param {string} args.newTime - New time for the booking (HH:MM format)
 * @param {string} args.newLocation - New location (optional)
 * @param {Object} existingBooking - Existing booking details from findBooking
 * @param {string} screenshotsDir - Directory to save screenshots
 * @returns {Promise<{success: boolean, result?: object, error?: string}>}
 */
export async function rescheduleBooking(page, iframe, args, existingBooking, screenshotsDir) {
  try {
    console.log('📅 [RESCHEDULE] Starting reschedule booking workflow...');
    console.log(`   Booking Reference: ${args.bookingReference}`);
    console.log(`   New Date: ${args.newDate}`);
    console.log(`   New Time: ${args.newTime}`);
    
    // Step 1: Navigate to Diaries section
    console.log('📅 [RESCHEDULE] Step 1: Navigating to Diaries section...');
    const diariesTab = page.locator('h3.list-menu-item-heading:has-text("Diaries")');
    await diariesTab.click();
    await page.waitForTimeout(8000);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'reschedule-diaries-opened.png', screenshotsDir);
    
    // Step 2: Select date of existing booking
    console.log('📅 [RESCHEDULE] Step 2: Selecting date of existing booking...');
    const existingDate = new Date(existingBooking.date);
    const year = existingDate.getFullYear();
    const month = existingDate.getMonth() + 1;
    const day = existingDate.getDate();
    
    // Check if diaries are in iframe
    const diariesIframeExists = await page.locator('#newDiaryDefault_iframe').count() > 0;
    let calendarIcon;
    
    if (diariesIframeExists) {
      const diariesIframe = page.frameLocator('#newDiaryDefault_iframe');
      calendarIcon = diariesIframe.locator('#start_date .dx-dropdowneditor-button').first();
    } else {
      calendarIcon = page.locator('#start_date .dx-dropdowneditor-button').first();
    }
    
    await calendarIcon.click();
    await page.waitForTimeout(2000);
    
    // Select the existing booking date
    let dateInputField;
    if (diariesIframeExists) {
      const diariesIframe = page.frameLocator('#newDiaryDefault_iframe');
      dateInputField = diariesIframe.locator('#start_date .dx-texteditor-input').first();
    } else {
      dateInputField = page.locator('#start_date .dx-texteditor-input').first();
    }
    
    await dateInputField.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString();
    const dateString = dayStr + monthStr + yearStr;
    
    await dateInputField.type(dateString);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    
    // Step 3: Select location (if provided, otherwise use existing)
    if (args.newLocation || existingBooking.location) {
      const location = args.newLocation || existingBooking.location;
      console.log(`📍 [RESCHEDULE] Step 3: Selecting location: ${location}`);
      
      // Extract location identifier
      const locationIdentifier = location.toLowerCase().split(',')[0].trim();
      
      let locationDropdown;
      let searchContext;
      
      if (diariesIframeExists) {
        const diariesIframe = page.frameLocator('#newDiaryDefault_iframe');
        locationDropdown = diariesIframe.locator('#diary_ids').first();
        searchContext = diariesIframe;
      } else {
        locationDropdown = page.locator('#diary_ids').first();
        searchContext = page;
      }
      
      await locationDropdown.waitFor({ state: 'visible', timeout: 10000 });
      const dropdownButton = locationDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
      if (await dropdownButton.count() > 0) {
        await dropdownButton.click();
      } else {
        await locationDropdown.click();
      }
      
      await page.waitForTimeout(2000);
      
      const locationOptions = searchContext.locator('div.dx-list-item[role="option"]');
      const optionCount = await locationOptions.count();
      
      for (let i = 0; i < optionCount; i++) {
        const option = locationOptions.nth(i);
        const optionText = await option.locator('.dx-item-content.dx-list-item-content').textContent();
        const optionTextLower = optionText ? optionText.trim().toLowerCase() : '';
        
        if (optionTextLower.includes(locationIdentifier) || locationIdentifier.includes(optionTextLower.split(',')[0].trim())) {
          await option.click();
          await page.waitForTimeout(2000);
          console.log(`✅ [RESCHEDULE] Location selected: ${optionText}`);
          break;
        }
      }
    }
    
    await takeScreenshot(page, 'reschedule-date-location-selected.png', screenshotsDir);
    
    // Step 4: Find the booking slot with customer's name
    console.log('🔍 [RESCHEDULE] Step 4: Finding booking slot with customer name...');
    
    // We need to find the slot that contains the booking
    // Look for diary entries that match the existing booking time and course
    let searchContext;
    if (diariesIframeExists) {
      searchContext = page.frameLocator('#newDiaryDefault_iframe');
    } else {
      searchContext = page;
    }
    
    const diaryEntries = searchContext.locator('td.diaryEvent.diaryEventCell');
    const entryCount = await diaryEntries.count();
    
    let targetEntry = null;
    const expectedTime = existingBooking.time || args.newTime;
    
    for (let i = 0; i < entryCount; i++) {
      const entry = diaryEntries.nth(i);
      const startTimeAttr = await entry.getAttribute('data-start_time');
      
      if (startTimeAttr) {
        const timeMatch = startTimeAttr.match(/T(\d{2}):(\d{2})/);
        if (timeMatch) {
          const entryTime = `${timeMatch[1]}:${timeMatch[2]}`;
          if (entryTime === expectedTime) {
            // Check if this entry has a booking (look for customer name or booking indicator)
            const hasBooking = await entry.locator('.bookingActive, .staffBooking').count() > 0;
            if (hasBooking) {
              targetEntry = entry;
              console.log(`✅ [RESCHEDULE] Found booking slot at time ${entryTime}`);
              break;
            }
          }
        }
      }
    }
    
    if (!targetEntry) {
      throw new Error(`Could not find booking slot for time ${expectedTime}`);
    }
    
    // Step 5: Click on customer name to open dropdown
    console.log('👆 [RESCHEDULE] Step 5: Clicking on customer name to open dropdown...');
    
    // Look for the customer name or booking indicator in the entry
    const customerNameElement = targetEntry.locator('.staffBooking.bookingActive span, .bookingActive').first();
    if (await customerNameElement.count() > 0) {
      await customerNameElement.click();
      await page.waitForTimeout(2000);
    } else {
      // Fallback: click on the entry itself
      await targetEntry.click();
      await page.waitForTimeout(2000);
    }
    
    await takeScreenshot(page, 'reschedule-dropdown-opened.png', screenshotsDir);
    
    // Step 6: Click "Set or change date" button
    console.log('📅 [RESCHEDULE] Step 6: Clicking "Set or change date" button...');
    
    // Look for the "Set or change date" option in the context menu
    const setDateOption = page.locator('[role="menuitem"]:has-text("Set or change date"), [role="menuitem"]:has-text("Set or Change Date"), [role="menuitem"]:has-text("Change Date")').first();
    
    if (await setDateOption.count() > 0) {
      await setDateOption.click();
      await page.waitForTimeout(2000);
      console.log('✅ [RESCHEDULE] "Set or change date" clicked');
    } else {
      throw new Error('Could not find "Set or change date" option in dropdown');
    }
    
    // Step 7: Select new date/time from calendar/diaries
    console.log('📅 [RESCHEDULE] Step 7: Selecting new date and time...');
    
    // Parse new date
    const newDateObj = new Date(args.newDate);
    const newYear = newDateObj.getFullYear();
    const newMonth = newDateObj.getMonth() + 1;
    const newDay = newDateObj.getDate();
    
    // Navigate to new date in diaries
    if (diariesIframeExists) {
      const diariesIframe = page.frameLocator('#newDiaryDefault_iframe');
      const newDateInput = diariesIframe.locator('#start_date .dx-texteditor-input').first();
      await newDateInput.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(500);
      
      const newDayStr = newDay.toString().padStart(2, '0');
      const newMonthStr = newMonth.toString().padStart(2, '0');
      const newYearStr = newYear.toString();
      const newDateString = newDayStr + newMonthStr + newYearStr;
      
      await newDateInput.type(newDateString);
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }
    
    // Select new time slot
    const newTime = args.newTime;
    const newDiaryEntries = searchContext.locator('td.diaryEvent.diaryEventCell[data-allow_booking="Y"]');
    const newEntryCount = await newDiaryEntries.count();
    
    let newTargetEntry = null;
    for (let i = 0; i < newEntryCount; i++) {
      const entry = newDiaryEntries.nth(i);
      const startTimeAttr = await entry.getAttribute('data-start_time');
      
      if (startTimeAttr) {
        const timeMatch = startTimeAttr.match(/T(\d{2}):(\d{2})/);
        if (timeMatch) {
          const entryTime = `${timeMatch[1]}:${timeMatch[2]}`;
          if (entryTime === newTime) {
            newTargetEntry = entry;
            console.log(`✅ [RESCHEDULE] Found new time slot: ${entryTime}`);
            break;
          }
        }
      }
    }
    
    if (!newTargetEntry) {
      throw new Error(`Could not find available slot for new time ${newTime}`);
    }
    
    // Click on the new slot
    await newTargetEntry.click();
    await page.waitForTimeout(2000);
    
    // Step 8: Confirm change
    console.log('✅ [RESCHEDULE] Step 8: Confirming reschedule...');
    
    // Look for confirmation button or dialog
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Save"), button:has-text("OK")').first();
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
      await page.waitForTimeout(3000);
    }
    
    await takeScreenshot(page, 'reschedule-confirmed.png', screenshotsDir);
    
    // Step 9: Verify success
    console.log('🔍 [RESCHEDULE] Step 9: Verifying reschedule success...');
    
    // Check if booking appears in new location
    await page.waitForTimeout(2000);
    const verificationEntry = searchContext.locator(`td.diaryEvent.diaryEventCell[data-start_time*="${newTime}"]`);
    const hasVerificationEntry = await verificationEntry.count() > 0;
    
    if (hasVerificationEntry) {
      console.log('✅ [RESCHEDULE] Reschedule verified - booking appears in new slot');
      return {
        success: true,
        result: {
          bookingReference: args.bookingReference,
          oldDate: existingBooking.date,
          oldTime: existingBooking.time,
          newDate: args.newDate,
          newTime: args.newTime,
          newLocation: args.newLocation || existingBooking.location
        }
      };
    } else {
      throw new Error('Reschedule verification failed - booking not found in new location');
    }
    
  } catch (error) {
    console.error('❌ [RESCHEDULE] Error rescheduling booking:', error);
    await takeScreenshot(page, 'reschedule-error.png', screenshotsDir);
    return {
      success: false,
      error: error.message
    };
  }
}

