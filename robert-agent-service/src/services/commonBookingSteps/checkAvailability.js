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
 * @returns {Promise<{date: string, course: string, location: string, time: string, price: string, instructor: string, startDate: string, monthYear: string}>}
 */
export async function checkAvailabilityAndNoteDetails(page, courseType, screenshotsDir) {
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
    
    // Get the SECOND-TO-LAST data row (for consistency with ITM implementation)
    // This ensures we get a recent but not the absolute latest entry
    const targetRowIndex = rowCount >= 2 ? rowCount - 2 : 0;
    const targetDataRow = allDataRows.nth(targetRowIndex);
    await targetDataRow.waitFor({ state: 'visible' });
    
    // Extract details from columns based on actual table structure
    // Column order: 0=date, 1=course, 2=location, 3=time, 4=price, 5=spaces button, 6=instructor
    const sessionDetails = {
      date: (await targetDataRow.locator('td').nth(0).textContent()).trim(),
      course: (await targetDataRow.locator('td').nth(1).textContent()).trim(),
      location: (await targetDataRow.locator('td').nth(2).textContent()).trim(),
      time: (await targetDataRow.locator('td').nth(3).textContent()).trim(),
      price: (await targetDataRow.locator('td').nth(4).textContent()).trim(),
      instructor: (await targetDataRow.locator('td').nth(6).textContent()).trim().replace(/^Instructor:\s*/i, ''),
      // Extract precise date from data attribute for calendar selection
      startDate: await targetDataRow.getAttribute('data-start_date'),
      // Use the latest month/year we extracted
      monthYear: latestMonthYear
    };
    
    console.log(`📋 [AVAILABILITY] Extracted session details for ${courseType}:`, sessionDetails);
    return sessionDetails;
    
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error checking availability for ${courseType}:`, error);
    throw new Error(`Failed to check availability for ${courseType}: ${error.message}`);
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

