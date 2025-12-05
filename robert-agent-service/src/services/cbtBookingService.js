import fs from 'fs';
import path from 'path';
import * as commonSteps from './commonBookingSteps/index.js';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';

class CBTBookingService {
  constructor() {
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: 'universalmct',
      username: 'auagent',
      password: 'Robert2025!',
      availabilityUrl: 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=8ABD7DD7AAF3C2C5'
    };
    this.screenshotsDir = './screenshots/cbt-booking';
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  async executeBookingWorkflow(page, bookingArgs, callContext = {}) {
    const screenshots = [];
    let sessionDetails = null;

    try {
      console.log('🚀 Starting CBT booking workflow...');
      console.log('🔍 Service: Current page URL:', page.url());
      console.log('🔍 Service: Page title:', await page.title());

      // STEP 1: Check availability and note details
      console.log('📅 Step 1: Checking CBT availability...');
      sessionDetails = await this.checkAvailabilityAndNoteDetails(page);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-1-availability.png', this.screenshotsDir));
      console.log('✅ Step 1 completed:', sessionDetails);

      // STEP 2: Login to CRM
      console.log('🔐 Step 2: Logging into CRM...');
      await commonSteps.loginToCRM(page, this.crmCredentials, this.screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-login-success.png', this.screenshotsDir));
      console.log('✅ Step 2 completed: Login successful');

      // STEP 3-5: Find and verify existing client
      console.log('👤 Step 3-5: Finding and verifying client...');
      const clientEmail = bookingArgs.customerEmail || process.env.CLIENT_EMAIL_ADDRESS;
      console.log('🔍 Service: Using client email:', clientEmail);
      await commonSteps.findAndVerifyClient(page, clientEmail, this.screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-3-5-client-found.png', this.screenshotsDir));
      console.log('✅ Step 3-5 completed: Client verified');

      // STEP 6-7: Navigate to Diaries and select session
      console.log('📅 Step 6-7: Navigating to Diaries and selecting session...');
      await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-7-session-selected.png', this.screenshotsDir));
      console.log('✅ Step 6-7 completed: Session selected');

      // STEP 8: Select booking options
      console.log('⚙️ Step 8: Selecting CBT booking options...');
      await this.selectBookingOptions(page, bookingArgs);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-options-selected.png', this.screenshotsDir));
      console.log('✅ Step 8 completed: Booking options selected');

      // STEP 9: Lookup contact and wait
      console.log('🔍 Step 9: Looking up contact and waiting...');
      await commonSteps.lookupContactAndWait(page, clientEmail, this.screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-9-final-contact-page.png', this.screenshotsDir));
      console.log('✅ Step 9 completed: Contact lookup done, waiting 10 seconds...');

      console.log('🎉 Service: All steps completed successfully!');
      return {
        success: true,
        sessionDetails,
        screenshots,
        clientEmail
      };

    } catch (error) {
      console.error('❌ CBT booking failed at step:', error.message);
      console.error('❌ Service: Error stack:', error.stack);
      screenshots.push(await commonSteps.takeScreenshot(page, 'error-state.png', this.screenshotsDir));
      
      // Return error gracefully with user-friendly message
      const errorContext = getErrorContext(error, 'create_booking');
      const userFriendlyError = formatUserFriendlyError(error, errorContext);
      
      return {
        success: false,
        error: userFriendlyError,
        technicalError: error.message, // Keep technical error for logging
        sessionDetails: sessionDetails,
        screenshots: screenshots,
        clientEmail: bookingArgs.customerEmail || process.env.CLIENT_EMAIL_ADDRESS
      };
    }
  }

  // STEP 1: Check availability and note details (CBT-specific)
  async checkAvailabilityAndNoteDetails(page) {
    try {
      console.log('📅 Navigating to CBT availability page...');
      
      // Navigate to public availability page
      await page.goto(this.crmCredentials.availabilityUrl);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of availability page
      await commonSteps.takeScreenshot(page, 'availability-page-loaded.png', this.screenshotsDir);
      
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
      
      // Get the LAST data row (most recent entry from latest month)
      const lastDataRow = allDataRows.last();
      await lastDataRow.waitFor({ state: 'visible' });
      
      // Extract details from columns based on actual table structure
      // Column order: 0=date, 1=course, 2=location, 3=time, 4=price, 5=spaces button, 6=instructor
      const sessionDetails = {
        date: (await lastDataRow.locator('td').nth(0).textContent()).trim(),
        course: (await lastDataRow.locator('td').nth(1).textContent()).trim(),
        location: (await lastDataRow.locator('td').nth(2).textContent()).trim(),
        time: (await lastDataRow.locator('td').nth(3).textContent()).trim(),
        price: (await lastDataRow.locator('td').nth(4).textContent()).trim(),
        instructor: (await lastDataRow.locator('td').nth(6).textContent()).trim().replace(/^Instructor:\s*/i, ''),
        // Extract precise date from data attribute for calendar selection
        startDate: await lastDataRow.getAttribute('data-start_date'),
        // Use the latest month/year we extracted
        monthYear: latestMonthYear
      };
      
      console.log('📋 Extracted CBT session details:', sessionDetails);
      return sessionDetails;
      
    } catch (error) {
      console.error('Error in checkAvailabilityAndNoteDetails:', error);
      throw new Error(`Failed to check CBT availability: ${error.message}`);
    }
  }

  // STEP 8: Select booking options (CBT-specific)
  async selectBookingOptions(page, bookingArgs) {
    try {
      console.log('⚙️ [STEP 8] Selecting CBT booking options...');
      
      // WAIT FOR PRICE PAGE TO LOAD - 5 seconds
      console.log('⏳ [STEP 8] Waiting for price page to load...');
      await page.waitForTimeout(5000);
      
      // Check for popup windows first
      const pages = page.context().pages();
      let targetPage = page;
      if (pages.length > 1) {
        console.log(`🔍 [STEP 8] Found ${pages.length} pages, checking for booking popup...`);
        for (let i = 0; i < pages.length; i++) {
          const pageTitle = await pages[i].title();
          const pageUrl = pages[i].url();
          if (pageTitle.includes('booking') || pageTitle.includes('Booking') || 
              pageUrl.includes('booking') || pageUrl.includes('Booking')) {
            targetPage = pages[i];
            console.log(`✅ [STEP 8] Using popup window for booking form`);
            break;
          }
        }
      }
      
      // Determine if booking form is in an iframe, popup, or on main page
      let searchContext = targetPage;
      let bookingIframe = null;
      
      // Check within eventNewBooking2_iframe (the actual booking form iframe)
      const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
      if (eventBookingIframeExists) {
        bookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
        searchContext = bookingIframe;
        
        // Wait for iframe to load
        await targetPage.waitForTimeout(2000);
      }
      
      // Wait for "1. Price" header
      console.log('🔍 [STEP 8] Looking for "1. Price" header...');
      const priceHeader = searchContext.locator('text=1. Price, *:has-text("1. Price")').first();
      await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
        console.log('⚠️ [STEP 8] Price header visibility check timed out, continuing...');
      });
      
      await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', this.screenshotsDir);
      
      // STEP 1: Select CBT course type (Standard or Renewal)
      console.log('📋 [STEP 8] Selecting CBT course type...');
      await searchContext.locator('text=/CBT course type/i').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      
      // Default to CBT Standard if not specified in bookingArgs
      const cbtType = bookingArgs.cbtType || 'standard'; // 'standard' or 'renewal'
      
      if (cbtType.toLowerCase() === 'renewal') {
        console.log('✅ [STEP 8] Selecting CBT Renewal');
        const renewalRadio = searchContext.locator('[role="radio"]:has-text("CBT Renewal"), input[type="radio"][value*="Renewal"]').first();
        await renewalRadio.check();
      } else {
        console.log('✅ [STEP 8] Selecting CBT Standard');
        const standardRadio = searchContext.locator('[role="radio"]:has-text("CBT Standard"), input[type="radio"][value*="Standard"]').first();
        await standardRadio.check();
      }
      
      await page.waitForTimeout(1000);
      
      // STEP 2: Select bike type from Booking options
      console.log('🚲 [STEP 8] Selecting bike type from Booking options...');
      await searchContext.locator('text=/Booking options/i').scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
      
      // Default to first available option if not specified
      const bikeType = bookingArgs.bikeType || '125cc automatic'; // '125cc automatic', '50cc automatic', '125cc manual'
      
      const bikeTypeMap = {
        '125cc automatic': /125cc automatic.*scooter/i,
        '50cc automatic': /50cc automatic/i,
        '125cc manual': /125cc manual.*geared/i
      };
      
      const bikePattern = bikeTypeMap[bikeType] || bikeTypeMap['125cc automatic'];
      console.log(`✅ [STEP 8] Selecting bike type: ${bikeType}`);
      
      // Find and select the bike type option
      const bikeOption = searchContext.locator(`[role="radio"]:has-text("${bikePattern.source}"), input[type="radio"]`).filter({ hasText: bikePattern }).first();
      
      if (await bikeOption.count() === 0) {
        // Fallback: try selecting first available option
        const firstOption = searchContext.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable').first();
        if (await firstOption.count() > 0) {
          const checkDiv = firstOption.locator('.jqx_inputBookingOptionsSelect_check').first();
          if (await checkDiv.count() > 0) {
            await checkDiv.click();
          } else {
            await firstOption.click();
          }
        }
      } else {
        await bikeOption.check();
      }
      
      await page.waitForTimeout(1000);
      
      // Click NEXT button
      console.log('➡️ [STEP 8] Clicking NEXT...');
      let nextButton = searchContext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
      
      if (await nextButton.count() === 0) {
        nextButton = searchContext.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
      }
      
      if (await nextButton.count() === 0) {
        throw new Error('Next button not found on booking options page');
      }
      
      await nextButton.waitFor({ state: 'visible', timeout: 5000 });
      await nextButton.click();
      
      // WAIT FOR NEXT PAGE TO LOAD
      console.log('⏳ [STEP 8] Waiting for next page to load...');
      await page.waitForTimeout(3000);
      
      if (bookingIframe) {
        await page.waitForTimeout(2000);
        const contactLookupIndicators = bookingIframe.locator('text=lookup, text=contact, text=add new contact').first();
        await contactLookupIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
          console.log('⚠️ [STEP 8] Contact lookup page indicators not found, but continuing...');
        });
      }
      
      console.log('✅ [STEP 8] CBT booking options selected and Next button clicked');
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      await commonSteps.takeScreenshot(page, 'booking-options-error.png', this.screenshotsDir);
      throw new Error(`Failed to select CBT booking options: ${error.message}`);
    }
  }
}

export default new CBTBookingService();

