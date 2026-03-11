import { takeScreenshot } from '../../utils.js';

const DDMMYYYY_REGEX = /(\d{2})\/(\d{2})\/(\d{4})/;
/** Matches "12th", "12", "Thu 12th", "Thursday 12th" etc. - captures day-of-month */
const HUMAN_DAY_REGEX = /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})(?:st|nd|rd|th)?/i;

/**
 * Parse human-friendly date strings like "Thu 12th", "Thursday 12th", "12th" to a Date.
 * Uses current month (or next month if day has passed) as reference.
 * @param {string} str - Date string
 * @returns {Date|null} Parsed date or null
 */
function parseHumanFriendlyDate(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const dayMatch = trimmed.match(HUMAN_DAY_REGEX);
  if (!dayMatch) return null;
  const dayNum = parseInt(dayMatch[1], 10);
  if (dayNum < 1 || dayNum > 31) return null;
  const ref = new Date();
  const year = ref.getFullYear();
  const month = ref.getMonth();
  let d = new Date(year, month, dayNum);
  if (d.getTime() < ref.getTime()) {
    d = new Date(year, month + 1, dayNum);
  }
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Selects a date from the calendar date picker.
 * @param {import('playwright').Page} page - Playwright page object.
 * @param {Object} sessionDetails - Session details containing date information.
 * @param {string} sessionDetails.startDate - Start date in ISO format or DD/MM/YYYY format.
 * @param {string} sessionDetails.date - Alternative date field (DD/MM/YYYY or human e.g. "Thu 12th").
 * @param {string} screenshotsDir - Directory to save screenshots.
 * @returns {Promise<void>}
 * @throws {Error} If the date format is invalid or date selection fails.
 */
export async function selectDate(page, sessionDetails, screenshotsDir) {
  // Select date using the precise calendar interaction pattern
  console.log(`📅 Selecting date from startDate="${sessionDetails.startDate}", date="${sessionDetails.date}"...`);

  // Parse the startDate (format: "2026-02-18T00:00:00" or "2026-02-18" or "17/12/2025")
  let dateObj = null;

  if (sessionDetails.startDate) {
    // Try ISO format first
    dateObj = new Date(sessionDetails.startDate);
    if (isNaN(dateObj.getTime())) {
      // If ISO format fails, try DD/MM/YYYY format
      const ddmmyyyyMatch = sessionDetails.startDate.match(DDMMYYYY_REGEX);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        dateObj = new Date(`${year}-${month}-${day}`);
        console.log(`📅 Parsed DD/MM/YYYY format: ${day}/${month}/${year} -> ${year}-${month}-${day}`);
      }
    }
  } else if (sessionDetails.date) {
    // Try DD/MM/YYYY first
    const ddmmyyyyMatch = sessionDetails.date.match(DDMMYYYY_REGEX);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      dateObj = new Date(`${year}-${month}-${day}`);
      console.log(`📅 Parsed DD/MM/YYYY format from date field: ${day}/${month}/${year} -> ${year}-${month}-${day}`);
    } else {
      // Try native Date parse
      dateObj = new Date(sessionDetails.date);
      if (isNaN(dateObj.getTime())) {
        // Fallback: human-friendly e.g. "Thu 12th"
        dateObj = parseHumanFriendlyDate(sessionDetails.date);
        if (dateObj) {
          console.log(`📅 Parsed human-friendly date "${sessionDetails.date}" -> ${dateObj.toISOString().split('T')[0]}`);
        }
      }
    }
  }

  // Validate date before using
  if (!dateObj || isNaN(dateObj.getTime())) {
    const errorMsg = `Invalid date format: startDate="${sessionDetails.startDate}", date="${sessionDetails.date}". Cannot proceed with date selection.`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
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
}
