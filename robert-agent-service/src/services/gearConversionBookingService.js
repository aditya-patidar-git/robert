import fs from 'fs';
import path from 'path';
import * as commonSteps from './commonBookingSteps/index.js';

class GearConversionBookingService {
  constructor() {
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: 'universalmct',
      username: 'auagent',
      password: 'Robert2025!',
      availabilityUrl: 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C07F8089718288E3'
    };
    this.screenshotsDir = './screenshots/gear-conversion-booking';
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
      console.log('🚀 Starting Gear Conversion booking workflow...');
      console.log('🔍 Service: Current page URL:', page.url());
      console.log('🔍 Service: Page title:', await page.title());

      // STEP 1: Check availability and note details
      console.log('📅 Step 1: Checking Gear Conversion availability...');
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
      console.log('⚙️ Step 8: Selecting Gear Conversion booking options...');
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
      console.error('❌ Gear Conversion booking failed at step:', error.message);
      console.error('❌ Service: Error stack:', error.stack);
      screenshots.push(await commonSteps.takeScreenshot(page, 'error-state.png', this.screenshotsDir));
      throw error;
    }
  }

  // STEP 1: Check availability and note details (Gear Conversion-specific)
  async checkAvailabilityAndNoteDetails(page) {
    try {
      console.log('📅 Navigating to Gear Conversion availability page...');
      
      await page.goto(this.crmCredentials.availabilityUrl);
      await page.waitForLoadState('networkidle');
      
      await commonSteps.takeScreenshot(page, 'availability-page-loaded.png', this.screenshotsDir);
      
      await page.waitForSelector('#availabilityTable', { timeout: 10000 });
      
      const availabilityTable = page.locator('#availabilityTable');
      await availabilityTable.waitFor({ state: 'visible' });
      
      await page.waitForSelector('#availabilityTable tbody tr.availabilityDataRow', { timeout: 10000 });
      
      const lastMonthCell = availabilityTable.locator('td.availabilityMonthCell').last();
      const latestMonthYear = (await lastMonthCell.textContent()).trim();
      
      console.log(`📅 Latest month found: ${latestMonthYear}`);
      
      const allDataRows = availabilityTable.locator('tbody tr.availabilityDataRow');
      const rowCount = await allDataRows.count();
      
      console.log(`📊 Total data rows found: ${rowCount}`);
      
      const lastDataRow = allDataRows.last();
      await lastDataRow.waitFor({ state: 'visible' });
      
      const sessionDetails = {
        date: (await lastDataRow.locator('td').nth(0).textContent()).trim(),
        course: (await lastDataRow.locator('td').nth(1).textContent()).trim(),
        location: (await lastDataRow.locator('td').nth(2).textContent()).trim(),
        time: (await lastDataRow.locator('td').nth(3).textContent()).trim(),
        price: (await lastDataRow.locator('td').nth(4).textContent()).trim(),
        instructor: (await lastDataRow.locator('td').nth(6).textContent()).trim().replace(/^Instructor:\s*/i, ''),
        startDate: await lastDataRow.getAttribute('data-start_date'),
        monthYear: latestMonthYear
      };
      
      console.log('📋 Extracted Gear Conversion session details:', sessionDetails);
      return sessionDetails;
      
    } catch (error) {
      console.error('Error in checkAvailabilityAndNoteDetails:', error);
      throw new Error(`Failed to check Gear Conversion availability: ${error.message}`);
    }
  }

  // STEP 8: Select booking options (Gear Conversion-specific)
  async selectBookingOptions(page, bookingArgs) {
    try {
      console.log('⚙️ [STEP 8] Selecting Gear Conversion booking options...');
      
      await page.waitForTimeout(5000);
      
      const pages = page.context().pages();
      let targetPage = page;
      if (pages.length > 1) {
        for (let i = 0; i < pages.length; i++) {
          const pageTitle = await pages[i].title();
          const pageUrl = pages[i].url();
          if (pageTitle.includes('booking') || pageTitle.includes('Booking') || 
              pageUrl.includes('booking') || pageUrl.includes('Booking')) {
            targetPage = pages[i];
            break;
          }
        }
      }
      
      let searchContext = targetPage;
      let bookingIframe = null;
      
      const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
      if (eventBookingIframeExists) {
        bookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
        searchContext = bookingIframe;
        await targetPage.waitForTimeout(2000);
      }
      
      const priceHeader = searchContext.locator('text=1. Price, *:has-text("1. Price")').first();
      await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      
      await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', this.screenshotsDir);
      
      // Select duration from Booking options (2 hours, 3 hours, or 4 hours)
      console.log('⏱️ [STEP 8] Selecting duration from Booking options...');
      await searchContext.locator('text=/Booking options/i').scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
      
      const duration = bookingArgs.duration || '2'; // '2', '3', or '4' hours
      
      const durationMap = {
        '2': /2 hours/i,
        '3': /3 hours/i,
        '4': /4 hours/i
      };
      
      const durationPattern = durationMap[duration] || durationMap['2'];
      console.log(`✅ [STEP 8] Selecting duration: ${duration} hours`);
      
      // Find and select the duration option
      const durationOption = searchContext.locator(`[role="radio"]:has-text("${durationPattern.source}"), input[type="radio"]`).filter({ hasText: durationPattern }).first();
      
      if (await durationOption.count() === 0) {
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
        await durationOption.check();
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
      
      await page.waitForTimeout(3000);
      
      if (bookingIframe) {
        await page.waitForTimeout(2000);
        const contactLookupIndicators = bookingIframe.locator('text=lookup, text=contact, text=add new contact').first();
        await contactLookupIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      }
      
      console.log('✅ [STEP 8] Gear Conversion booking options selected and Next button clicked');
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      await commonSteps.takeScreenshot(page, 'booking-options-error.png', this.screenshotsDir);
      throw new Error(`Failed to select Gear Conversion booking options: ${error.message}`);
    }
  }
}

export default new GearConversionBookingService();

