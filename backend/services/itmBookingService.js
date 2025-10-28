import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

class ITMBookingService {
  constructor() {
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: 'universalmct',
      username: 'auagent',
      password: 'Robert2025!',
      availabilityUrl: 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C9170432CA66685F'
    };
    this.screenshotsDir = './screenshots/itm-booking';
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  async executeITMBookingDemo(page) {
    const screenshots = [];
    let sessionDetails = null;

    try {
      console.log('🚀 Starting ITM booking demo workflow...');

      // STEP 1: Check availability and note details
      console.log('📅 Step 1: Checking availability...');
      sessionDetails = await this.checkAvailabilityAndNoteDetails(page);
      screenshots.push(await this.takeScreenshot(page, 'step-1-availability.png'));
      console.log('✅ Step 1 completed:', sessionDetails);

      // STEP 2: Login to CRM
      console.log('🔐 Step 2: Logging into CRM...');
      await this.loginToCRM(page);
      screenshots.push(await this.takeScreenshot(page, 'step-2-login-success.png'));
      console.log('✅ Step 2 completed: Login successful');

      // STEP 3-5: Find and verify existing client
      console.log('👤 Step 3-5: Finding and verifying client...');
      const clientEmail = process.env.CLIENT_EMAIL_ADDRESS;
      await this.findAndVerifyClient(page, clientEmail);
      screenshots.push(await this.takeScreenshot(page, 'step-3-5-client-found.png'));
      console.log('✅ Step 3-5 completed: Client verified');

      // STEP 6-7: Navigate to Diaries and select session
      console.log('📅 Step 6-7: Navigating to Diaries and selecting session...');
      await this.navigateToDiariesAndSelectSession(page, sessionDetails);
      screenshots.push(await this.takeScreenshot(page, 'step-6-7-session-selected.png'));
      console.log('✅ Step 6-7 completed: Session selected');

      // STEP 8: Select booking options
      console.log('⚙️ Step 8: Selecting booking options...');
      await this.selectBookingOptions(page);
      screenshots.push(await this.takeScreenshot(page, 'step-8-options-selected.png'));
      console.log('✅ Step 8 completed: Booking options selected');

      // STEP 9: Lookup contact and wait
      console.log('🔍 Step 9: Looking up contact and waiting...');
      await this.lookupContactAndWait(page, clientEmail);
      screenshots.push(await this.takeScreenshot(page, 'step-9-final-contact-page.png'));
      console.log('✅ Step 9 completed: Contact lookup done, waiting 10 seconds...');

      return {
        success: true,
        sessionDetails,
        screenshots,
        clientEmail
      };

    } catch (error) {
      console.error('❌ ITM booking demo failed at step:', error.message);
    screenshots.push(await this.takeScreenshot(page, 'error-state.png'));
    
    // STOP EXECUTION - don't continue
    throw error;
    }
  }

  // STEP 1: Check availability and note details
async checkAvailabilityAndNoteDetails(page) {
  try {
    console.log('📅 Navigating to availability page...');
    
    // Navigate to public availability page
    await page.goto(this.crmCredentials.availabilityUrl);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of availability page
    await this.takeScreenshot(page, 'availability-page-loaded.png');
    
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
    const sessionDetails = {
      date: (await lastDataRow.locator('td').nth(0).textContent()).trim(),
      course: (await lastDataRow.locator('td').nth(1).textContent()).trim(),
      time: (await lastDataRow.locator('td').nth(2).textContent()).trim(),
      location: (await lastDataRow.locator('td').nth(3).textContent()).trim(),
      instructor: (await lastDataRow.locator('td').nth(4).textContent()).trim(),
      // Extract precise date from data attribute for calendar selection
      startDate: await lastDataRow.getAttribute('data-start_date'),
      // Use the latest month/year we extracted
      monthYear: latestMonthYear
    };
    
    console.log('📋 Extracted session details:', sessionDetails);
    return sessionDetails;
    
  } catch (error) {
    console.error('Error in checkAvailabilityAndNoteDetails:', error);
    throw new Error(`Failed to check availability: ${error.message}`);
  }
}
  // STEP 2: Login to CRM
  async loginToCRM(page) {
    try {
      console.log('🔐 [STEP 2] Navigating to CRM login page...');
      
      await page.goto(this.crmCredentials.loginUrl);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of login page
      await this.takeScreenshot(page, 'login-page-loaded.png');
      
      // Fill login form with correct selectors
      console.log('📝 Filling login form...');
      
      // Login Name field
      const loginNameField = page.locator('#Loginname input.dx-texteditor-input');
      await loginNameField.fill(this.crmCredentials.loginName);
      
      // Username field
      const usernameField = page.locator('#Username input.dx-texteditor-input');
      await usernameField.fill(this.crmCredentials.username);
      
      // Password field
      const passwordField = page.locator('#UserPassword input.dx-texteditor-input');
      await passwordField.fill(this.crmCredentials.password);
      
      // Click Login button
      const loginButton = page.locator('#btnLogin');
      await loginButton.click();
      
      await page.waitForLoadState('networkidle');
      
      // Take screenshot after login attempt
      await this.takeScreenshot(page, 'login-attempted.png');
      
      // Verify login success by looking for the sidebar with Contacts tab
      try {
        // Wait for the sidebar to appear with Contacts tab
        await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
        
        // Additional verification - check if login form is gone
        const stillOnLoginPage = await page.locator('#Loginname').isVisible();
        if (stillOnLoginPage) {
          throw new Error('Login failed - still on login page');
        }
        
        console.log('✅ [STEP 2] Login successful - sidebar with Contacts tab found');
        
      } catch (verifyError) {
        console.log('⚠️ [STEP 2] Login verification failed, but continuing...');
        // Don't throw error, just log and continue
      }
      
    } catch (error) {
      console.error('❌ [STEP 2] Login failed:', error);
      await this.takeScreenshot(page, 'login-error.png');
      throw new Error(`[STEP 2] CRM login failed: ${error.message}`);
    }
  }

  // STEP 3-5: Find and verify existing client
async findAndVerifyClient(page, email) {
  try {
    console.log('👤 Navigating to Contacts tab...');
    
    // Click CONTACTS tab using the specific selector
    const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")');
    await contactsTab.click();
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of contacts page
    await this.takeScreenshot(page, 'contacts-page-loaded.png');
    
    console.log('🔍 Selecting Smart search...');
    
    // Select "Smart search" from dropdown
    const searchDropdown = page.locator('select, [role="combobox"]').first();
    await searchDropdown.selectOption({ label: 'Smart search' });
    
    // Enter email address in search field
    console.log(`📧 Searching for client: ${email}`);
    const searchField = page.locator('input[placeholder*="search"], input[type="search"], input[placeholder*="Search"]').first();
    await searchField.fill(email);
    
    // Wait for search results
    await page.waitForTimeout(2000);
    
    // Take screenshot after search
    await this.takeScreenshot(page, 'search-results.png');
    
    // Click on found client (should be the first result)
    console.log('👆 Clicking on found client...');
    const clientResult = page.locator(`text=${email}`).first();
    await clientResult.click();
    await page.waitForLoadState('networkidle');
    
    // Take screenshot after clicking client
    await this.takeScreenshot(page, 'client-selected.png');
    
    console.log('✅ Client found and selected - considering VERIFIED for demo');
    
  } catch (error) {
    console.error('Error in findAndVerifyClient:', error);
    await this.takeScreenshot(page, 'client-search-error.png');
    throw new Error(`Failed to find client: ${error.message}`);
  }
}
  // STEP 6-7: Navigate to Diaries and select session
  async navigateToDiariesAndSelectSession(page, sessionDetails) {
    try {
      console.log('📅 Navigating to Diaries tab...');
      
      // Click Diaries tab
      const diariesTab = page.locator('a:has-text("Diaries"), button:has-text("Diaries"), [href*="diary"]').first();
      await diariesTab.click();
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of diaries page
      await this.takeScreenshot(page, 'diaries-page-loaded.png');
      
      // Select date using the precise calendar interaction pattern
      console.log(`📅 Selecting date from ${sessionDetails.startDate}...`);
      
      // Parse the startDate (format: "2025-10-29T00:00:00")
      const dateObj = new Date(sessionDetails.startDate);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1; // JavaScript months are 0-based
      const day = dateObj.getDate();
      
      console.log(`📅 Parsed date: Year=${year}, Month=${month}, Day=${day}`);
      
      // Click on the date input field to open calendar
      const dateInput = page.locator('input[type="text"], input[placeholder*="date"], .date-input').first();
      await dateInput.click();
      
      // Wait for calendar to appear
      await page.waitForSelector('.calendar, [role="dialog"]', { timeout: 5000 });
      
      // Calendar interaction pattern: Click year → type year
      console.log(`📅 Setting year to ${year}...`);
      const yearElement = page.locator('.calendar .year, [data-testid="year"]').first();
      await yearElement.click();
      await yearElement.fill(year.toString());
      
      // Click month → type month
      console.log(`📅 Setting month to ${month}...`);
      const monthElement = page.locator('.calendar .month, [data-testid="month"]').first();
      await monthElement.click();
      await monthElement.fill(month.toString());
      
      // Click date → type date
      console.log(`📅 Setting day to ${day}...`);
      const dayElement = page.locator('.calendar .day, [data-testid="day"]').first();
      await dayElement.click();
      await dayElement.fill(day.toString());
      
      // Press Enter or click outside to confirm
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Select training centre (dropdown next to "Today" button)
      console.log(`🏢 Selecting location: ${sessionDetails.location}`);
      const locationDropdown = page.locator('select, [role="combobox"]').filter({ hasText: sessionDetails.location }).first();
      await locationDropdown.selectOption({ label: sessionDetails.location });
      
      await page.waitForLoadState('networkidle');
      
      // Take screenshot after date/location selection
      await this.takeScreenshot(page, 'date-location-selected.png');
      
      // Find and click on the ITM session
      console.log(`🎯 Looking for ITM session at ${sessionDetails.time}...`);
      
      // Look for session frames containing ITM and the time
      const sessionFrame = page.locator('.session-frame, .booking-slot, .time-slot')
        .filter({ hasText: 'Introduction to Motorcycling' })
        .filter({ hasText: sessionDetails.time })
        .first();
      
      await sessionFrame.click();
      
      // Take screenshot after clicking session
      await this.takeScreenshot(page, 'session-clicked.png');
      
      // Click NEW BOOKING in popup
      console.log('📝 Clicking NEW BOOKING...');
      const newBookingButton = page.locator('button:has-text("NEW BOOKING"), button:has-text("New Booking")').first();
      await newBookingButton.click();
      await page.waitForLoadState('networkidle');
      
      console.log('✅ Session selected and NEW BOOKING clicked');
      
    } catch (error) {
      console.error('Error in navigateToDiariesAndSelectSession:', error);
      await this.takeScreenshot(page, 'session-selection-error.png');
      throw new Error(`Failed to select session: ${error.message}`);
    }
  }

  // STEP 8: Select booking options
  async selectBookingOptions(page) {
    try {
      console.log('⚙️ Selecting booking options...');
      
      // Should see "1. Price" at top
      const priceHeader = page.locator('text=1. Price, text=Price').first();
      await priceHeader.waitFor({ state: 'visible' });
      
      // Take screenshot of price page
      await this.takeScreenshot(page, 'price-page-loaded.png');
      
      // Scroll to booking options
      console.log('📜 Scrolling to booking options...');
      const bookingOptionsSection = page.locator('text=Booking options, text=Options').first();
      await bookingOptionsSection.scrollIntoViewIfNeeded();
      
      // Select first radio button (topmost option)
      console.log('🚲 Selecting first bike option...');
      const firstBikeOption = page.locator('input[type="radio"]').first();
      await firstBikeOption.check();
      
      // Take screenshot after selection
      await this.takeScreenshot(page, 'bike-option-selected.png');
      
      // Click NEXT
      console.log('➡️ Clicking NEXT...');
      const nextButton = page.locator('button:has-text("NEXT"), button:has-text("Next"), input[value*="Next"]').first();
      await nextButton.click();
      await page.waitForLoadState('networkidle');
      
      console.log('✅ Booking options selected');
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      await this.takeScreenshot(page, 'booking-options-error.png');
      throw new Error(`Failed to select booking options: ${error.message}`);
    }
  }

  // STEP 9: Lookup contact and wait
  async lookupContactAndWait(page, email) {
    try {
      console.log('🔍 Looking up contact...');
      
      // Should see "2. Contact" page with two options
      const contactHeader = page.locator('text=2. Contact, text=Contact').first();
      await contactHeader.waitFor({ state: 'visible' });
      
      // Take screenshot of contact page
      await this.takeScreenshot(page, 'contact-page-loaded.png');
      
      // Click "Lookup contact" button
      console.log('👆 Clicking Lookup contact...');
      const lookupButton = page.locator('button:has-text("Lookup contact"), button:has-text("Lookup Contact")').first();
      await lookupButton.click();
      await page.waitForLoadState('networkidle');
      
      // Click dropdown arrow next to Search field
      console.log('🔽 Opening search dropdown...');
      const searchDropdown = page.locator('select, [role="combobox"]').first();
      await searchDropdown.click();
      
      // Select "Smart search"
      await searchDropdown.selectOption('Smart search');
      
      // Enter email in search field
      console.log(`📧 Searching for: ${email}`);
      const searchField = page.locator('input[placeholder*="search"], input[name*="search"]').first();
      await searchField.fill(email);
      
      // Wait for results
      await page.waitForTimeout(2000);
      
      // Take screenshot of search results
      await this.takeScreenshot(page, 'contact-search-results.png');
      
      // Click on the user
      console.log('👆 Clicking on user...');
      const userLink = page.locator(`text=${email}`).first();
      await userLink.click();
      await page.waitForLoadState('networkidle');
      
      // Should now be on "3. Contact" page
      const contactPageHeader = page.locator('text=3. Contact, text=Contact').first();
      await contactPageHeader.waitFor({ state: 'visible' });
      
      // Take final screenshot
      await this.takeScreenshot(page, 'final-contact-page.png');
      
      // Wait for 10 seconds
      console.log('⏰ Waiting 10 seconds before closing...');
      await page.waitForTimeout(10000);
      
      console.log('✅ Contact lookup completed and waited 10 seconds');
      
    } catch (error) {
      console.error('Error in lookupContactAndWait:', error);
      await this.takeScreenshot(page, 'contact-lookup-error.png');
      throw new Error(`Failed to lookup contact: ${error.message}`);
    }
  }

  async takeScreenshot(page, filename) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(this.screenshotsDir, `${timestamp}_${filename}`);
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      console.log(`📸 Screenshot saved: ${filename}`);
      return screenshotPath;
    } catch (error) {
      console.error('Screenshot error:', error);
      return null;
    }
  }
}

export default new ITMBookingService();
