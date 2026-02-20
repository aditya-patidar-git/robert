import { navigateToDiariesTab } from './helpers/navigateToDiariesTab.js';
import { selectDate } from './helpers/selectDate.js';
import { selectLocation } from './helpers/selectLocation.js';
import { selectCalendarType } from './helpers/selectCalendarType.js';
import { findMatchingSession, clickSessionAndSelectNewBooking } from './helpers/findAndClickSession.js';
import { takeScreenshot } from '../utils.js';

/**
 * Steps 6-7: Navigate to Diaries and select session
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} sessionDetails - Session details from Step 1
 * @param {string} sessionDetails.startDate - Start date in ISO format
 * @param {string} sessionDetails.course - Course name
 * @param {string} sessionDetails.instructor - Instructor name
 * @param {string} sessionDetails.time - Session time
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} diaryType - Optional diary type: 'TfL Diary' for TfL courses, undefined/default for standard 'Day planner'
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 */
export async function navigateToDiariesAndSelectSession(page, sessionDetails, screenshotsDir, diaryType = undefined, progressCallback = null) {
  try {
    // Phase 1: Navigate to Diaries tab and wait for page load
    progressCallback?.({ message: 'Opening the diary.' });
    await navigateToDiariesTab(page, screenshotsDir);
    
    // Phase 2: Select date from calendar
    progressCallback?.({ message: 'Selecting the date.' });
    await selectDate(page, sessionDetails, screenshotsDir);
    
    // Phase 3: Select location from dropdown
    progressCallback?.({ message: 'Selecting the location.' });
    await selectLocation(page, sessionDetails, screenshotsDir);
    
    // Phase 4: Select calendar type from dropdown
    progressCallback?.({ message: 'Loading the calendar.' });
    await selectCalendarType(page, diaryType, screenshotsDir);
    
    // Phase 5: Find matching session entry
    progressCallback?.({ message: 'Finding your session.' });
    const matchingEntry = await findMatchingSession(page, sessionDetails, screenshotsDir);
    
    // Phase 6: Click entry and select "New Booking"
    progressCallback?.({ message: 'Selecting your session.' });
    await clickSessionAndSelectNewBooking(page, matchingEntry, screenshotsDir);
    
  } catch (error) {
    console.error('Error in navigateToDiariesAndSelectSession:', error);
    await takeScreenshot(page, 'session-selection-error.png', screenshotsDir);
    throw new Error(`Failed to select session: ${error.message}`);
  }
}
