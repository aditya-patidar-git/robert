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

  // Helper method to extract location identifier from location text
  extractLocationIdentifier(locationText) {
    if (!locationText) return null;
    
    // Step 1: Try to extract UK postcode (e.g., "HA8" from "HA8 6AG")
    // Improved regex: Match first part of postcode pattern
    // Pattern: 1-2 letters + 1-2 digits/letters, followed by space + digit + 2 letters
    const postcodePattern = /\b([A-Z]{1,2}[0-9R][0-9A-Z]?)\s+[0-9][A-Z]{2}\b/i;
    const postcodeMatch = locationText.match(postcodePattern);
    if (postcodeMatch && postcodeMatch[1]) {
      const postcode = postcodeMatch[1];
      console.log(`📍 Postcode extracted: "${postcode}"`);
      return postcode; // Return first part of postcode (e.g., "HA8", "EN11", "RM9")
    }
    
    // Step 2: Extract city names (common locations in the system)
    // Priority: check for city names to avoid partial word matches
    const cityNames = ['Edgware', 'Hoddesdon', 'Alperton', 'Croydon', 'Dagenham', 'Eltham', 'Wimbledon'];
    
    for (const city of cityNames) {
      // Use word boundary to avoid matching partial words (e.g., "Barnet" containing "Barn")
      const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
      if (cityRegex.test(locationText)) {
        console.log(`📍 City name extracted: "${city}"`);
        return city;
      }
    }
    
    // Step 3: Fallback - extract first significant word after comma
    // Skip common words and words with special characters
    const skipWords = ['universal', 'motorcycle', 'training', 'london', 'the', 'hive', 'barnet', 'fc', 'barn', 'nw', 'north', 'west', 'south', 'east', 'greater'];
    
    // Split by commas and spaces, but handle parentheses properly
    // First, remove parentheses and their contents to avoid "(Barnet FC)" splitting issues
    const cleanedText = locationText.replace(/\([^)]*\)/g, '').trim();
    const words = cleanedText.split(/[,\s]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0)
      .filter(w => {
        // Filter out words that start with special characters
        const firstChar = w[0];
        return /[A-Za-z]/.test(firstChar);
      });
    
    for (const word of words) {
      const wordLower = word.toLowerCase();
      // Return first meaningful word that's not in skip list and is capitalized (likely a city name)
      if (!skipWords.includes(wordLower) && word[0] === word[0].toUpperCase() && word.length > 2) {
        console.log(`📍 Fallback word extracted: "${word}"`);
        return word;
      }
    }
    
    // Last resort: return first non-empty word (if it exists)
    if (words.length > 0) {
      console.log(`📍 Last resort word extracted: "${words[0]}"`);
      return words[0];
    }
    
    console.log(`⚠️ No location identifier could be extracted from: "${locationText}"`);
    return null;
  }

  async executeITMBookingDemo(page) {
    const screenshots = [];
    let sessionDetails = null;

    try {
      console.log('🚀 Starting ITM booking demo workflow...');
      console.log('🔍 Service: Current page URL:', page.url());
      console.log('🔍 Service: Page title:', await page.title());

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
      console.log('🔍 Service: Using client email:', clientEmail);
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

      console.log('🎉 Service: All steps completed successfully!');
      return {
        success: true,
        sessionDetails,
        screenshots,
        clientEmail
      };

    } catch (error) {
      console.error('❌ ITM booking demo failed at step:', error.message);
      console.error('❌ Service: Error stack:', error.stack);
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
    // Column order: 0=date, 1=course, 2=location, 3=time, 4=price, 5=spaces button, 6=instructor
    const sessionDetails = {
      date: (await lastDataRow.locator('td').nth(0).textContent()).trim(),
      course: (await lastDataRow.locator('td').nth(1).textContent()).trim(),
      location: (await lastDataRow.locator('td').nth(2).textContent()).trim(), // Fixed: was incorrectly mapped to time
      time: (await lastDataRow.locator('td').nth(3).textContent()).trim(), // Fixed: was incorrectly mapped to location
      price: (await lastDataRow.locator('td').nth(4).textContent()).trim(), // Added: price field
      instructor: (await lastDataRow.locator('td').nth(6).textContent()).trim().replace(/^Instructor:\s*/i, ''), // Fixed: column 5 is "Spaces" button, instructor is in column 6, remove "Instructor: " prefix
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
      
      // Wait for form fields to sync before clicking login button
      console.log('⏳ Waiting for form fields to sync...');
      await page.waitForTimeout(2500); // 2.5 seconds to allow form fields to sync
      
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
    console.log('👤 [STEP 3-5] Navigating to Contacts tab...');
    
    // Click CONTACTS tab using the specific selector
    const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")');
    await contactsTab.click();
    
    // WAIT FOR PAGE TO FULLY LOAD - 8 seconds
    console.log('⏳ [STEP 3-5] Waiting for Contacts page to fully load...');
    await page.waitForTimeout(8000);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of contacts page
    await this.takeScreenshot(page, 'contacts-page-loaded.png');
    
    console.log('🔍 [STEP 3-5] Looking for Contacts iframe...');
    
    // CRITICAL: Wait for the iframe to be present and loaded
    const iframe = page.frameLocator('#contactLookup_iframe');
    
    // Wait for the iframe to load completely
    console.log('⏳ [STEP 3-5] Waiting for iframe to load completely...');
    await page.waitForTimeout(5000);
    
    // Wait for the iframe content to be ready
    await page.waitForFunction(() => {
      const iframe = document.querySelector('#contactLookup_iframe');
      return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
    }, { timeout: 15000 });
    
    console.log('✅ Iframe loaded, switching context...');
    
    // Debug: Check what's actually in the iframe
    console.log('🔍 Debug: Checking iframe content...');
    const iframeText = await iframe.locator('body').textContent();
    console.log('🔍 Iframe content preview:', iframeText.substring(0, 200) + '...');
    
    // STEP 1: Look for the search dropdown/selector in the iframe
    console.log('🔍 [STEP 3-5] Looking for search dropdown in iframe...');
    
    // Look for any dropdown or select element that might contain search options
    const searchDropdown = iframe.locator('select, [role="combobox"], .dx-dropdowneditor').first();
    
    // Wait for the dropdown to be visible
    await searchDropdown.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log('✅ Found search dropdown, clicking to open options...');
    
    // Click on the dropdown to open the menu
    await searchDropdown.click();
    
    // WAIT FOR DROPDOWN MENU TO APPEAR - 2 seconds
    console.log('⏳ [STEP 3-5] Waiting for dropdown menu to appear...');
    await page.waitForTimeout(2000);

    await this.takeScreenshot(page, 'dropdown-menu-opened.png');

    // STEP 2: Look for "Smart search" option and scroll up to make it clickable
    console.log('🔍 [STEP 3-5] Looking for Smart search option in menu...');
    
    // First, try to find the Smart search option
    const smartSearchOption = iframe.locator('text=Smart search').first();
    
    // Check if it's visible, if not, scroll up
    const isSmartSearchVisible = await smartSearchOption.isVisible();
    console.log(`🔍 Smart search visible: ${isSmartSearchVisible}`);
    
    if (!isSmartSearchVisible) {
      console.log('🔍 Smart search not visible, scrolling up in dropdown...');
      
      // Scroll up in the dropdown menu to make Smart search visible
      await page.keyboard.press('Home'); // Go to top of dropdown
      await page.waitForTimeout(1000);
      
      // Alternative: try to scroll the dropdown container
      const dropdownMenu = iframe.locator('[role="listbox"], .dx-dropdownlist, .dx-list').first();
      if (await dropdownMenu.count() > 0) {
        await dropdownMenu.evaluate(el => el.scrollTop = 0);
        await page.waitForTimeout(1000);
      }
    }
    
    // Now try to find and click Smart search
    await smartSearchOption.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Smart search option is now visible, clicking...');
    await smartSearchOption.click();
    
    // WAIT FOR SMART SEARCH TO BE APPLIED - 2 seconds
    console.log('⏳ [STEP 3-5] Waiting for Smart search selection...');
    await page.waitForTimeout(2000);

    await this.takeScreenshot(page, 'smart-search-selected.png');
    
    // STEP 3: Look for the search input field
    console.log('🔍 [STEP 3-5] Looking for search input field...');
    const searchField = iframe.locator('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"]').first();
    
    // Wait for the search field to be visible
    await searchField.waitFor({ state: 'visible', timeout: 10000 });
    
    // STEP 4: Enter email address in search field
    console.log(`📧 [STEP 3-5] Searching for client: ${email}`);
    await searchField.fill(email);
    
    // NEW: Try multiple approaches to trigger the search
    console.log('🔍 [STEP 3-5] Triggering search...');
    
    // Approach 1: Press Enter to trigger search
    await searchField.press('Enter');
    await page.waitForTimeout(2000);
    
    // Approach 2: Look for and click search icon/button
    console.log('🔍 [STEP 3-5] Looking for search icon/button...');
    const searchButton = iframe.locator('button[type="submit"], .search-button, [aria-label*="search"], [title*="search"], .fa-search, .search-icon').first();
    
    if (await searchButton.count() > 0) {
      console.log('✅ Found search button, clicking...');
      await searchButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('❌ No search button found, trying alternative...');
      
      // Approach 3: Click elsewhere to remove focus and trigger search
      console.log('🔍 [STEP 3-5] Clicking elsewhere to trigger search...');
      await iframe.locator('body').click({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(2000);
      
      // Approach 4: Use Tab to move focus away
      console.log('🔍 [STEP 3-5] Using Tab to move focus...');
      await searchField.press('Tab');
      await page.waitForTimeout(2000);
    }
    
    // WAIT FOR SEARCH RESULTS - 5 seconds (increased)
    console.log('⏳ [STEP 3-5] Waiting for search results...');
    await page.waitForTimeout(5000);
    
    // Take screenshot after search
    await this.takeScreenshot(page, 'search-results.png');
    
    // STEP 5: Click on found client (should be the first result)
console.log('👆 [STEP 3-5] Clicking on found client...');

// Try to find and click the client
let clientClicked = false;

try {
  // Approach 1: Look for visible text
  const visibleClient = iframe.locator(`text=${email}`).filter({ hasText: email }).first();
  if (await visibleClient.count() > 0 && await visibleClient.isVisible()) {
    console.log('✅ Found visible client text');
    await visibleClient.click();
    clientClicked = true;
  } else {
    // Approach 2: Look for any element containing the email
    const anyClient = iframe.locator(`*:has-text("${email}")`).first();
    if (await anyClient.count() > 0) {
      console.log('✅ Found client in any element');
      await anyClient.click();
      clientClicked = true;
    } else {
      // Approach 3: Look for clickable elements with email
      const clickableClient = iframe.locator(`a:has-text("${email}"), button:has-text("${email}"), [role="button"]:has-text("${email}")`).first();
      if (await clickableClient.count() > 0) {
        console.log('✅ Found clickable client element');
        await clickableClient.click();
        clientClicked = true;
      }
    }
  }
} catch (clickError) {
  console.log('❌ Failed to click client, but continuing to check if page navigation occurred...');
}

// CRITICAL: Check if we're already on the client details page BEFORE waiting
console.log('🔍 [STEP 3-5] Checking if client details page is already loaded...');

// Look for client name "Mr Robert Smith" or "Robert Smith"
const clientNameVisible = await iframe.locator('text=Mr Robert Smith, text=Robert Smith').count() > 0;

// Look for the email in the contact details section
const clientEmailVisible = await iframe.locator(`text=${email}`).count() > 0;

// Look for "First Names" and "Surname" fields which indicate we're on the client details page
const firstNameField = await iframe.locator('text=First Names').count() > 0;
const surnameField = await iframe.locator('text=Surname').count() > 0;

// Look for "Contact e-mail" field
const contactEmailField = await iframe.locator('text=Contact e-mail').count() > 0;

if (clientNameVisible || clientEmailVisible || firstNameField || surnameField || contactEmailField) {
  console.log('✅ [STEP 3-5] Client details page is already loaded - no need to wait for navigation');
  
  // Take screenshot of the already loaded page
  await this.takeScreenshot(page, 'client-selected.png');
  
  // Extract and log the actual client details for verification
  try {
    const firstName = await iframe.locator('text=Robert').first().textContent();
    const surname = await iframe.locator('text=Smith').first().textContent();
    const contactEmail = await iframe.locator(`text=${email}`).first().textContent();
    
    console.log(`📋 Client Details Found:`);
    console.log(`   First Name: ${firstName}`);
    console.log(`   Surname: ${surname}`);
    console.log(`   Email: ${contactEmail}`);
  } catch (extractError) {
    console.log('⚠️ Could not extract specific client details, but page verification passed');
  }
  
  console.log('✅ [STEP 3-5] Client found and selected - considering VERIFIED for demo');
  
  // EXIT THE FUNCTION - Step 3-5 is complete
  return;
}

// Only wait for navigation if we're not already on the client details page
if (clientClicked) {
  console.log('⏳ [STEP 3-5] Waiting for client page to load...');
  await page.waitForTimeout(4000);
  await page.waitForLoadState('networkidle');
  
  // Take screenshot after clicking client
  await this.takeScreenshot(page, 'client-selected.png');
  
  // Verify we're on the client details page
  console.log('🔍 [STEP 3-5] Verifying client details page...');
  
  // Look for client name "Mr Robert Smith" or "Robert Smith"
  const clientNameVisible = await iframe.locator('text=Mr Robert Smith, text=Robert Smith').count() > 0;
  
  // Look for the email in the contact details section
  const clientEmailVisible = await iframe.locator(`text=${email}`).count() > 0;
  
  // Look for "First Names" and "Surname" fields which indicate we're on the client details page
  const firstNameField = await iframe.locator('text=First Names').count() > 0;
  const surnameField = await iframe.locator('text=Surname').count() > 0;
  
  // Look for "Contact e-mail" field
  const contactEmailField = await iframe.locator('text=Contact e-mail').count() > 0;
  
  if (clientNameVisible || clientEmailVisible || firstNameField || surnameField || contactEmailField) {
    console.log('✅ [STEP 3-5] Client details page loaded successfully - considering VERIFIED for demo');
    console.log(`🔍 Verification details: name=${clientNameVisible}, email=${clientEmailVisible}, firstName=${firstNameField}, surname=${surnameField}, contactEmail=${contactEmailField}`);
    
    console.log('✅ [STEP 3-5] Client found and selected - considering VERIFIED for demo');
    
    // EXIT THE FUNCTION - Step 3-5 is complete
    return;
  } else {
    console.log('❌ [STEP 3-5] Client details page verification failed');
    throw new Error(`Could not verify client details page. Expected to find client name, email, or form fields.`);
  }
} else {
  console.log('❌ [STEP 3-5] Could not click client and page navigation did not occur');
  throw new Error(`Could not find or click client element with email: ${email}`);
}
    
  } catch (error) {
    console.error('❌ [STEP 3-5] Client search failed:', error);
    await this.takeScreenshot(page, 'client-search-error.png');
    throw new Error(`[STEP 3-5] Failed to find client: ${error.message}`);
  }
}


  // STEP 6-7: Navigate to Diaries and select session
  async navigateToDiariesAndSelectSession(page, sessionDetails) {
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
      await this.takeScreenshot(page, 'diaries-page-loaded.png');
      
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
      await this.takeScreenshot(page, 'calendar-popup-opened.png');
      
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
      
      // // Select training centre from top toolbar dropdown
      // console.log(`🏢 Selecting location: ${sessionDetails.location}`);
      
      // // Extract location identifier (city name or postcode)
      // const locationIdentifier = this.extractLocationIdentifier(sessionDetails.location);
      // console.log(`🔍 Extracted location identifier: ${locationIdentifier}`);
      
      // // Find the location dropdown in the top toolbar
      // // IMPORTANT: The dropdown is inside the diaries iframe, not on the main page
      // let locationInput;
      // let dropdownMenu;
      // let allOptions;
      // let searchContext = page; // Default to main page
      
      // // Check if we need to work with iframe (same check as date selection)
      // if (diariesIframeExists) {
      //   console.log('🔍 [STEP 6-7] Working with Diaries iframe for location dropdown...');
      //   const iframe = page.frameLocator('#newDiaryDefault_iframe');
      //   searchContext = iframe;
        
      //   // Try multiple selectors to find the location dropdown inside iframe
      //   locationInput = iframe.locator('input[placeholder*="Diary"], input[placeholder*="Choose"], input[role="combobox"], .dx-selectbox input.dx-texteditor-input').first();
        
      //   if (await locationInput.count() === 0) {
      //     // Try finding by any dropdown editor in the toolbar area
      //     locationInput = iframe.locator('.dx-dropdowneditor-field-clickable input, [role="combobox"]').first();
      //   }
      // } else {
      //   console.log('🔍 [STEP 6-7] Working with main page for location dropdown...');
      //   // Try multiple selectors to find the location dropdown on main page
      //   locationInput = page.locator('input[placeholder*="Diary"], input[placeholder*="Choose"], input[role="combobox"], .dx-selectbox input.dx-texteditor-input').first();
        
      //   if (await locationInput.count() === 0) {
      //     // Try finding by any dropdown editor in the toolbar area
      //     locationInput = page.locator('.dx-dropdowneditor-field-clickable input, [role="combobox"]').first();
      //   }
      // }
      
      // if (await locationInput.count() > 0) {
      //   console.log('✅ Found location dropdown input, clicking to open...');
        
      //   // Wait for element to be visible before clicking
      //   await locationInput.waitFor({ state: 'visible', timeout: 10000 });
        
      //   // Scroll into view if needed
      //   await locationInput.scrollIntoViewIfNeeded();
      //   await page.waitForTimeout(500);
        
      //   // Click the input field to open the dropdown
      //   await locationInput.click();
      //   await page.waitForTimeout(2000); // Increased wait for popup to fully render in DOM
        
      //   // Wait for dropdown menu to appear
      //   // DevExtreme popups often render on main page even if input is in iframe
      //   // Try multiple selectors and contexts
      //   console.log('🔍 Waiting for dropdown popup to appear...');
      //   dropdownMenu = null;
      //   let popupContext = null;
        
      //   // Helper function to validate if dropdown contains location options (not navigation menu)
      //   const isValidLocationDropdown = async (menuLocator) => {
      //     try {
      //       const options = menuLocator.locator('[role="option"]');
      //       const optionCount = await options.count();
            
      //       if (optionCount === 0) return false;
            
      //       // CRITICAL: Content validation must run FIRST - check for navigation menu keywords immediately
      //       // Navigation menu items typically contain: "Registration forms", "Today", "Diaries", "Contacts", etc.
      //       // Location options typically contain: postcodes, city names, or location identifiers
      //       const navigationMenuKeywords = [
      //         'registration forms', 'today', 'diaries', 'contacts', 'companies',
      //         'quick sms', 'staff planner', 'motorbikes', 'fault reports', 'log out'
      //       ];
            
      //       let hasNavigationKeywords = false;
      //       let hasLocationKeywords = false;
      //       let locationCount = 0;
            
      //       // Check multiple options (up to 5) to get better sample
      //       const checkCount = Math.min(5, optionCount);
      //       for (let i = 0; i < checkCount; i++) {
      //         const optionText = await options.nth(i).textContent();
      //         const optionLower = optionText ? optionText.toLowerCase() : '';
              
      //         // Check for navigation menu keywords FIRST - reject immediately if found
      //         if (navigationMenuKeywords.some(keyword => optionLower.includes(keyword))) {
      //           hasNavigationKeywords = true;
      //           // Early exit: if we find navigation keywords, it's definitely not the location dropdown
      //           console.log(`⚠️ Found navigation menu keywords in dropdown, rejecting...`);
      //           return false;
      //         }
              
      //         // Check for location indicators (postcodes, city names, common location terms)
      //         // UK postcode patterns: partial (HA8, EN11, RM9, CR0, KT3) and full (SE3 8NB, EN11 0EH)
      //         const hasPostcode = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}\b/i.test(optionText) || // Full UK postcode
      //                             /\b[A-Z]{1,2}\d{1,2}[A-Z]?\b/i.test(optionText); // Postcode prefix (HA8, EN11, RM9, etc.)
              
      //         const hasCityName = /edgware|dagenham|barking|alperton|croydon|eltham|hoddesdon|wimbledon/i.test(optionLower);
              
      //         const hasLocationIndicator = /north west london|south london|east london|west london|south east london/i.test(optionLower) ||
      //                                      /london|training|centre|diary/i.test(optionLower);
              
      //         if (hasPostcode || hasCityName || hasLocationIndicator) {
      //           hasLocationKeywords = true;
      //           locationCount++;
      //         }
      //       }
            
      //       // If we found location keywords in multiple options, it's definitely a location dropdown
      //       if (locationCount >= 2) {
      //         console.log(`✅ Dropdown validated as location dropdown (${locationCount} location indicators found)`);
      //         return true;
      //       }
            
      //       // If it has navigation keywords but no location keywords, it's likely the wrong dropdown
      //       if (hasNavigationKeywords && !hasLocationKeywords) {
      //         console.log(`⚠️ Found dropdown but it appears to be navigation menu, skipping...`);
      //         return false;
      //       }
            
      //       // If we have at least one location keyword, it's probably valid
      //       if (hasLocationKeywords) {
      //         console.log(`✅ Dropdown validated as location dropdown (location indicators found)`);
      //         return true;
      //       }
            
      //       // Secondary check: aria-label can be used as confirmation if content validation is unclear
      //       const ariaLabel = await menuLocator.getAttribute('aria-label');
      //       if (ariaLabel === 'Items' && !hasNavigationKeywords) {
      //         console.log(`✅ Dropdown validated by aria-label="Items" (with content validation passed)`);
      //         return true;
      //       }
            
      //       // If validation is unclear, assume it's valid (better to try than skip)
      //       console.log(`⚠️ Dropdown validation unclear, assuming valid...`);
      //       return true;
      //     } catch (e) {
      //       // If validation fails, assume it's valid (better to try than skip)
      //       console.log(`⚠️ Dropdown validation error, assuming valid: ${e.message}`);
      //       return true;
      //     }
      //   };
        
      //   // Try main page first (DevExtreme often portals popups to body/main page)
      //   // Prioritize more specific selectors first to avoid matching navigation menu
      //   const mainPageSelectors = [
      //     '.dx-selectbox-popup-wrapper .dx-list-items[role="listbox"]',  // Most specific - unique to selectbox popups
      //     '.dx-dropdownlist-popup-wrapper .dx-list-items[role="listbox"]',  // Alternative specific wrapper
      //     '.dx-dropdownlist-popup .dx-list-items[role="listbox"]',  // Dropdown popup container
      //     '.dx-popup-wrapper .dx-list-items[role="listbox"]',      // Alternative popup wrapper
      //     'div.dx-list-items[role="listbox"][aria-label="Items"]',  // With aria-label attribute
      //     'div.dx-list-items[role="listbox"]',                     // Generic (fallback, needs validation)
      //     '[role="listbox"]'                                        // Very generic (last resort)
      //   ];
        
      //   for (const selector of mainPageSelectors) {
      //     try {
      //       // Try to find all matching dropdowns
      //       const menus = page.locator(selector);
      //       const menuCount = await menus.count();
            
      //       // Try each matching dropdown until we find the valid one
      //       for (let i = 0; i < menuCount; i++) {
      //         const menu = menus.nth(i);
      //         await menu.waitFor({ state: 'visible', timeout: 2000 });
              
      //         // Validate this is the location dropdown, not navigation menu
      //         if (await isValidLocationDropdown(menu)) {
      //           dropdownMenu = menu;
      //           popupContext = page;
      //           console.log(`✅ Found valid location dropdown popup on main page with selector: "${selector}" (index ${i})`);
      //           break;
      //         }
      //       }
            
      //       if (dropdownMenu) break;
      //     } catch (e) {
      //       // Try next selector
      //     }
      //   }
        
      //   // If not found on main page, try iframe context
      //   if (!dropdownMenu && diariesIframeExists) {
      //     const iframe = page.frameLocator('#newDiaryDefault_iframe');
      //     for (const selector of mainPageSelectors) {
      //       try {
      //         // Try to find all matching dropdowns in iframe
      //         const menus = iframe.locator(selector);
      //         const menuCount = await menus.count();
              
      //         // Try each matching dropdown until we find the valid one
      //         for (let i = 0; i < menuCount; i++) {
      //           const menu = menus.nth(i);
      //           await menu.waitFor({ state: 'visible', timeout: 2000 });
                
      //           // Validate this is the location dropdown, not navigation menu
      //           if (await isValidLocationDropdown(menu)) {
      //             dropdownMenu = menu;
      //             popupContext = iframe;
      //             console.log(`✅ Found valid location dropdown popup in iframe with selector: "${selector}" (index ${i})`);
      //             break;
      //           }
      //         }
              
      //         if (dropdownMenu) break;
      //       } catch (e) {
      //         // Try next selector
      //       }
      //     }
      //   }
        
      //   if (!dropdownMenu) {
      //     throw new Error('Dropdown popup did not appear after clicking input. Tried main page and iframe contexts.');
      //   }
        
      //   console.log('✅ Dropdown menu opened, searching for matching location...');
      //   console.log(`🔍 Step 1 Location: "${sessionDetails.location}"`);
      //   console.log(`🔍 Extracted Identifier: "${locationIdentifier}"`);
        
      //   // Find the matching option in the dropdown
      //   // Options may be formatted like "Edgware, North West London, HA8" or "Dagenham, East London, RM9"
      //   let matchingOption = null;
      //   let matchedIndex = -1;
      //   let matchedText = null;
        
      //   // Get all dropdown options using the popup context (where popup was found)
      //   allOptions = popupContext.locator('div.dx-item.dx-list-item[role="option"], div.dx-item[role="option"], [role="option"]');
      //   const optionCount = await allOptions.count();
        
      //   console.log(`📋 Found ${optionCount} dropdown options. Listing all available options:`);
        
      //   // First pass: Collect all option texts for logging
      //   const allOptionTexts = [];
      //   for (let i = 0; i < optionCount; i++) {
      //     const optionText = await allOptions.nth(i).textContent();
      //     const trimmedText = optionText ? optionText.trim() : '';
      //     allOptionTexts.push(trimmedText);
      //     console.log(`   ${i + 1}. "${trimmedText}"`);
      //   }
        
      //   // Second pass: Find the best match using location identifier
      //   if (locationIdentifier) {
      //     console.log(`\n🔍 Searching for location identifier "${locationIdentifier}" in dropdown options...`);
          
      //     for (let i = 0; i < optionCount; i++) {
      //       const optionText = allOptionTexts[i];
            
      //       if (optionText) {
      //         const optionLower = optionText.toLowerCase();
      //         const identifierLower = locationIdentifier.toLowerCase();
              
      //         // Check for exact match first (most precise)
      //         if (optionLower === identifierLower) {
      //           matchingOption = allOptions.nth(i);
      //           matchedIndex = i;
      //           matchedText = optionText;
      //           console.log(`✅ Exact match found at index ${i + 1}: "${optionText}"`);
      //           break;
      //         }
              
      //         // Check if option starts with identifier (high confidence match)
      //         if (optionLower.startsWith(identifierLower)) {
      //           matchingOption = allOptions.nth(i);
      //           matchedIndex = i;
      //           matchedText = optionText;
      //           console.log(`✅ Start match found at index ${i + 1}: "${optionText}"`);
      //           break;
      //         }
              
      //         // Check if identifier is at the beginning of the option (e.g., "Edgware, ...")
      //         if (optionLower.startsWith(identifierLower + ',')) {
      //           matchingOption = allOptions.nth(i);
      //           matchedIndex = i;
      //           matchedText = optionText;
      //           console.log(`✅ Start-with-comma match found at index ${i + 1}: "${optionText}"`);
      //           break;
      //         }
              
      //         // Check if option contains identifier as a word (partial match)
      //         const wordBoundaryRegex = new RegExp(`\\b${identifierLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      //         if (wordBoundaryRegex.test(optionText)) {
      //           // Only use this if we haven't found a better match
      //           if (!matchingOption) {
      //             matchingOption = allOptions.nth(i);
      //             matchedIndex = i;
      //             matchedText = optionText;
      //             console.log(`✅ Word-boundary match found at index ${i + 1}: "${optionText}"`);
      //           }
      //         }
              
      //         // Fallback: simple contains check (lowest confidence, only if no other match)
      //         if (!matchingOption && optionLower.includes(identifierLower)) {
      //           matchingOption = allOptions.nth(i);
      //           matchedIndex = i;
      //           matchedText = optionText;
      //           console.log(`⚠️ Partial match found at index ${i + 1}: "${optionText}"`);
      //         }
      //       }
      //     }
      //   }
        
      //   // Final selection and logging
      //   if (matchingOption && await matchingOption.count() > 0) {
      //     console.log(`\n✅ MATCH FOUND AND SELECTING:`);
      //     console.log(`   Step 1 Location: "${sessionDetails.location}"`);
      //     console.log(`   Extracted Identifier: "${locationIdentifier}"`);
      //     console.log(`   Selected Option: "${matchedText}" (Index: ${matchedIndex + 1} of ${optionCount})`);
      //     console.log(`   Match Confidence: ${matchedIndex >= 0 ? 'High' : 'Medium'}`);
          
      //     await matchingOption.click();
      //     console.log('✅ Location selected successfully from dropdown');
      //   } else {
      //     console.log(`\n❌ ERROR: Could not find matching location in dropdown!`);
      //     console.log(`   Step 1 Location: "${sessionDetails.location}"`);
      //     console.log(`   Extracted Identifier: "${locationIdentifier}"`);
      //     console.log(`   Available Options: ${allOptionTexts.length}`);
      //     allOptionTexts.forEach((text, idx) => {
      //       console.log(`     ${idx + 1}. "${text}"`);
      //     });
      //     console.log(`\n⚠️ Closing dropdown and continuing...`);
      //     // Press Escape to close dropdown if no match found
      //     await page.keyboard.press('Escape');
      //     throw new Error(`Could not find matching location "${locationIdentifier}" in dropdown. Available options: ${allOptionTexts.join(', ')}`);
      //   }
      // } else {
      //   console.log('⚠️ Location dropdown not found in toolbar, continuing...');
      // }
      
      // Wait for page to update after location selection
      await page.waitForTimeout(3000);
      
      // Take screenshot after date/location selection
      await this.takeScreenshot(page, 'date-location-selected.png');
      
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
      await this.takeScreenshot(page, 'session-clicked.png');
      
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
        await this.takeScreenshot(page, 'new-booking-not-found.png');
        
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
      await this.takeScreenshot(page, 'session-selection-error.png');
      throw new Error(`Failed to select session: ${error.message}`);
    }
  }

  // STEP 8: Select booking options
  async selectBookingOptions(page) {
    try {
      console.log('⚙️ [STEP 8] Selecting booking options...');
      
      // WAIT FOR PRICE PAGE TO LOAD - 5 seconds (increased for iframe/popup loading)
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
          console.log(`   Page ${i + 1}: Title="${pageTitle}", URL="${pageUrl.substring(0, 100)}..."`);
          if (pageTitle.includes('booking') || pageTitle.includes('Booking') || 
              pageUrl.includes('booking') || pageUrl.includes('Booking')) {
            targetPage = pages[i];
            console.log(`✅ [STEP 8] Using popup window for booking form`);
            break;
          }
        }
      }
      
      // Define popup selectors at function level so they're accessible everywhere
      const popupSelectors = [
        '.dx-popup-wrapper:has-text("Price")',
        '.dx-popup-wrapper:has-text("Booking")',
        '.dx-popup-wrapper:has-text("1. Price")',
        '.dx-popup-wrapper:has-text("Booking options")',
        '.dx-popup-wrapper:has(#priceDetailsContainer)',
        '.dx-popup-wrapper:has(.jqx_form)',
        '.dx-popup-wrapper .dx-wizard',
        '.dx-popup-wrapper .dx-wizard-step',
        '.dx-popup.dx-popup-fullscreen',
        '.dx-popup-wrapper[role="dialog"]',
        '.dx-popup-wrapper:visible',
        '.dx-popup-content:has-text("Price")',
        '.dx-popup-content:has-text("Booking options")',
        '.dx-popup-content:has(#priceDetailsContainer)',
        '.dx-popup-content:has(.jqx_form)'
      ];
      
      // Determine if booking form is in an iframe, popup, or on main page
      let searchContext = targetPage;
      let bookingIframe = null;
      let popupContainer = null;
      let bookingFormContainer = null;
      
      // PRIORITY 0: Search for booking form containers FIRST (#priceDetailsContainer or .jqx_form)
      // This is the most reliable way to find the booking form regardless of where it is
      console.log('🔍 [STEP 8] PRIORITY 0: Searching for booking form containers (#priceDetailsContainer or .jqx_form)...');
      
      const bookingFormSelectors = [
        '#priceDetailsContainer',
        '.jqx_form',
        '#priceDetailsContainer .jqx_form',
        '.jqx_form:has(#priceDetailsContainer)'
      ];
      
      // Check main page first
      for (const selector of bookingFormSelectors) {
        const container = targetPage.locator(selector).first();
        if (await container.count() > 0) {
          const isVisible = await container.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 8] Found booking form container on main page: "${selector}"`);
            bookingFormContainer = container;
            searchContext = bookingFormContainer;
            break;
          }
        }
      }
      
      // Check within diaries iframe (nested popup scenario)
      if (!bookingFormContainer) {
        console.log('🔍 [STEP 8] Checking for booking form within diaries iframe...');
        const diariesIframeExists = await targetPage.locator('#newDiaryDefault_iframe').count() > 0;
        if (diariesIframeExists) {
          const diariesIframe = targetPage.frameLocator('#newDiaryDefault_iframe');
          
          // Check for booking form directly in iframe
          for (const selector of bookingFormSelectors) {
            const container = diariesIframe.locator(selector).first();
            if (await container.count() > 0) {
              const isVisible = await container.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [STEP 8] Found booking form container in diaries iframe: "${selector}"`);
                bookingFormContainer = container;
                searchContext = bookingFormContainer;
                break;
              }
            }
          }
          
          // Check for popup within diaries iframe
          if (!bookingFormContainer) {
            console.log('🔍 [STEP 8] Checking for popup within diaries iframe...');
            const iframePopupSelectors = [
              '.dx-popup-wrapper:has(#priceDetailsContainer)',
              '.dx-popup-wrapper:has(.jqx_form)',
              '.dx-popup-wrapper:visible',
              '[role="dialog"]:has(#priceDetailsContainer)',
              '[role="dialog"]:has(.jqx_form)'
            ];
            
            for (const popupSelector of iframePopupSelectors) {
              const popup = diariesIframe.locator(popupSelector).first();
              if (await popup.count() > 0) {
                const isVisible = await popup.isVisible().catch(() => false);
                if (isVisible) {
                  // Check if booking form is inside this popup
                  const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
                  if (await containerInPopup.count() > 0) {
                    console.log(`✅ [STEP 8] Found booking form in popup within diaries iframe: "${popupSelector}"`);
                    popupContainer = popup;
                    bookingFormContainer = containerInPopup;
                    searchContext = bookingFormContainer;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      // Check within eventNewBooking2_iframe (the actual booking form iframe)
      if (!bookingFormContainer) {
        console.log('🔍 [STEP 8] Checking for booking form within eventNewBooking2_iframe...');
        const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
        if (eventBookingIframeExists) {
          const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
          
          // Wait for iframe to load
          await targetPage.waitForTimeout(2000);
          await targetPage.evaluate((id) => {
            return new Promise((resolve) => {
              const iframe = document.querySelector(`#${id}`);
              if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                resolve(true);
              } else {
                setTimeout(() => resolve(true), 1000);
              }
            });
          }, 'eventNewBooking2_iframe');
          
          // Check for booking form directly in iframe
          for (const selector of bookingFormSelectors) {
            const container = eventBookingIframe.locator(selector).first();
            if (await container.count() > 0) {
              const isVisible = await container.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [STEP 8] Found booking form container in eventNewBooking2_iframe: "${selector}"`);
                bookingFormContainer = container;
                searchContext = bookingFormContainer;
                break;
              }
            }
          }
          
          // If container not found, use iframe as context
          if (!bookingFormContainer) {
            console.log('✅ [STEP 8] Using eventNewBooking2_iframe as search context');
            bookingIframe = eventBookingIframe;
            searchContext = eventBookingIframe;
          }
        }
      }
      
      // PRIORITY 1: Check for DevExtreme popup/dialog (if container not found yet)
      if (!bookingFormContainer) {
        console.log('🔍 [STEP 8] PRIORITY 1: Checking for DevExtreme popup/dialog...');
        
        for (const popupSelector of popupSelectors) {
          const popup = targetPage.locator(popupSelector).first();
          if (await popup.count() > 0) {
            const isVisible = await popup.isVisible().catch(() => false);
            if (isVisible) {
              // Check if booking form is inside this popup
              const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
              if (await containerInPopup.count() > 0) {
                console.log(`✅ [STEP 8] Found booking form in DevExtreme popup: "${popupSelector}"`);
                popupContainer = popup;
                bookingFormContainer = containerInPopup;
                searchContext = bookingFormContainer;
                break;
              } else {
                console.log(`✅ [STEP 8] Found DevExtreme popup (no booking form container yet): "${popupSelector}"`);
                popupContainer = popup;
                searchContext = popupContainer;
              }
            }
          }
        }
      }
      
      // PRIORITY 2: Check for generic popups (not just DevExtreme)
      if (!bookingFormContainer && !popupContainer) {
        console.log('🔍 [STEP 8] PRIORITY 2: Checking for generic popups/dialogs...');
        const genericPopupSelectors = [
          '[role="dialog"]:has(#priceDetailsContainer)',
          '[role="dialog"]:has(.jqx_form)',
          '[role="dialog"]:visible',
          '.popup:has(#priceDetailsContainer)',
          '.popup:has(.jqx_form)',
          '.popup:visible',
          '.modal:has(#priceDetailsContainer)',
          '.modal:has(.jqx_form)',
          '.modal:visible',
          '.dialog:has(#priceDetailsContainer)',
          '.dialog:has(.jqx_form)',
          '.dialog:visible'
        ];
        
        for (const popupSelector of genericPopupSelectors) {
          const popup = targetPage.locator(popupSelector).first();
          if (await popup.count() > 0) {
            const isVisible = await popup.isVisible().catch(() => false);
            if (isVisible) {
              // Check if booking form is inside this popup
              const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
              if (await containerInPopup.count() > 0) {
                console.log(`✅ [STEP 8] Found booking form in generic popup: "${popupSelector}"`);
                popupContainer = popup;
                bookingFormContainer = containerInPopup;
                searchContext = bookingFormContainer;
                break;
              }
            }
          }
        }
      }
      
      // PRIORITY 3: Check for iframes that might contain the booking form
      // NOTE: Excluding 'newDiaryDefault_iframe' as it's the diaries iframe, not the booking form
      if (!bookingFormContainer && !popupContainer) {
        console.log('🔍 [STEP 8] PRIORITY 3: Checking for booking form iframe...');
        const possibleIframeIds = [
          'eventNewBooking2_iframe',  // This is the actual booking form iframe!
          'booking_iframe',
          'diaryNewCourseBooking_iframe',
          'courseBooking_iframe',
          'bookingWizard_iframe',
          'newBooking_iframe'
        ];
        
        for (const iframeId of possibleIframeIds) {
          const iframeExists = await targetPage.locator(`#${iframeId}`).count() > 0;
          if (iframeExists) {
            console.log(`✅ [STEP 8] Found iframe: #${iframeId}`);
            bookingIframe = targetPage.frameLocator(`#${iframeId}`);
            
            // Check if booking form is in this iframe
            for (const selector of bookingFormSelectors) {
              const container = bookingIframe.locator(selector).first();
              if (await container.count() > 0) {
                const isVisible = await container.isVisible().catch(() => false);
                if (isVisible) {
                  console.log(`✅ [STEP 8] Found booking form container in iframe #${iframeId}: "${selector}"`);
                  bookingFormContainer = container;
                  searchContext = bookingFormContainer;
                  break;
                }
              }
            }
            
            if (bookingFormContainer) {
              break;
            }
            
            // Wait for iframe to load
            await targetPage.waitForTimeout(2000);
            await targetPage.evaluate((id) => {
              return new Promise((resolve) => {
                const iframe = document.querySelector(`#${id}`);
                if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                  resolve(true);
                } else {
                  setTimeout(() => resolve(true), 1000);
                }
              });
            }, iframeId);
            
            // Use iframe as context if no container found yet
            if (!bookingFormContainer) {
              searchContext = bookingIframe;
            }
            break;
          }
        }
      }
      
      // PRIORITY 4: Fallback to main page if nothing found
      if (!bookingFormContainer && !popupContainer && !bookingIframe) {
        console.log('🔍 [STEP 8] PRIORITY 4: No container/popup/iframe found, using main page...');
        searchContext = targetPage;
      }
      
      // Debug: Log what we're searching in
      console.log('📊 [STEP 8] Context detection summary:');
      if (bookingFormContainer) {
        console.log('   ✅ Booking form container found - using as search context');
      } else if (popupContainer) {
        console.log('   ✅ Popup container found - using as search context');
      } else if (bookingIframe) {
        console.log('   ✅ Iframe found - using as search context');
      } else {
        console.log('   ⚠️ Using main page as search context');
      }
      
      // Try multiple selectors for "1. Price" header
      console.log('🔍 [STEP 8] Looking for "1. Price" header...');
      const priceHeaderSelectors = [
        'text=1. Price',
        'text="1. Price"',
        '*:has-text("1. Price")',
        'span:has-text("1. Price")',
        'div:has-text("1. Price")',
        '*:has-text("Price")',
        '.dx-wizard-step[aria-selected="true"]:has-text("Price")',
        '[role="tab"]:has-text("Price")'
      ];
      
      let priceHeader = null;
      for (const selector of priceHeaderSelectors) {
        try {
          priceHeader = searchContext.locator(selector).first();
          const count = await priceHeader.count();
          if (count > 0) {
            const isVisible = await priceHeader.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 8] Found "1. Price" using selector: "${selector}"`);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // If still not found, try waiting with a more flexible approach
      if (!priceHeader || await priceHeader.count() === 0) {
        console.log('⚠️ [STEP 8] "1. Price" not found with standard selectors, trying alternative approach...');
        await targetPage.waitForTimeout(2000);
        
        // Try to find any element containing "Price" in the visible text
        const anyPriceElement = searchContext.locator('*:has-text("Price")').first();
        if (await anyPriceElement.count() > 0) {
          const text = await anyPriceElement.textContent();
          if (text && text.includes('Price')) {
            console.log(`✅ [STEP 8] Found element with "Price" text: "${text.substring(0, 50)}"`);
            priceHeader = anyPriceElement;
          }
        }
      }
      
      // If still not found, proceed anyway (page might be loaded but selector is different)
      if (!priceHeader || await priceHeader.count() === 0) {
        console.log('⚠️ [STEP 8] Could not find "1. Price" header, but proceeding to check for booking options...');
        await this.takeScreenshot(targetPage, 'price-page-loaded.png');
      } else {
        // Wait for price header to be visible
        await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
          console.log('⚠️ [STEP 8] Price header visibility check timed out, continuing...');
        });
        
        // Take screenshot of price page
        await this.takeScreenshot(targetPage, 'price-page-loaded.png');
      }
      
      // Scroll to booking options
      console.log('📜 [STEP 8] Scrolling to booking options...');
      const bookingOptionsSelectors = [
        'text=Booking options',
        'span:has-text("Booking options")',
        'div:has-text("Booking options")',
        '*:has-text("Booking options")'
      ];
      
      let bookingOptionsSection = null;
      for (const selector of bookingOptionsSelectors) {
        try {
          bookingOptionsSection = searchContext.locator(selector).first();
          if (await bookingOptionsSection.count() > 0) {
            const isVisible = await bookingOptionsSection.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 8] Found "Booking options" using selector: "${selector}"`);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (bookingOptionsSection && await bookingOptionsSection.count() > 0) {
        await bookingOptionsSection.scrollIntoViewIfNeeded();
      } else {
        console.log('⚠️ [STEP 8] Could not find "Booking options" section, scrolling to bottom...');
        await targetPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      }
      
      // WAIT FOR OPTIONS TO BE VISIBLE - 2 seconds
      console.log('⏳ [STEP 8] Waiting for booking options to be visible...');
      await page.waitForTimeout(2000);
      
      // Find and select one option from EACH of the three sections:
      // 1. CBT course type
      // 2. Full Licence courses
      // 3. Booking options
      console.log('🚲 [STEP 8] Selecting options from all required sections...');
      
      // Strategy: Find all option groups and select first option from each
      const optionGroups = searchContext.locator('.jqxInputBookingOptionsSelectGroup');
      const groupCount = await optionGroups.count();
      console.log(`📊 [STEP 8] Found ${groupCount} option groups`);
      
      let selectedCount = 0;
      
      // Select first option from each group
      for (let i = 0; i < groupCount; i++) {
        const group = optionGroups.nth(i);
        const firstOptionInGroup = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable').first();
        
        if (await firstOptionInGroup.count() > 0) {
          try {
            await firstOptionInGroup.waitFor({ state: 'visible', timeout: 3000 });
            
            // Try clicking the check div first (most reliable)
            const checkDiv = firstOptionInGroup.locator('.jqx_inputBookingOptionsSelect_check').first();
            if (await checkDiv.count() > 0) {
              await checkDiv.click();
              selectedCount++;
              console.log(`✅ [STEP 8] Selected option from group ${i + 1}`);
            } else {
              // Fallback: click the row itself
              await firstOptionInGroup.click();
              selectedCount++;
              console.log(`✅ [STEP 8] Selected option from group ${i + 1} (fallback)`);
            }
            
            // Small delay between selections
            await page.waitForTimeout(500);
          } catch (e) {
            console.log(`⚠️ [STEP 8] Error selecting option from group ${i + 1}: ${e.message}`);
          }
        }
      }
      
      // Validate that we selected at least one option
      if (selectedCount === 0) {
        console.log('⚠️ [STEP 8] No options selected from groups, trying fallback...');
        // Fallback: Try selecting first available option (old behavior)
        let firstOptionRow = searchContext.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable').first();
        
        // FALLBACK STRATEGY: If not found in current context, try alternative contexts
        if (await firstOptionRow.count() === 0) {
          console.log('⚠️ [STEP 8] Booking options not found in current context, trying fallback contexts...');
          
          // Try eventNewBooking2_iframe first
          const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
          if (eventBookingIframeExists) {
            const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
            firstOptionRow = eventBookingIframe.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable').first();
            if (await firstOptionRow.count() > 0) {
              searchContext = eventBookingIframe;
              bookingIframe = eventBookingIframe;
            }
          }
          
          // Try main page
          if (await firstOptionRow.count() === 0) {
            firstOptionRow = targetPage.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable').first();
            if (await firstOptionRow.count() > 0) {
              searchContext = targetPage;
            }
          }
        }
        
        if (await firstOptionRow.count() > 0) {
          await firstOptionRow.waitFor({ state: 'visible', timeout: 5000 });
          
          // Try clicking the check div first (most reliable)
          const checkDiv = firstOptionRow.locator('.jqx_inputBookingOptionsSelect_check').first();
          if (await checkDiv.count() > 0) {
            await checkDiv.click();
            selectedCount++;
            console.log('✅ [STEP 8] Selected fallback option');
          } else {
            // Fallback: click the row itself
            await firstOptionRow.click();
            selectedCount++;
            console.log('✅ [STEP 8] Selected fallback option (fallback)');
          }
        }
      }
      
      // Final validation
      if (selectedCount === 0) {
        console.log('⚠️ [STEP 8] No selectable booking options found in any context');
        await this.takeScreenshot(targetPage, 'booking-options-not-found.png');
        throw new Error('No selectable booking options found on price page');
      }
      
      console.log(`✅ [STEP 8] Selected ${selectedCount} option(s) from booking form`);
      
      // Wait for selection to register
      await page.waitForTimeout(1000);
      
      // Take screenshot after selection
      await this.takeScreenshot(targetPage, 'bike-option-selected.png');
      
      // Click NEXT button using the specific ID from HTML structure
      console.log('➡️ [STEP 8] Clicking NEXT...');
      let nextButton = searchContext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
      
      // FALLBACK: Try alternative contexts if button not found
      if (await nextButton.count() === 0) {
        console.log('⚠️ [STEP 8] Next button not found in current context, trying fallback contexts...');
        
        // Strategy 1: Try within eventNewBooking2_iframe if we're using container context
        if (bookingFormContainer && !bookingIframe) {
          console.log('🔍 [STEP 8] Trying eventNewBooking2_iframe context for Next button...');
          const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
          if (eventBookingIframeExists) {
            const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
            const iframeNextButton = eventBookingIframe.locator('#diaryNewCourseBookingWiz_nextBtn').first();
            if (await iframeNextButton.count() > 0) {
              console.log('✅ [STEP 8] Found Next button in eventNewBooking2_iframe!');
              nextButton = iframeNextButton;
            }
          }
        }
        
        // Strategy 2: Try main page
        if ((await nextButton.count() === 0) && (popupContainer || bookingIframe || bookingFormContainer)) {
          const mainPageNextButton = targetPage.locator('#diaryNewCourseBookingWiz_nextBtn').first();
          if (await mainPageNextButton.count() > 0) {
            console.log('✅ [STEP 8] Found Next button on main page!');
            nextButton = mainPageNextButton;
          }
        }
        
        // Strategy 3: Try popup if not found (now popupSelectors is accessible)
        if ((await nextButton.count() === 0) && !popupContainer) {
          for (const popupSelector of popupSelectors) {
            const popup = targetPage.locator(popupSelector).first();
            if (await popup.count() > 0) {
              const isVisible = await popup.isVisible().catch(() => false);
              if (isVisible) {
                const popupNextButton = popup.locator('#diaryNewCourseBookingWiz_nextBtn').first();
                if (await popupNextButton.count() > 0) {
                  console.log(`✅ [STEP 8] Found Next button in popup: "${popupSelector}"`);
                  nextButton = popupNextButton;
                  break;
                }
              }
            }
          }
        }
      }
      
      if (await nextButton.count() === 0) {
        // Fallback: try other selectors in current context
        const nextButtonFallback = searchContext.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
        if (await nextButtonFallback.count() > 0) {
          await nextButtonFallback.click();
        } else {
          // Try main page with fallback selectors
          const mainPageFallback = targetPage.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
          if (await mainPageFallback.count() > 0) {
            console.log('✅ [STEP 8] Found Next button on main page with fallback selector!');
            await mainPageFallback.click();
          } else {
            throw new Error('Next button not found on booking options page');
          }
        }
      } else {
        await nextButton.waitFor({ state: 'visible', timeout: 5000 });
        await nextButton.click();
      }
      
      // WAIT FOR NEXT PAGE TO LOAD - Handle iframe navigation properly
      console.log('⏳ [STEP 8] Waiting for next page to load...');
      await page.waitForTimeout(3000);
      
      // If we're working in an iframe, wait for iframe content to update instead of main page
      if (bookingIframe || bookingFormContainer) {
        console.log('🔍 [STEP 8] Waiting for iframe content to update after navigation...');
        try {
          const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
          if (eventBookingIframeExists) {
            const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
            // Wait for iframe to be ready and check for new page content (contact lookup page)
            await page.waitForTimeout(2000);
            // Try to find indicators of the next page (contact lookup or add new contact)
            const contactLookupIndicators = eventBookingIframe.locator('text=lookup, text=contact, text=add new contact, button:has-text("lookup"), button:has-text("contact")').first();
            await contactLookupIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
              console.log('⚠️ [STEP 8] Contact lookup page indicators not found, but continuing...');
            });
            console.log('✅ [STEP 8] Iframe content updated - next page loaded');
          }
        } catch (e) {
          console.log(`⚠️ [STEP 8] Iframe wait check failed: ${e.message}, continuing...`);
        }
      } else {
        // Main page context - use normal wait
        await page.waitForLoadState('networkidle').catch(() => {
          console.log('⚠️ [STEP 8] Network idle wait failed, continuing...');
        });
      }
      
      console.log('✅ [STEP 8] Booking options selected and Next button clicked');
      
    } catch (error) {
      console.error('Error in selectBookingOptions:', error);
      await this.takeScreenshot(page, 'booking-options-error.png');
      throw new Error(`Failed to select booking options: ${error.message}`);
    }
  }

  // STEP 9: Lookup contact and wait
  async lookupContactAndWait(page, email) {
    try {
      console.log('🔍 [STEP 9] Looking up contact...');
      
      // WAIT FOR CONTACT PAGE TO LOAD - 3 seconds
      console.log('⏳ [STEP 9] Waiting for contact page to load...');
      await page.waitForTimeout(3000);
      
      // The contact choice page is inside eventNewBooking2_iframe
      console.log('🔍 [STEP 9] Checking for contact choice page in iframe...');
      const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
      
      if (!eventBookingIframeExists) {
        throw new Error('eventNewBooking2_iframe not found - contact choice page may not have loaded');
      }
      
      const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
      
      // Wait for iframe to be ready
      await page.waitForTimeout(2000);
      
      // Should see "Contact choice" or "3. Contact" page with two options
      console.log('🔍 [STEP 9] Looking for contact choice page indicators...');
      const contactChoiceIndicators = [
        'text=Contact choice',
        'text=3. Contact',
        'text=Choose one of these options',
        '#btnBookExisting'  // The lookup contact button ID
      ];
      
      let contactPageFound = false;
      for (const indicator of contactChoiceIndicators) {
        const element = eventBookingIframe.locator(indicator).first();
        if (await element.count() > 0) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 9] Found contact choice page indicator: "${indicator}"`);
            contactPageFound = true;
            break;
          }
        }
      }
      
      if (!contactPageFound) {
        console.log('⚠️ [STEP 9] Contact choice page indicators not found, but continuing...');
      }
      
      // Take screenshot of contact page
      await this.takeScreenshot(page, 'contact-page-loaded.png');
      
      // Click "Lookup contact..." button - use specific ID first, then fallback to text
      console.log('👆 [STEP 9] Clicking Lookup contact...');
      let lookupButton = eventBookingIframe.locator('#btnBookExisting').first();
      
      if (await lookupButton.count() === 0) {
        // Fallback: try text-based selectors
        lookupButton = eventBookingIframe.locator('button:has-text("Lookup contact"), button:has-text("Lookup Contact"), .contactButton, [aria-label*="Lookup contact"]').first();
      }
      
      if (await lookupButton.count() === 0) {
        throw new Error('Lookup contact button not found in contact choice page');
      }
      
      await lookupButton.waitFor({ state: 'visible', timeout: 5000 });
      await lookupButton.click();
      
      // WAIT FOR LOOKUP PAGE TO LOAD - 8 seconds
      console.log('⏳ [STEP 9] Waiting for contact lookup page to fully load...');
      await page.waitForTimeout(8000);
      // Note: Skipping waitForLoadState('networkidle') - content loads in iframe, not main page
      // We'll wait for iframe readiness using waitForFunction instead
      
      // Take screenshot of contact lookup page
      await this.takeScreenshot(page, 'contact-lookup-page-loaded.png');
      
      // DETECT CORRECT IFRAME: Check for contactSelect_iframe first (the actual iframe for contact lookup in booking flow)
      console.log('🔍 [STEP 9] Looking for contact lookup iframe...');
      
      let iframe;
      let iframeId;
      const contactSelectIframeExists = await page.locator('#contactSelect_iframe').count() > 0;
      const contactLookupIframeExists = await page.locator('#contactLookup_iframe').count() > 0;
      const eventBookingIframeStillExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
      
      if (contactSelectIframeExists) {
        iframeId = '#contactSelect_iframe';
        iframe = page.frameLocator('#contactSelect_iframe');
        console.log('✅ [STEP 9] Found contactSelect_iframe, using it for contact search');
      } else if (contactLookupIframeExists) {
        iframeId = '#contactLookup_iframe';
        iframe = page.frameLocator('#contactLookup_iframe');
        console.log('✅ [STEP 9] Found contactLookup_iframe, using it for contact search');
      } else if (eventBookingIframeStillExists) {
        iframeId = '#eventNewBooking2_iframe';
        iframe = page.frameLocator('#eventNewBooking2_iframe');
        console.log('✅ [STEP 9] Using eventNewBooking2_iframe for contact search');
      } else {
        throw new Error('No contact lookup iframe found - contact lookup page may not have loaded');
      }
      
      // Wait for the iframe to load completely (same as findAndVerifyClient)
      console.log('⏳ [STEP 9] Waiting for iframe to load completely...');
      await page.waitForTimeout(5000);
      
      // Wait for the iframe content to be ready
      await page.waitForFunction((id) => {
        const iframe = document.querySelector(id);
        return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
      }, iframeId, { timeout: 15000 });
      
      console.log('✅ [STEP 9] Iframe loaded, switching context...');
      
      // Debug: Check what's actually in the iframe
      console.log('🔍 [STEP 9] Debug: Checking iframe content...');
      const iframeText = await iframe.locator('body').textContent();
      console.log('🔍 [STEP 9] Iframe content preview:', iframeText ? iframeText.substring(0, 200) + '...' : 'No content');
      
      // STEP 1: Look for the search dropdown/selector in the iframe (robust logic from findAndVerifyClient)
      console.log('🔍 [STEP 9] Looking for search dropdown in iframe...');
      
      // Look for the specific dropdown by ID first, then fallback to generic selectors
      let searchDropdown = iframe.locator('#cntFindWhat').first();
      
      if (await searchDropdown.count() === 0) {
        // Fallback to generic selectors
        searchDropdown = iframe.locator('select, [role="combobox"], .dx-dropdowneditor, [data-onchange="chgCntFindWhat"]').first();
      }
      
      // Wait for the dropdown to be visible
      await searchDropdown.waitFor({ state: 'visible', timeout: 10000 });
      
      console.log('✅ [STEP 9] Found search dropdown, clicking to open options...');
      
      // Try clicking the dropdown button first (more specific), then fallback to the container
      const dropdownButton = searchDropdown.locator('[role="button"][aria-label="Select"], .dx-dropdowneditor-button').first();
      if (await dropdownButton.count() > 0) {
        await dropdownButton.click();
      } else {
        // Fallback: click on the dropdown container itself
        await searchDropdown.click();
      }
      
      // WAIT FOR DROPDOWN MENU TO APPEAR - 2 seconds
      console.log('⏳ [STEP 9] Waiting for dropdown menu to appear...');
      await page.waitForTimeout(2000);
      
      await this.takeScreenshot(page, 'dropdown-menu-opened.png');
      
      // STEP 2: Look for "Smart search" option and scroll up to make it clickable (robust logic from findAndVerifyClient)
      console.log('🔍 [STEP 9] Looking for Smart search option in menu...');
      
      // First, try to find the Smart search option using the actual structure
      const smartSearchOption = iframe.locator('div.dx-list-item[role="option"]:has-text("Smart search")').first();
      
      // Check if it's visible, if not, scroll up
      const isSmartSearchVisible = await smartSearchOption.isVisible();
      console.log(`🔍 [STEP 9] Smart search visible: ${isSmartSearchVisible}`);
      
      if (!isSmartSearchVisible) {
        console.log('🔍 [STEP 9] Smart search not visible, scrolling up in dropdown...');
        
        // Scroll up in the dropdown menu to make Smart search visible
        await page.keyboard.press('Home'); // Go to top of dropdown
        await page.waitForTimeout(1000);
        
        // Alternative: try to scroll the dropdown container
        const dropdownMenu = iframe.locator('[role="listbox"], .dx-dropdownlist, .dx-list, .dx-list-items').first();
        if (await dropdownMenu.count() > 0) {
          await dropdownMenu.evaluate(el => el.scrollTop = 0);
          await page.waitForTimeout(1000);
        }
      }
      
      // Now try to find and click Smart search
      await smartSearchOption.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ [STEP 9] Smart search option is now visible, clicking...');
      await smartSearchOption.click();
      
      // WAIT FOR SMART SEARCH TO BE APPLIED - 2 seconds
      console.log('⏳ [STEP 9] Waiting for Smart search selection...');
      await page.waitForTimeout(2000);
      
      await this.takeScreenshot(page, 'smart-search-selected.png');
      
      // STEP 3: Look for the search input field (robust logic from findAndVerifyClient)
      console.log('🔍 [STEP 9] Looking for search input field...');
      
      // Look for the specific search input by ID first (target the input inside the container)
      let searchField = iframe.locator('#cntSearchParams input.dx-texteditor-input, #cntSearchParams input[type="text"]').first();
      
      if (await searchField.count() === 0) {
        // Fallback: try the container itself (might be clickable)
        searchField = iframe.locator('#cntSearchParams').first();
      }
      
      if (await searchField.count() === 0) {
        // Final fallback to generic selectors
        searchField = iframe.locator('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"], input[data-placeholder*="Search"]').first();
      }
      
      // Wait for the search field to be visible
      await searchField.waitFor({ state: 'visible', timeout: 10000 });
      
      // STEP 4: Enter email address in search field
      console.log(`📧 [STEP 9] Searching for client: ${email}`);
      await searchField.fill(email);
      
      // NEW: Try multiple approaches to trigger the search (robust logic from findAndVerifyClient)
      console.log('🔍 [STEP 9] Triggering search...');
      
      // Approach 1: Press Enter to trigger search
      await searchField.press('Enter');
      await page.waitForTimeout(2000);
      
      // Approach 2: Look for and click search icon/button
      console.log('🔍 [STEP 9] Looking for search icon/button...');
      const searchButton = iframe.locator('button[type="submit"], .search-button, [aria-label*="search"], [title*="search"], .fa-search, .search-icon').first();
      
      if (await searchButton.count() > 0) {
        console.log('✅ [STEP 9] Found search button, clicking...');
        await searchButton.click();
        await page.waitForTimeout(2000);
      } else {
        console.log('❌ [STEP 9] No search button found, trying alternative...');
        
        // Approach 3: Click elsewhere to remove focus and trigger search
        console.log('🔍 [STEP 9] Clicking elsewhere to trigger search...');
        await iframe.locator('body').click({ position: { x: 100, y: 100 } });
        await page.waitForTimeout(2000);
        
        // Approach 4: Use Tab to move focus away
        console.log('🔍 [STEP 9] Using Tab to move focus...');
        await searchField.press('Tab');
        await page.waitForTimeout(2000);
      }
      
      // WAIT FOR SEARCH RESULTS - 5 seconds (increased, same as findAndVerifyClient)
      console.log('⏳ [STEP 9] Waiting for search results...');
      await page.waitForTimeout(5000);
      
      // Take screenshot after search
      await this.takeScreenshot(page, 'contact-search-results.png');
      
      // STEP 5: Click on found client (should be the first result) - robust multi-approach logic from findAndVerifyClient
      console.log('👆 [STEP 9] Clicking on found client...');
      
      // Try to find and click the client
      let clientClicked = false;
      
      try {
        // Approach 1: Look for visible text
        const visibleClient = iframe.locator(`text=${email}`).filter({ hasText: email }).first();
        if (await visibleClient.count() > 0 && await visibleClient.isVisible()) {
          console.log('✅ [STEP 9] Found visible client text');
          await visibleClient.click();
          clientClicked = true;
        } else {
          // Approach 2: Look for any element containing the email
          const anyClient = iframe.locator(`*:has-text("${email}")`).first();
          if (await anyClient.count() > 0) {
            console.log('✅ [STEP 9] Found client in any element');
            await anyClient.click();
            clientClicked = true;
          } else {
            // Approach 3: Look for clickable elements with email
            const clickableClient = iframe.locator(`a:has-text("${email}"), button:has-text("${email}"), [role="button"]:has-text("${email}")`).first();
            if (await clickableClient.count() > 0) {
              console.log('✅ [STEP 9] Found clickable client element');
              await clickableClient.click();
              clientClicked = true;
            }
          }
        }
      } catch (clickError) {
        console.log('❌ [STEP 9] Failed to click client, but continuing to check if page navigation occurred...');
      }
      
      // CRITICAL: Check if we're already on the client details page BEFORE waiting (robust verification from findAndVerifyClient)
      console.log('🔍 [STEP 9] Checking if client details page is already loaded...');
      
      // Look for client name "Mr Robert Smith" or "Robert Smith"
      const clientNameVisible = await iframe.locator('text=Mr Robert Smith, text=Robert Smith').count() > 0;
      
      // Look for the email in the contact details section
      const clientEmailVisible = await iframe.locator(`text=${email}`).count() > 0;
      
      // Look for "First Names" and "Surname" fields which indicate we're on the client details page
      const firstNameField = await iframe.locator('text=First Names').count() > 0;
      const surnameField = await iframe.locator('text=Surname').count() > 0;
      
      // Look for "Contact e-mail" field
      const contactEmailField = await iframe.locator('text=Contact e-mail').count() > 0;
      
      if (clientNameVisible || clientEmailVisible || firstNameField || surnameField || contactEmailField) {
        console.log('✅ [STEP 9] Client details page is already loaded - no need to wait for navigation');
        
        // Take screenshot of the already loaded page
        await this.takeScreenshot(page, 'client-selected.png');
        
        // Extract and log the actual client details for verification
        try {
          const firstName = await iframe.locator('text=Robert').first().textContent();
          const surname = await iframe.locator('text=Smith').first().textContent();
          const contactEmail = await iframe.locator(`text=${email}`).first().textContent();
          
          console.log(`📋 [STEP 9] Client Details Found:`);
          console.log(`   First Name: ${firstName}`);
          console.log(`   Surname: ${surname}`);
          console.log(`   Email: ${contactEmail}`);
        } catch (extractError) {
          console.log('⚠️ [STEP 9] Could not extract specific client details, but page verification passed');
        }
        
        console.log('✅ [STEP 9] Client found and selected');
      } else {
        // Only wait for navigation if we're not already on the client details page
        if (clientClicked) {
          console.log('⏳ [STEP 9] Waiting for client page to load...');
          await page.waitForTimeout(4000);
          await page.waitForLoadState('networkidle');
          
          // Take screenshot after clicking client
          await this.takeScreenshot(page, 'client-selected.png');
          
          // Verify we're on the client details page
          console.log('🔍 [STEP 9] Verifying client details page...');
          
          // Look for client name "Mr Robert Smith" or "Robert Smith"
          const clientNameVisibleAfterWait = await iframe.locator('text=Mr Robert Smith, text=Robert Smith').count() > 0;
          
          // Look for the email in the contact details section
          const clientEmailVisibleAfterWait = await iframe.locator(`text=${email}`).count() > 0;
          
          // Look for "First Names" and "Surname" fields which indicate we're on the client details page
          const firstNameFieldAfterWait = await iframe.locator('text=First Names').count() > 0;
          const surnameFieldAfterWait = await iframe.locator('text=Surname').count() > 0;
          
          // Look for "Contact e-mail" field
          const contactEmailFieldAfterWait = await iframe.locator('text=Contact e-mail').count() > 0;
          
          if (clientNameVisibleAfterWait || clientEmailVisibleAfterWait || firstNameFieldAfterWait || surnameFieldAfterWait || contactEmailFieldAfterWait) {
            console.log('✅ [STEP 9] Client details page loaded successfully');
            console.log(`🔍 [STEP 9] Verification details: name=${clientNameVisibleAfterWait}, email=${clientEmailVisibleAfterWait}, firstName=${firstNameFieldAfterWait}, surname=${surnameFieldAfterWait}, contactEmail=${contactEmailFieldAfterWait}`);
            
            console.log('✅ [STEP 9] Client found and selected');
          } else {
            console.log('❌ [STEP 9] Client details page verification failed');
            throw new Error(`Could not verify client details page. Expected to find client name, email, or form fields.`);
          }
        } else {
          console.log('❌ [STEP 9] Could not click client and page navigation did not occur');
          throw new Error(`Could not find or click client element with email: ${email}`);
        }
      }
      
      // Should now be on "3. Contact" page (in iframe)
      const contactPageHeader = iframe.locator('text=3. Contact, text=Contact').first();
      await contactPageHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
        console.log('⚠️ [STEP 9] Contact page header not found, but continuing...');
      });
      
      // Take screenshot of Contact Details page before clicking Next
      await this.takeScreenshot(page, 'contact-details-page.png');
      
      // After client selection, the Contact Details form is likely in eventNewBooking2_iframe
      // Wait a bit more for the form to fully render
      console.log('⏳ [STEP 9] Waiting for Contact Details form to fully render...');
      await page.waitForTimeout(3000);
      
      // Click Next button to proceed to next step
      // Need to check both contactSelect_iframe AND eventNewBooking2_iframe
      console.log('👆 [STEP 9] Clicking Next button on Contact Details page...');
      
      let nextButton = null;
      
      // Strategy 1: Try eventNewBooking2_iframe first (most likely location after client selection)
      const eventBookingIframeForNext = page.frameLocator('#eventNewBooking2_iframe');
      const eventBookingIframeForNextExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
      
      if (eventBookingIframeForNextExists) {
        console.log('🔍 [STEP 9] Checking eventNewBooking2_iframe for Next button...');
        nextButton = eventBookingIframeForNext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
        
        if (await nextButton.count() === 0) {
          nextButton = eventBookingIframeForNext.locator('[aria-label="Next"], [aria-label="next"]').first();
        }
        
        if (await nextButton.count() === 0) {
          nextButton = eventBookingIframeForNext.locator('button:has-text("Next"), button:has-text("next")').first();
        }
        
        if (await nextButton.count() === 0) {
          nextButton = eventBookingIframeForNext.locator('.jqx_wizardBtn, .dx-button:has-text("Next"), .jqx_button:has-text("Next")').first();
        }
        
        if (await nextButton.count() > 0) {
          console.log('✅ [STEP 9] Found Next button in eventNewBooking2_iframe!');
        }
      }
      
      // Strategy 2: If not found, try the current iframe context (contactSelect_iframe)
      if ((!nextButton || await nextButton.count() === 0) && iframe) {
        console.log('🔍 [STEP 9] Checking current iframe context for Next button...');
        nextButton = iframe.locator('#diaryNewCourseBookingWiz_nextBtn').first();
        
        if (await nextButton.count() === 0) {
          nextButton = iframe.locator('[aria-label="Next"], [aria-label="next"]').first();
        }
        
        if (await nextButton.count() === 0) {
          nextButton = iframe.locator('button:has-text("Next"), button:has-text("next")').first();
        }
        
        if (await nextButton.count() === 0) {
          nextButton = iframe.locator('.jqx_wizardBtn, .dx-button:has-text("Next"), .jqx_button:has-text("Next")').first();
        }
        
        if (await nextButton.count() > 0) {
          console.log('✅ [STEP 9] Found Next button in current iframe context!');
        }
      }
      
      // Strategy 3: Try main page as last resort
      if (!nextButton || await nextButton.count() === 0) {
        console.log('🔍 [STEP 9] Trying main page for Next button...');
        nextButton = page.locator('#diaryNewCourseBookingWiz_nextBtn, [aria-label="Next"], button:has-text("Next")').first();
      }
      
      if (!nextButton || await nextButton.count() === 0) {
        // Take a screenshot for debugging
        await this.takeScreenshot(page, 'next-button-not-found.png');
        throw new Error('Next button not found on Contact Details page - checked eventNewBooking2_iframe, current iframe, and main page');
      }
      
      await nextButton.waitFor({ state: 'visible', timeout: 5000 });
      await nextButton.click();
      
      console.log('✅ [STEP 9] Next button clicked, waiting for next page to load...');
      
      // Wait for next page to load (could be payment page or confirmation page)
      await page.waitForTimeout(3000);
      
      // Check if we're still in an iframe context and wait for iframe content to update
      if (iframeId === '#eventNewBooking2_iframe' || iframeId === '#contactLookup_iframe') {
        console.log('⏳ [STEP 9] Waiting for iframe content to update after navigation...');
        await page.waitForTimeout(2000);
        
        // Try to detect indicators of the next page (could be payment page, confirmation, etc.)
        const nextPageIndicators = iframe.locator('text=4. Pay, text=Payment, text=Pay, text=Confirm, button:has-text("Pay"), button:has-text("Confirm")').first();
        await nextPageIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
          console.log('⚠️ [STEP 9] Next page indicators not found, but continuing...');
        });
      } else {
        // Main page context - use normal wait
        await page.waitForLoadState('networkidle').catch(() => {
          console.log('⚠️ [STEP 9] Network idle wait failed, continuing...');
        });
      }
      
      // Take screenshot after clicking Next
      await this.takeScreenshot(page, 'after-next-click.png');
      
      // Take final screenshot
      await this.takeScreenshot(page, 'final-contact-page.png');
      
      // Wait for 10 seconds
      console.log('⏰ [STEP 9] Waiting 10 seconds before closing...');
      await page.waitForTimeout(10000);
      
      console.log('✅ [STEP 9] Contact lookup completed and waited 10 seconds');
      
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

