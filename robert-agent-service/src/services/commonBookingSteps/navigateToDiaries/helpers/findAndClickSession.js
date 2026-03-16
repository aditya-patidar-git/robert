import { takeScreenshot, waitForThenOptionalDelay, CRM_STABILITY_DELAY_MS } from '../../utils.js';

/**
 * Helper function to extract time from data-start_time attribute.
 * @param {string} dateTimeString - DateTime string in format "2026-02-24T17:00:00".
 * @returns {string|null} Extracted time in format "17:00" or null if invalid.
 */
function extractTimeFromAttribute(dateTimeString) {
  if (!dateTimeString) return null;
  // Format: "2026-02-24T17:00:00" -> extract "17:00"
  const match = dateTimeString.match(/T(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return null;
}

/**
 * Helper function to normalize course name for matching (remove price variations).
 * @param {string} courseName - Course name to normalize.
 * @returns {string} Normalized course name.
 */
function normalizeCourseName(courseName) {
  if (!courseName) return '';
  // Remove price patterns like "£125", "- £125", etc.
  return courseName.replace(/\s*-?\s*£[\d,]+\.?\d*/g, '').trim().toLowerCase();
}

/**
 * Helper function to normalize instructor name for matching.
 * @param {string} instructorName - Instructor name to normalize.
 * @returns {string} Normalized instructor name.
 */
function normalizeInstructorName(instructorName) {
  if (!instructorName) return '';
  // Remove common prefixes and normalize
  return instructorName.replace(/^(Mr|Mrs|Ms|Dr|Prof)\s+/i, '').trim().toLowerCase();
}

/**
 * Finds and matches a booking entry based on course, instructor, and time criteria.
 * @param {import('playwright').Page} page - Playwright page object.
 * @param {Object} sessionDetails - Session details containing course, instructor, and time.
 * @param {string} sessionDetails.course - Course name to match.
 * @param {string} sessionDetails.instructor - Instructor name to match (can be "TBD" or empty).
 * @param {string} sessionDetails.time - Session time to match (can be "TBD" or empty).
 * @param {string} screenshotsDir - Directory to save screenshots.
 * @returns {Promise<import('playwright').Locator>} The matching diary entry locator.
 * @throws {Error} If no matching entry is found.
 */
export async function findMatchingSession(page, sessionDetails, screenshotsDir) {
  // Find and match booking entry with criteria from Step 1
  console.log(`🎯 [STEP 6-7] Looking for matching booking entry...`);
  console.log(`📋 Matching criteria:`);
  console.log(`   Course: "${sessionDetails.course}"`);
  console.log(`   Instructor: "${sessionDetails.instructor}"`);
  console.log(`   Time: "${sessionDetails.time}"`);
  
  // Determine context (iframe or main page)
  const diariesIframeExists = await page.locator('#newDiaryDefault_iframe').count() > 0;
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
      
      // Match criteria - make flexible when values are "TBD" or empty
      const timeMatches = expectedTime === 'TBD' || expectedTime === '' || extractedTime === expectedTime;
      const courseMatches = courseNormalized === expectedCourseNormalized || 
                           courseNormalized.includes(expectedCourseNormalized) ||
                           expectedCourseNormalized.includes(courseNormalized);
      // If instructor is "TBD" or empty, match any instructor
      const instructorMatches = expectedInstructorNormalized === 'tbd' || expectedInstructorNormalized === '' ||
                               instructorNormalized === expectedInstructorNormalized ||
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
  
  return matchingEntry;
}

/**
 * Clicks on the matching session entry and selects "New Booking" from the context menu.
 * @param {import('playwright').Page} page - Playwright page object.
 * @param {import('playwright').Locator} matchingEntry - The matching diary entry locator.
 * @param {string} screenshotsDir - Directory to save screenshots.
 * @returns {Promise<void>}
 * @throws {Error} If clicking the entry or selecting "New Booking" fails.
 */
export async function clickSessionAndSelectNewBooking(page, matchingEntry, screenshotsDir) {
  // Click on the matching entry (normal click)
  console.log('🖱️ [STEP 6-7] Clicking on matching entry...');
  
  // CRITICAL FIX: Click on the course name (eventTitle) instead of the entire td
  // This ensures we get the course context menu with "New Booking" instead of staff booking menu
  const eventTitle = matchingEntry.locator('div.eventTitle.jqx_hlink').first();
  if (await eventTitle.count() > 0) {
    console.log('✅ [STEP 6-7] Found eventTitle, clicking on course name...');
    await eventTitle.click();
  } else {
    // Fallback: click on the entry itself if eventTitle not found
    console.log('⚠️ [STEP 6-7] eventTitle not found, clicking on entry itself...');
    await matchingEntry.click();
  }
  
  // Wait for context menu to appear (condition-based instead of fixed 2s + 1.5s)
  console.log('⏳ [STEP 6-7] Waiting for context menu to appear...');
  try {
    await waitForThenOptionalDelay(page, '.dx-context-menu[role="menu"], [role="menu"].dx-menu-base', { state: 'visible', timeout: 5000, delayMs: CRM_STABILITY_DELAY_MS });
  } catch (e) {
    console.log('⚠️ [STEP 6-7] Context menu visibility check timed out, continuing...');
  }

  await takeScreenshot(page, 'session-clicked.png', screenshotsDir);

  console.log('📝 [STEP 6-7] Looking for "New Booking" in context menu...');
  
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
  const diariesIframeExists = await page.locator('#newDiaryDefault_iframe').count() > 0;
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

    // Wait for booking form iframe (condition-based instead of fixed 4s)
    console.log('🔍 [STEP 6-7] Waiting for booking form iframe to appear...');
    try {
      await waitForThenOptionalDelay(page, '#eventNewBooking2_iframe', { state: 'attached', timeout: 10000, delayMs: CRM_STABILITY_DELAY_MS });
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
}
