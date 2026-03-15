import { takeScreenshot, waitForThenOptionalDelay, CRM_STABILITY_DELAY_MS } from './utils.js';

/**
 * Find existing bookings for a customer by navigating to their profile
 * @param {Page} page - Playwright page object
 * @param {FrameLocator} iframe - Frame locator for the contact details iframe (from findAndVerifyClient)
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} bookingReference - Optional booking reference to filter by
 * @returns {Promise<{found: boolean, bookings?: Array<{bookingReference: string, date: string, time: string, courseType: string, status: string, location: string}>, error?: string}>}
 */
export async function findBooking(page, iframe, screenshotsDir, bookingReference = null) {
  try {
    console.log('🔍 [FIND BOOKING] Looking for bookings in customer profile...');
    
    // Look for bookings section/tab in customer profile
    // Common patterns: "Bookings" tab, "History" tab, or bookings list in the profile
    
    // Approach 1: Look for a "Bookings" or "History" tab/button
    const bookingsTab = iframe.locator('text=/Bookings|History|Booking History/i, button:has-text("Bookings"), a:has-text("Bookings")').first();
    const hasBookingsTab = await bookingsTab.count() > 0;
    
    if (hasBookingsTab) {
      console.log('✅ [FIND BOOKING] Found Bookings tab, clicking...');
      await bookingsTab.click();
      await waitForThenOptionalDelay(page, iframe.locator('table, .bookings-list, .booking-history, [class*="booking"]').first(), { state: 'visible', timeout: 5000, delayMs: CRM_STABILITY_DELAY_MS }).catch(() => {});
      await takeScreenshot(page, 'bookings-tab-opened.png', screenshotsDir);
    } else {
      console.log('⚠️ [FIND BOOKING] No Bookings tab found, checking for inline bookings list...');
    }
    
    // Approach 2: Look for bookings list directly in the profile (may be visible without tab click)
    // Bookings are often displayed in a table or grid
    const bookingsTable = iframe.locator('table, .bookings-list, .booking-history, [class*="booking"]').first();
    const hasBookingsTable = await bookingsTable.count() > 0;
    
    if (!hasBookingsTable && !hasBookingsTab) {
      console.log('⚠️ [FIND BOOKING] No bookings section found in customer profile');
      return {
        found: false,
        error: 'No bookings section found in customer profile. The customer may not have any bookings yet.'
      };
    }
    
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);
    await takeScreenshot(page, 'bookings-section-loaded.png', screenshotsDir);
    
    // Extract bookings from the table/list
    // Try multiple selectors for booking rows
    const bookingRowSelectors = [
      'tr[class*="booking"]',
      'tr[data-booking-id]',
      '.booking-row',
      'tbody tr',
      'table tr:not(:first-child)' // Exclude header row
    ];
    
    let bookingRows = null;
    for (const selector of bookingRowSelectors) {
      const rows = iframe.locator(selector);
      const count = await rows.count();
      if (count > 0) {
        console.log(`✅ [FIND BOOKING] Found ${count} booking rows using selector: ${selector}`);
        bookingRows = rows;
        break;
      }
    }
    
    if (!bookingRows || (await bookingRows.count()) === 0) {
      console.log('⚠️ [FIND BOOKING] No booking rows found');
      return {
        found: false,
        error: 'No bookings found for this customer'
      };
    }
    
    const rowCount = await bookingRows.count();
    const bookings = [];
    
    console.log(`📋 [FIND BOOKING] Extracting booking details from ${rowCount} rows...`);
    
    for (let i = 0; i < rowCount; i++) {
      const row = bookingRows.nth(i);
      
      try {
        // Extract booking details from row
        // Common fields: booking reference, date, time, course type, status, location
        const rowText = await row.textContent();
        
        // Try to extract booking reference (alphanumeric code like "BK-2025-ABC123")
        const bookingRefMatch = rowText.match(/\b([A-Z]{2,3}[-]?\d{4}[-]?[A-Z0-9]{3,})\b/i);
        const bookingRef = bookingRefMatch ? bookingRefMatch[1] : null;
        
        // Try to extract date (DD/MM/YYYY or similar)
        const dateMatch = rowText.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
        const date = dateMatch ? dateMatch[1] : null;
        
        // Try to extract time (HH:MM format)
        const timeMatch = rowText.match(/\b(\d{1,2}:\d{2})\b/);
        const time = timeMatch ? timeMatch[1] : null;
        
        // Try to extract course type (common course names)
        const courseTypes = ['ITM', 'CBT', 'Private Lesson', 'Gear Conversion', 'TfL', 'Full Licence'];
        let courseType = null;
        for (const course of courseTypes) {
          if (rowText.includes(course)) {
            courseType = course;
            break;
          }
        }
        
        // Try to extract status (confirmed, cancelled, completed, etc.)
        const statusMatch = rowText.match(/\b(confirmed|cancelled|completed|pending|active)\b/i);
        const status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';
        
        // Try to extract location (common locations)
        const locations = ['Alperton', 'Croydon', 'Edgware', 'Eltham', 'Wimbledon', 'Dagenham', 'Hoddesdon'];
        let location = null;
        for (const loc of locations) {
          if (rowText.includes(loc)) {
            location = loc;
            break;
          }
        }
        
        // Only add booking if we have at least a booking reference or date
        if (bookingRef || date) {
          bookings.push({
            bookingReference: bookingRef || `BOOKING-${i + 1}`,
            date: date || 'Not specified',
            time: time || 'Not specified',
            courseType: courseType || 'Not specified',
            status: status,
            location: location || 'Not specified'
          });
          
          console.log(`   Booking ${i + 1}: Ref=${bookingRef || 'N/A'}, Date=${date || 'N/A'}, Course=${courseType || 'N/A'}, Status=${status}`);
        }
      } catch (e) {
        console.log(`⚠️ [FIND BOOKING] Error extracting booking ${i + 1}: ${e.message}`);
        continue;
      }
    }
    
    if (bookings.length === 0) {
      console.log('⚠️ [FIND BOOKING] No valid bookings extracted');
      return {
        found: false,
        error: 'Could not extract booking details from customer profile'
      };
    }
    
    // Filter by booking reference if provided
    let filteredBookings = bookings;
    if (bookingReference) {
      filteredBookings = bookings.filter(b => 
        b.bookingReference && 
        b.bookingReference.toLowerCase().includes(bookingReference.toLowerCase())
      );
      
      if (filteredBookings.length === 0) {
        console.log(`⚠️ [FIND BOOKING] No bookings found matching reference: ${bookingReference}`);
        return {
          found: false,
          error: `No bookings found matching reference: ${bookingReference}`,
          allBookings: bookings
        };
      }
      
      console.log(`✅ [FIND BOOKING] Found ${filteredBookings.length} booking(s) matching reference: ${bookingReference}`);
    } else {
      console.log(`✅ [FIND BOOKING] Found ${bookings.length} booking(s) for customer`);
    }
    
    return {
      found: true,
      bookings: filteredBookings
    };
    
  } catch (error) {
    console.error('❌ [FIND BOOKING] Error finding bookings:', error);
    await takeScreenshot(page, 'find-booking-error.png', screenshotsDir);
    return {
      found: false,
      error: error.message
    };
  }
}

