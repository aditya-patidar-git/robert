import { takeScreenshot, extractLocationIdentifier } from './utils.js';

/**
 * Steps 6-7: Navigate to Diaries and select session
 * @param {Page} page - Playwright page object
 * @param {Object} sessionDetails - Session details from Step 1
 * @param {string} sessionDetails.startDate - Start date in ISO format
 * @param {string} sessionDetails.course - Course name
 * @param {string} sessionDetails.instructor - Instructor name
 * @param {string} sessionDetails.time - Session time
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function navigateToDiariesAndSelectSession(page, sessionDetails, screenshotsDir) {
  try {
    console.log('📅 [STEP 6-7] Navigating to Diaries tab...');
    
    // WAIT FOR PAGE TO BE READY - 3 seconds
    console.log('⏳ [STEP 6-7] Waiting for page to be ready...');
    await page.waitForTimeout(3000);
    
    // Debug: Check what's actually on the page
    console.log('🔍 Debug: Checking page URL and title...');
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`Current URL: ${currentUrl}`);
    console.log(`Page Title: ${pageTitle}`);
    
    // Click Diaries tab using the same approach as Contacts tab
    console.log('🔍 [STEP 6-7] Looking for Diaries tab...');
    
    // Approach 1: Look for the specific Diaries tab using the same selector as Contacts
    let diariesTab = null;
    let found = false;
    
    try {
      diariesTab = page.locator('h3.list-menu-item-heading:has-text("Diaries")');
      const isVisible = await diariesTab.isVisible();
      console.log(`Diaries tab found, visible: ${isVisible}`);
      if (isVisible) {
        found = true;
        console.log('✅ Found visible Diaries tab');
      }
    } catch (e) {
      console.log('❌ Diaries tab not found with h3 selector, trying alternatives...');
    }
    
    // Approach 2: Look for any element with "Diaries" text
    if (!found) {
      console.log('🔍 Looking for any Diaries element...');
      try {
        diariesTab = page.locator('a:has-text("Diaries"), button:has-text("Diaries"), [href*="diary"], text=Diaries').first();
        const isVisible = await diariesTab.isVisible();
        console.log(`Alternative Diaries element found, visible: ${isVisible}`);
        if (isVisible) {
          found = true;
          console.log('✅ Found alternative Diaries element');
        }
      } catch (e) {
        console.log('❌ Alternative Diaries element not found');
      }
    }
    
    if (!found || !diariesTab) {
      throw new Error('Could not find any visible Diaries tab element on the page');
    }
    
    console.log('✅ Found Diaries tab, clicking...');
    await diariesTab.click();
    
    // WAIT FOR DIARIES PAGE TO FULLY LOAD - 8 seconds (increased)
    console.log('⏳ [STEP 6-7] Waiting for Diaries page to fully load...');
    await page.waitForTimeout(8000);
    
    // Check if page is already loaded instead of waiting for networkidle
    console.log('🔍 [STEP 6-7] Checking if Diaries page is already loaded...');
    
    // Check for the presence of the date input field - this is the key indicator
    const dateInputExists = await page.locator('#start_date').count() > 0;
    
    if (dateInputExists) {
      console.log('✅ [STEP 6-7] Diaries page is already loaded - found #start_date element');
    } else {
      console.log('🔍 [STEP 6-7] Date input not found on main page, checking for iframe...');
      
      // Check if Diaries content is loaded in an iframe (similar to Contacts page)
      const diariesIframeExists = await page.locator('#newDiaryDefault_iframe').count() > 0;
      
      if (diariesIframeExists) {
        console.log('🔍 [STEP 6-7] Found Diaries iframe, checking if content is inside...');
        
        // Wait for iframe to load completely
        await page.waitForTimeout(3000);
        
        // Wait for the iframe content to be ready
        await page.waitForFunction(() => {
          const iframe = document.querySelector('#newDiaryDefault_iframe');
          return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
        }, { timeout: 15000 });
        
        console.log('✅ Diaries iframe loaded, checking for content inside iframe...');
        
        // Check for date input inside the specific Diaries iframe
        const iframe = page.frameLocator('#newDiaryDefault_iframe');
        const dateInputInIframe = await iframe.locator('#start_date').count() > 0;
        
        if (dateInputInIframe) {
          console.log('✅ [STEP 6-7] Diaries page loaded in iframe - found #start_date element');
        } else {
          console.log('⏳ [STEP 6-7] Date input not found in iframe, waiting for networkidle...');
          await page.waitForLoadState('networkidle', { timeout: 10000 });
        }
      } else {
        console.log('⏳ [STEP 6-7] No iframe found, waiting for networkidle...');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      }
    }
    
    // Take screenshot of diaries page
    await takeScreenshot(page, 'diaries-page-loaded.png', screenshotsDir);
    
    // Select date using the precise calendar interaction pattern
    console.log(`📅 Selecting date from ${sessionDetails.startDate}...`);
    
    // Parse the startDate (format: "2026-02-18T00:00:00")
    const dateObj = new Date(sessionDetails.startDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1; // JavaScript months are 0-based
    const day = dateObj.getDate();
    
    console.log(`📅 Parsed date: Year=${year}, Month=${month}, Day=${day}`);
    
    // Determine if we need to work with iframe or main page
    const diariesIframeExists = await page.locator('#newDiaryDefault_iframe').count() > 0;
    let calendarIcon;
    
    if (diariesIframeExists) {
      console.log('🔍 [STEP 6-7] Working with Diaries iframe for calendar interaction...');
      const iframe = page.frameLocator('#newDiaryDefault_iframe');
      calendarIcon = iframe.locator('#start_date .dx-dropdowneditor-button, #start_date .dx-dropdowneditor-overlay').first();
    } else {
      console.log('🔍 [STEP 6-7] Working with main page for calendar interaction...');
      calendarIcon = page.locator('#start_date .dx-dropdowneditor-button, #start_date .dx-dropdowneditor-overlay').first();
    }
    
    // Click on the calendar icon next to the date input field (id="start_date")
    console.log('📅 Clicking calendar icon to open date picker...');
    await calendarIcon.click();
    
    // Wait for calendar popup to appear
    console.log('⏳ Waiting for calendar popup to appear...');
    await page.waitForTimeout(2000);
    
    // Take screenshot of calendar popup
    await takeScreenshot(page, 'calendar-popup-opened.png', screenshotsDir);
    
    // Click on the date input field to get cursor focus
    console.log('📅 Clicking date input field to get cursor focus...');
    let dateInputField;
    
    if (diariesIframeExists) {
      const iframe = page.frameLocator('#newDiaryDefault_iframe');
      dateInputField = iframe.locator('#start_date .dx-texteditor-input').first();
    } else {
      dateInputField = page.locator('#start_date .dx-texteditor-input').first();
    }
    
    await dateInputField.click();
    await page.waitForTimeout(500);
    
    // Press backspace twice to clear the current date field
    console.log('📅 Clearing current date field...');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    
    // Format date as DDMMYYYY (e.g., "18022026" for 18/02/2026)
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString();
    const dateString = dayStr + monthStr + yearStr;
    
    console.log(`📅 Typing date: ${dateString} (${dayStr}/${monthStr}/${yearStr})`);
    
    // Type the date digits sequentially
    await dateInputField.type(dateString);
    await page.waitForTimeout(1000);
    
    // Press Enter to confirm the date and close the calendar dialog
    console.log('📅 Pressing Enter to confirm date and close calendar dialog...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Wait for page to update after date selection
    await page.waitForTimeout(3000);
    
    // Take screenshot after date selection
    await takeScreenshot(page, 'date-selected.png', screenshotsDir);
    
    // Select location from dropdown (after date selection)
    console.log(`📍 [STEP 6-7] Selecting location from dropdown...`);
    console.log(`📋 Location from Step 1: "${sessionDetails.location}"`);
    
    // Extract location identifier for matching
    const locationIdentifier = extractLocationIdentifier(sessionDetails.location);
    
    if (!locationIdentifier) {
      console.log(`⚠️ [STEP 6-7] Could not extract location identifier from "${sessionDetails.location}", skipping location selection`);
    } else {
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
    
    // Find and match booking entry with criteria from Step 1
    console.log(`🎯 [STEP 6-7] Looking for matching booking entry...`);
    console.log(`📋 Matching criteria:`);
    console.log(`   Course: "${sessionDetails.course}"`);
    console.log(`   Instructor: "${sessionDetails.instructor}"`);
    console.log(`   Time: "${sessionDetails.time}"`);
    
    // Determine context (iframe or main page)
    let searchContext;
    if (diariesIframeExists) {
      searchContext = page.frameLocator('#newDiaryDefault_iframe');
      console.log('🔍 [STEP 6-7] Searching for diary entries in iframe...');
    } else {
      searchContext = page;
      console.log('🔍 [STEP 6-7] Searching for diary entries on main page...');
    }
    
    // Find all diary entry cells that allow booking
    const diaryEntries = searchContext.locator('td.diaryEvent.diaryEventCell[data-allow_booking="Y"]');
    const entryCount = await diaryEntries.count();
    
    console.log(`📊 Found ${entryCount} diary entries with booking allowed`);
    
    if (entryCount === 0) {
      throw new Error('No diary entries found with booking allowed (data-allow_booking="Y")');
    }
    
    // Helper function to extract time from data-start_time attribute
    const extractTimeFromAttribute = (dateTimeString) => {
      if (!dateTimeString) return null;
      // Format: "2026-02-24T17:00:00" -> extract "17:00"
      const match = dateTimeString.match(/T(\d{2}):(\d{2})/);
      if (match) {
        return `${match[1]}:${match[2]}`;
      }
      return null;
    };
    
    // Helper function to normalize course name for matching (remove price variations)
    const normalizeCourseName = (courseName) => {
      if (!courseName) return '';
      // Remove price patterns like "£125", "- £125", etc.
      return courseName.replace(/\s*-?\s*£[\d,]+\.?\d*/g, '').trim().toLowerCase();
    };
    
    // Helper function to normalize instructor name for matching
    const normalizeInstructorName = (instructorName) => {
      if (!instructorName) return '';
      // Remove common prefixes and normalize
      return instructorName.replace(/^(Mr|Mrs|Ms|Dr|Prof)\s+/i, '').trim().toLowerCase();
    };
    
    // Find matching entry
    let matchingEntry = null;
    const expectedCourseNormalized = normalizeCourseName(sessionDetails.course);
    const expectedInstructorNormalized = normalizeInstructorName(sessionDetails.instructor);
    const expectedTime = sessionDetails.time.trim(); // e.g., "17:00"
    
    console.log(`🔍 [STEP 6-7] Searching through entries for match...`);
    
    for (let i = 0; i < entryCount; i++) {
      const entry = diaryEntries.nth(i);
      
      try {
        // Extract time from data-start_time attribute
        const startTimeAttr = await entry.getAttribute('data-start_time');
        const extractedTime = extractTimeFromAttribute(startTimeAttr);
        
        // Extract course name from eventTitle
        // CRITICAL: Skip single-character spans like "V" (vacancy), "X" (full), capacity indicators, and time spans
        // Find the span with the longest meaningful text that contains the actual course name
        let courseName = '';
        
        const eventTitle = entry.locator('div.eventTitle');
        if (await eventTitle.count() > 0) {
          const allSpans = eventTitle.locator('span');
          const spanCount = await allSpans.count();
          
          let candidateSpans = [];
          
          // Collect all potential course name spans
          for (let j = 0; j < spanCount; j++) {
            const spanText = await allSpans.nth(j).textContent();
            const trimmedText = spanText ? spanText.trim() : '';
            
            // Skip empty spans
            if (!trimmedText) continue;
            
            // Skip single-character indicators: "V" (vacancy), "X" (full)
            if (trimmedText.length === 1 && /^[VX]$/i.test(trimmedText)) continue;
            
            // Skip capacity indicators like "(0 Of 2)", "(2 Of 3)", etc.
            if (trimmedText.match(/^\(\d+\s+Of\s+\d+\)$/i)) continue;
            
            // Skip time spans (format like "17:00 - 19:00" or just "17:00")
            if (trimmedText.match(/^\d{2}:\d{2}(\s*-\s*\d{2}:\d{2})?$/)) continue;
            
            // This looks like a course name - add to candidates
            candidateSpans.push({ text: trimmedText, length: trimmedText.length });
          }
          
          // Select the longest candidate (most likely to be the course name)
          if (candidateSpans.length > 0) {
            candidateSpans.sort((a, b) => b.length - a.length); // Sort by length, longest first
            courseName = candidateSpans[0].text;
          }
        }
        
        // Fallback: try diaryEventTime if no course name found in eventTitle
        if (!courseName) {
          const diaryEventTimeSpan = entry.locator('div.diaryEventTime span').first();
          if (await diaryEventTimeSpan.count() > 0) {
            const text = await diaryEventTimeSpan.textContent();
            if (text && text.trim() && text.trim().length > 1) {
              courseName = text.trim();
            }
          }
        }
        
        // Extract instructor name from staffBooking
        let instructorName = '';
        const staffBooking = entry.locator('div.staffBooking.bookingActive span').first();
        if (await staffBooking.count() > 0) {
          instructorName = await staffBooking.textContent();
        }
        
        // Check if booking is possible (vacancy indicator)
        const hasVacancy = await entry.locator('div.diaryEventVacancy').count() > 0;
        
        // Normalize for comparison
        const courseNormalized = normalizeCourseName(courseName);
        const instructorNormalized = normalizeInstructorName(instructorName);
        
        console.log(`   Entry ${i + 1}: Course="${courseName}", Instructor="${instructorName}", Time="${extractedTime}", Vacancy=${hasVacancy}`);
        
        // Match criteria
        const timeMatches = extractedTime === expectedTime;
        const courseMatches = courseNormalized === expectedCourseNormalized || 
                             courseNormalized.includes(expectedCourseNormalized) ||
                             expectedCourseNormalized.includes(courseNormalized);
        const instructorMatches = instructorNormalized === expectedInstructorNormalized ||
                                 instructorNormalized.includes(expectedInstructorNormalized) ||
                                 expectedInstructorNormalized.includes(instructorNormalized);
        
        if (timeMatches && courseMatches && instructorMatches) {
          console.log(`✅ [STEP 6-7] Found matching entry at index ${i + 1}!`);
          console.log(`   Matched: Course=${courseMatches}, Instructor=${instructorMatches}, Time=${timeMatches}`);
          matchingEntry = entry;
          break;
        }
      } catch (e) {
        console.log(`⚠️ [STEP 6-7] Error processing entry ${i + 1}: ${e.message}`);
        continue;
      }
    }
    
    if (!matchingEntry) {
      console.log(`❌ [STEP 6-7] No matching entry found!`);
      console.log(`   Expected: Course="${sessionDetails.course}", Instructor="${sessionDetails.instructor}", Time="${sessionDetails.time}"`);
      throw new Error(`Could not find matching diary entry with course="${sessionDetails.course}", instructor="${sessionDetails.instructor}", time="${sessionDetails.time}"`);
    }
    
    // Click on the matching entry (normal click)
    console.log('🖱️ [STEP 6-7] Clicking on matching entry...');
    await matchingEntry.click();
    
    // Wait for popup/dialog to appear
    await page.waitForTimeout(2000);
    
    // Take screenshot after clicking
    await takeScreenshot(page, 'session-clicked.png', screenshotsDir);
    
    // Find and click "New Booking" option in context menu
    console.log('📝 [STEP 6-7] Looking for "New Booking" in context menu...');
    
    // Wait for context menu to appear (DevExtreme context menu)
    console.log('⏳ [STEP 6-7] Waiting for context menu to appear...');
    await page.waitForTimeout(1500);
    
    // Wait for context menu to be visible
    try {
      await page.waitForSelector('.dx-context-menu[role="menu"], [role="menu"].dx-menu-base', { state: 'visible', timeout: 3000 });
    } catch (e) {
      console.log('⚠️ [STEP 6-7] Context menu visibility check timed out, continuing...');
    }
    
    // Context menu is a DevExtreme menu with specific structure
    // Prioritize menu item selectors based on the HTML structure
    let newBookingOption = null;
    
    // Try main page first - context menu often renders on main page even if source is in iframe
    // Selector 1: Menu item with text "New booking" (lowercase as in HTML)
    const menuItemWithText = page.locator('[role="menuitem"]:has-text("New booking"), [role="menuitem"]:has-text("New Booking"), [role="menuitem"]:has-text("NEW BOOKING")');
    if (await menuItemWithText.count() > 0) {
      newBookingOption = menuItemWithText.first();
      await newBookingOption.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    }
    
    // Selector 2: First menu item in context menu (should be "New booking")
    if (!newBookingOption || await newBookingOption.count() === 0) {
      const contextMenu = page.locator('.dx-context-menu[role="menu"], [role="menu"].dx-menu-base').first();
      if (await contextMenu.count() > 0) {
        const firstMenuItem = contextMenu.locator('[role="menuitem"]').first();
        if (await firstMenuItem.count() > 0) {
          // Verify it contains "New booking" text
          const menuText = await firstMenuItem.locator('.dx-menu-item-text').textContent();
          if (menuText && /new booking/i.test(menuText)) {
            newBookingOption = firstMenuItem;
          }
        }
      }
    }
    
    // Selector 3: Using the menu item text class directly
    if (!newBookingOption || await newBookingOption.count() === 0) {
      // Find menu item that contains the text element
      const menuItemContainingText = page.locator('[role="menuitem"]:has(.dx-menu-item-text:has-text("New booking")), [role="menuitem"]:has(.dx-menu-item-text:has-text("New Booking")), [role="menuitem"]:has(.dx-menu-item-text:has-text("NEW BOOKING"))').first();
      if (await menuItemContainingText.count() > 0) {
        newBookingOption = menuItemContainingText;
      }
    }
    
    // Selector 4: Try iframe context
    if ((!newBookingOption || await newBookingOption.count() === 0) && diariesIframeExists) {
      const iframe = page.frameLocator('#newDiaryDefault_iframe');
      const iframeMenuItem = iframe.locator('[role="menuitem"]:has-text("New booking"), [role="menuitem"]:has-text("New Booking"), [role="menuitem"]:has-text("NEW BOOKING")').first();
      if (await iframeMenuItem.count() > 0) {
        newBookingOption = iframeMenuItem;
      }
    }
    
    // Selector 5: Fallback - any button with New Booking text
    if (!newBookingOption || await newBookingOption.count() === 0) {
      const button = page.locator('button:has-text("New booking"), button:has-text("New Booking"), button:has-text("NEW BOOKING")').first();
      if (await button.count() > 0) {
        newBookingOption = button;
      }
    }
    
    if (newBookingOption && await newBookingOption.count() > 0) {
      console.log('✅ [STEP 6-7] Found "New Booking" option, clicking...');
      await newBookingOption.click();
      
      // WAIT FOR BOOKING PAGE TO LOAD - 4 seconds
      console.log('⏳ [STEP 6-7] Waiting for booking page to load...');
      await page.waitForTimeout(4000);
      
      // Wait for the booking form iframe to appear
      console.log('🔍 [STEP 6-7] Waiting for booking form iframe to appear...');
      try {
        await page.waitForSelector('#eventNewBooking2_iframe', { state: 'attached', timeout: 10000 });
        console.log('✅ [STEP 6-7] Booking form iframe appeared');
      } catch (e) {
        console.log('⚠️ [STEP 6-7] Booking form iframe did not appear within timeout, continuing...');
      }
      
      console.log('✅ [STEP 6-7] "New Booking" clicked successfully');
    } else {
      console.log('⚠️ [STEP 6-7] "New Booking" option not found in context menu');
      // Take screenshot for debugging
      await takeScreenshot(page, 'new-booking-not-found.png', screenshotsDir);
      
      // Try to log what menu items are available
      try {
        const contextMenu = page.locator('.dx-context-menu[role="menu"], [role="menu"].dx-menu-base').first();
        if (await contextMenu.count() > 0) {
          const menuItems = contextMenu.locator('[role="menuitem"]');
          const itemCount = await menuItems.count();
          console.log(`📋 Found ${itemCount} menu items in context menu:`);
          for (let i = 0; i < itemCount; i++) {
            const text = await menuItems.nth(i).locator('.dx-menu-item-text').textContent();
            console.log(`   ${i + 1}. "${text}"`);
          }
        }
      } catch (e) {
        console.log(`⚠️ Could not extract menu items: ${e.message}`);
      }
      
      throw new Error('Could not find "New Booking" option in context menu after clicking diary entry');
    }
    
  } catch (error) {
    console.error('Error in navigateToDiariesAndSelectSession:', error);
    await takeScreenshot(page, 'session-selection-error.png', screenshotsDir);
    throw new Error(`Failed to select session: ${error.message}`);
  }
}

