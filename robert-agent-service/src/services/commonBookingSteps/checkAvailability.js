import { takeScreenshot } from './utils.js';

/**
 * Course type to availability URL mapping
 */
const AVAILABILITY_URLS = {
  'ITM': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C9170432CA66685F',
  'Introduction to Motorcycling': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C9170432CA66685F',
  'CBT': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=8ABD7DD7AAF3C2C5',
  'Compulsory Basic Training': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=8ABD7DD7AAF3C2C5',
  'CBT Executive': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=06EF66470DC0CDC4',
  'CBT Executive 1-2-1': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=06EF66470DC0CDC4',
  'Private Lesson': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=CFB644AFFB83F5C6',
  'Gear Conversion': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C07F8089718288E3',
  'TfL 1-2-1': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=DDAE018B4D15B60A',
  'TfL 1-2-1 Motorcycle Skills': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=DDAE018B4D15B60A',
  'TfL Beyond CBT': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=4A4B4A440C24B86F',
  'TfL - Beyond CBT - Skills for Delivery Riders': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=4A4B4A440C24B86F',
  'Full Licence Assessment': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=024D486FF2ED0D87',
  'Full Motorcycle Licence Assessment': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=024D486FF2ED0D87'
};

/**
 * Check availability for a specific course type
 * @param {Page} page - Playwright page object
 * @param {string} courseType - Course type (e.g., 'ITM', 'CBT', 'Private Lesson')
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {Object} preferences - Optional preferences for slot matching {preferredDate, preferredTime, location}
 * @returns {Promise<{allSlots: Array, selectedSlot: Object, monthYear: string}>}
 */
export async function checkAvailabilityAndNoteDetails(page, courseType, screenshotsDir, preferences = {}) {
  try {
    // Get availability URL for course type
    const availabilityUrl = AVAILABILITY_URLS[courseType];
    
    if (!availabilityUrl) {
      throw new Error(`No availability URL found for course type: ${courseType}`);
    }
    
    console.log(`📅 [AVAILABILITY] Checking availability for ${courseType}...`);
    console.log(`📅 Navigating to availability page: ${availabilityUrl}`);
    
    // Navigate to public availability page
    await page.goto(availabilityUrl);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of availability page
    await takeScreenshot(page, `availability-${courseType.toLowerCase().replace(/\s+/g, '-')}-loaded.png`, screenshotsDir);
    
    // Wait for the availability table to be visible
    await page.waitForSelector('#availabilityTable', { timeout: 10000 });
    
    // Find the availability table by ID
    const availabilityTable = page.locator('#availabilityTable');
    await availabilityTable.waitFor({ state: 'visible' });
    
    // Wait for table to be populated with data rows
    await page.waitForSelector('#availabilityTable tbody tr.availabilityDataRow', { timeout: 10000 });
    
    // Get the LAST month cell (latest month)
    const lastMonthCell = availabilityTable.locator('td.availabilityMonthCell').last();
    const latestMonthYear = (await lastMonthCell.textContent()).trim();
    
    console.log(`📅 Latest month found: ${latestMonthYear}`);
    
    // Get all data rows
    const allDataRows = availabilityTable.locator('tbody tr.availabilityDataRow');
    const rowCount = await allDataRows.count();
    
    console.log(`📊 Total data rows found: ${rowCount}`);
    
    if (rowCount === 0) {
      throw new Error('No availability entries found');
    }
    
    // Extract ALL available slots (limit to next 50 slots for performance)
    const maxSlots = Math.min(rowCount, 50);
    const allSlots = [];
    
    for (let i = 0; i < maxSlots; i++) {
      const dataRow = allDataRows.nth(i);
      await dataRow.waitFor({ state: 'visible' }).catch(() => null);
      
      try {
        // Extract details from columns based on actual table structure
        // Column order: 0=date, 1=course, 2=location, 3=time, 4=price, 5=spaces button, 6=instructor
        const slot = {
          date: (await dataRow.locator('td').nth(0).textContent()).trim(),
          course: (await dataRow.locator('td').nth(1).textContent()).trim(),
          location: (await dataRow.locator('td').nth(2).textContent()).trim(),
          time: (await dataRow.locator('td').nth(3).textContent()).trim(),
          price: (await dataRow.locator('td').nth(4).textContent()).trim(),
          instructor: (await dataRow.locator('td').nth(6).textContent()).trim().replace(/^Instructor:\s*/i, ''),
          // Extract precise date from data attribute for calendar selection
          startDate: await dataRow.getAttribute('data-start_date'),
          // Use the latest month/year we extracted
          monthYear: latestMonthYear,
          // Store row index for later selection
          rowIndex: i
        };
        
        // Only add slots with valid data
        if (slot.date && slot.time) {
          allSlots.push(slot);
        }
      } catch (rowError) {
        console.warn(`⚠️ [AVAILABILITY] Error extracting slot ${i}:`, rowError.message);
        // Continue with next slot
      }
    }
    
    console.log(`📋 [AVAILABILITY] Extracted ${allSlots.length} available slots for ${courseType}`);
    
    if (allSlots.length === 0) {
      throw new Error('No valid availability slots found');
    }
    
    // Select the best matching slot based on preferences
    const selectedSlot = selectBestMatchingSlot(allSlots, preferences);
    
    console.log(`✅ [AVAILABILITY] Selected slot based on preferences:`, selectedSlot);
    console.log(`   Date: ${selectedSlot.date}, Time: ${selectedSlot.time}, Location: ${selectedSlot.location}`);
    
    return {
      allSlots: allSlots,
      selectedSlot: selectedSlot,
      monthYear: latestMonthYear
    };
    
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error checking availability for ${courseType}:`, error);
    throw new Error(`Failed to check availability for ${courseType}: ${error.message}`);
  }
}

/**
 * Select the best matching slot based on caller preferences
 * @param {Array} allSlots - Array of available slots
 * @param {Object} preferences - Caller preferences {preferredDate, preferredTime, location}
 * @returns {Object} - Best matching slot
 */
export function selectBestMatchingSlot(allSlots, preferences = {}) {
  if (!allSlots || allSlots.length === 0) {
    throw new Error('No slots available to select from');
  }
  
  const { preferredDate, preferredTime, location } = preferences;
  
  // If no preferences provided, return the first available slot (earliest)
  if (!preferredDate && !preferredTime && !location) {
    console.log('📋 No preferences provided, selecting first available slot');
    return allSlots[0];
  }
  
  // Score each slot based on how well it matches preferences
  const scoredSlots = allSlots.map(slot => {
    let score = 0;
    let matchDetails = [];
    
    // Match date preference (exact or partial)
    if (preferredDate) {
      const slotDateStr = slot.startDate || slot.date;
      const preferredDateStr = normalizeDate(preferredDate);
      
      if (slotDateStr && preferredDateStr) {
        // Try exact match first
        if (slotDateStr === preferredDateStr || slotDateStr.includes(preferredDateStr) || preferredDateStr.includes(slotDateStr)) {
          score += 10;
          matchDetails.push('date');
        } else {
          // Check if dates are close (within 7 days)
          const daysDiff = getDaysDifference(slotDateStr, preferredDateStr);
          if (daysDiff !== null && daysDiff <= 7) {
            score += Math.max(0, 10 - daysDiff); // Closer dates get higher score
            matchDetails.push(`date-close-${daysDiff}days`);
          }
        }
      }
    }
    
    // Match time preference
    if (preferredTime) {
      const slotTime = normalizeTime(slot.time);
      const preferredTimeNorm = normalizeTime(preferredTime);
      
      if (slotTime && preferredTimeNorm) {
        if (slotTime === preferredTimeNorm) {
          score += 8;
          matchDetails.push('time-exact');
        } else {
          // Check if times are close (within 2 hours)
          const timeDiff = getTimeDifference(slotTime, preferredTimeNorm);
          if (timeDiff !== null && timeDiff <= 120) { // 120 minutes = 2 hours
            score += Math.max(0, 8 - (timeDiff / 15)); // Closer times get higher score
            matchDetails.push(`time-close-${timeDiff}min`);
          }
        }
      }
    }
    
    // Match location preference
    if (location) {
      const slotLocation = normalizeLocation(slot.location);
      const preferredLocation = normalizeLocation(location);
      
      if (slotLocation && preferredLocation) {
        if (slotLocation === preferredLocation || slotLocation.includes(preferredLocation) || preferredLocation.includes(slotLocation)) {
          score += 6;
          matchDetails.push('location');
        }
      }
    }
    
    return {
      slot,
      score,
      matchDetails
    };
  });
  
  // Sort by score (highest first), then by date/time (earliest first)
  scoredSlots.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // If scores are equal, prefer earlier dates/times
    const aDate = a.slot.startDate || a.slot.date;
    const bDate = b.slot.startDate || b.slot.date;
    if (aDate && bDate) {
      return new Date(aDate) - new Date(bDate);
    }
    return 0;
  });
  
  const bestMatch = scoredSlots[0];
  
  if (bestMatch.score > 0) {
    console.log(`✅ Found matching slot with score ${bestMatch.score} (matches: ${bestMatch.matchDetails.join(', ')})`);
  } else {
    console.log(`⚠️ No matching slot found based on preferences, using first available slot`);
  }
  
  return bestMatch.slot;
}

/**
 * Normalize date string for comparison
 * @param {string} dateStr - Date string in various formats
 * @returns {string} - Normalized date string (YYYY-MM-DD format if possible)
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  // Try to parse and format as YYYY-MM-DD
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Continue with string matching
  }
  
  // Return lowercase for case-insensitive matching
  return dateStr.toLowerCase().trim();
}

/**
 * Normalize time string for comparison
 * @param {string} timeStr - Time string (e.g., "09:00", "9:00 AM", "17:00")
 * @returns {string} - Normalized time string (HH:MM format)
 */
function normalizeTime(timeStr) {
  if (!timeStr) return null;
  
  // Remove common time suffixes and whitespace
  let normalized = timeStr.toLowerCase().trim();
  normalized = normalized.replace(/\s*(am|pm)\s*/gi, '');
  
  // Try to parse as time
  try {
    // Handle formats like "9:00", "09:00", "17:00"
    const parts = normalized.split(':');
    if (parts.length === 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (!isNaN(hours) && !isNaN(minutes)) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }
  } catch (e) {
    // Continue with original string
  }
  
  return normalized;
}

/**
 * Normalize location string for comparison
 * @param {string} locationStr - Location string
 * @returns {string} - Normalized location string
 */
function normalizeLocation(locationStr) {
  if (!locationStr) return null;
  
  // Convert to lowercase and remove common variations
  let normalized = locationStr.toLowerCase().trim();
  
  // Remove common suffixes like "HA0 4LR", postcodes, etc.
  normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ''); // Remove text in parentheses
  normalized = normalized.replace(/\s*[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}\s*/gi, ''); // Remove UK postcodes
  
  return normalized.trim();
}

/**
 * Get difference in days between two date strings
 * @param {string} dateStr1 - First date string
 * @param {string} dateStr2 - Second date string
 * @returns {number|null} - Days difference, or null if cannot calculate
 */
function getDaysDifference(dateStr1, dateStr2) {
  try {
    const date1 = new Date(dateStr1);
    const date2 = new Date(dateStr2);
    
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return null;
    }
    
    const diffMs = Math.abs(date1 - date2);
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch (e) {
    return null;
  }
}

/**
 * Get difference in minutes between two time strings
 * @param {string} timeStr1 - First time string (HH:MM format)
 * @param {string} timeStr2 - Second time string (HH:MM format)
 * @returns {number|null} - Minutes difference, or null if cannot calculate
 */
function getTimeDifference(timeStr1, timeStr2) {
  try {
    const [h1, m1] = timeStr1.split(':').map(Number);
    const [h2, m2] = timeStr2.split(':').map(Number);
    
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) {
      return null;
    }
    
    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;
    
    return Math.abs(minutes1 - minutes2);
  } catch (e) {
    return null;
  }
}

/**
 * Get availability URL for a course type
 * @param {string} courseType - Course type
 * @returns {string|null} Availability URL or null if not found
 */
export function getAvailabilityUrl(courseType) {
  return AVAILABILITY_URLS[courseType] || null;
}

