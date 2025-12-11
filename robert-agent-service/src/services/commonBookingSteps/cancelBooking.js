import { takeScreenshot } from './utils.js';

/**
 * Cancel an existing booking
 * @param {Page} page - Playwright page object
 * @param {FrameLocator} iframe - Frame locator for the contact details iframe
 * @param {Object} args - Cancel arguments
 * @param {string} args.bookingReference - Booking reference to cancel
 * @param {string} args.reason - Reason for cancellation (optional)
 * @param {Object} existingBooking - Existing booking details from findBooking
 * @param {string} screenshotsDir - Directory to save screenshots
 * @returns {Promise<{success: boolean, result?: object, error?: string}>}
 */
export async function cancelBooking(page, iframe, args, existingBooking, screenshotsDir) {
  try {
    console.log('❌ [CANCEL] Starting cancel booking workflow...');
    console.log(`   Booking Reference: ${args.bookingReference}`);
    console.log(`   Reason: ${args.reason || 'Not provided'}`);
    
    // Step 1: Navigate to Diaries section
    console.log('📅 [CANCEL] Step 1: Navigating to Diaries section...');
    const diariesTab = page.locator('h3.list-menu-item-heading:has-text("Diaries")');
    await diariesTab.click();
    await page.waitForTimeout(8000);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'cancel-diaries-opened.png', screenshotsDir);
    
    // Step 2: Select date of existing booking
    console.log('📅 [CANCEL] Step 2: Selecting date of existing booking...');
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
    
    // Step 3: Select location
    if (existingBooking.location) {
      console.log(`📍 [CANCEL] Step 3: Selecting location: ${existingBooking.location}`);
      
      const locationIdentifier = existingBooking.location.toLowerCase().split(',')[0].trim();
      
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
          console.log(`✅ [CANCEL] Location selected: ${optionText}`);
          break;
        }
      }
    }
    
    await takeScreenshot(page, 'cancel-date-location-selected.png', screenshotsDir);
    
    // Step 4: Find the booking slot with customer's name
    console.log('🔍 [CANCEL] Step 4: Finding booking slot with customer name...');
    
    let searchContext;
    if (diariesIframeExists) {
      searchContext = page.frameLocator('#newDiaryDefault_iframe');
    } else {
      searchContext = page;
    }
    
    const diaryEntries = searchContext.locator('td.diaryEvent.diaryEventCell');
    const entryCount = await diaryEntries.count();
    
    let targetEntry = null;
    const expectedTime = existingBooking.time;
    
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
              console.log(`✅ [CANCEL] Found booking slot at time ${entryTime}`);
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
    console.log('👆 [CANCEL] Step 5: Clicking on customer name to open dropdown...');
    
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
    
    await takeScreenshot(page, 'cancel-dropdown-opened.png', screenshotsDir);
    
    // Step 6: Click "Cancel Booking" button
    console.log('❌ [CANCEL] Step 6: Clicking "Cancel Booking" button...');
    
    // Look for the "Cancel Booking" option in the context menu
    const cancelOption = page.locator('[role="menuitem"]:has-text("Cancel Booking"), [role="menuitem"]:has-text("Cancel"), [role="menuitem"]:has-text("Delete Booking")').first();
    
    if (await cancelOption.count() > 0) {
      await cancelOption.click();
      await page.waitForTimeout(2000);
      console.log('✅ [CANCEL] "Cancel Booking" clicked');
    } else {
      throw new Error('Could not find "Cancel Booking" option in dropdown');
    }
    
    // Step 7: Confirm cancellation (handle any confirmation dialogs)
    console.log('✅ [CANCEL] Step 7: Confirming cancellation...');
    
    // Look for confirmation dialog
    const confirmDialog = page.locator('.dx-popup, .dx-dialog, [role="dialog"]');
    if (await confirmDialog.count() > 0) {
      // Look for confirm/yes button in dialog
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("OK"), button:has-text("Cancel")').first();
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // If there's a reason field, fill it
    if (args.reason) {
      const reasonField = page.locator('input[placeholder*="reason"], textarea[placeholder*="reason"], input[name*="reason"]').first();
      if (await reasonField.count() > 0) {
        await reasonField.fill(args.reason);
        await page.waitForTimeout(1000);
      }
    }
    
    await takeScreenshot(page, 'cancel-confirmed.png', screenshotsDir);
    
    // Step 8: Verify success (check booking removed/marked cancelled)
    console.log('🔍 [CANCEL] Step 8: Verifying cancellation success...');
    
    await page.waitForTimeout(3000);
    
    // Check if booking is no longer visible or marked as cancelled
    const cancelledEntry = searchContext.locator(`td.diaryEvent.diaryEventCell[data-start_time*="${expectedTime}"]`);
    const stillHasBooking = await cancelledEntry.locator('.bookingActive, .staffBooking').count() > 0;
    
    if (!stillHasBooking) {
      console.log('✅ [CANCEL] Cancellation verified - booking removed from slot');
      return {
        success: true,
        result: {
          bookingReference: args.bookingReference,
          cancelledDate: existingBooking.date,
          cancelledTime: existingBooking.time,
          reason: args.reason || 'Customer request'
        }
      };
    } else {
      // Check if it's marked as cancelled
      const isCancelled = await cancelledEntry.locator('.cancelled, [class*="cancel"]').count() > 0;
      if (isCancelled) {
        console.log('✅ [CANCEL] Cancellation verified - booking marked as cancelled');
        return {
          success: true,
          result: {
            bookingReference: args.bookingReference,
            cancelledDate: existingBooking.date,
            cancelledTime: existingBooking.time,
            reason: args.reason || 'Customer request'
          }
        };
      } else {
        throw new Error('Cancellation verification failed - booking still appears active');
      }
    }
    
  } catch (error) {
    console.error('❌ [CANCEL] Error cancelling booking:', error);
    await takeScreenshot(page, 'cancel-error.png', screenshotsDir);
    return {
      success: false,
      error: error.message
    };
  }
}

