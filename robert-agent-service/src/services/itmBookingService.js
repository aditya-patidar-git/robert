import fs from 'fs';
import * as commonSteps from './commonBookingSteps/index.js';

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

  async executeITMBookingDemo(page, bookingArgs = {}, callContext = {}) {
    const screenshots = [];
    let sessionDetails = null;

    try {
      console.log('🚀 Starting ITM booking demo workflow...');
      console.log('🔍 Service: Current page URL:', page.url());
      console.log('🔍 Service: Page title:', await page.title());

      // STEP 1: Check availability and note details (ITM-specific)
      console.log('📅 Step 1: Checking ITM availability...');
      sessionDetails = await this.checkAvailabilityAndNoteDetails(page);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-1-availability.png', this.screenshotsDir));
      console.log('✅ Step 1 completed:', sessionDetails);

      // STEP 2: Login to CRM (common)
      console.log('🔐 Step 2: Logging into CRM...');
      await commonSteps.loginToCRM(page, this.crmCredentials, this.screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-login-success.png', this.screenshotsDir));
      console.log('✅ Step 2 completed: Login successful');

      // STEP 3-5: Find and verify existing client (common)
      console.log('👤 Step 3-5: Finding and verifying client...');
      const clientEmail = bookingArgs.customerEmail || process.env.CLIENT_EMAIL_ADDRESS;
      console.log('🔍 Service: Using client email:', clientEmail);
      await commonSteps.findAndVerifyClient(page, clientEmail, this.screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-3-5-client-found.png', this.screenshotsDir));
      console.log('✅ Step 3-5 completed: Client verified');

      // STEP 6-7: Navigate to Diaries and select session (common)
      console.log('📅 Step 6-7: Navigating to Diaries and selecting session...');
      await commonSteps.navigateToDiariesAndSelectSession(page, sessionDetails, this.screenshotsDir);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-6-7-session-selected.png', this.screenshotsDir));
      console.log('✅ Step 6-7 completed: Session selected');

      // STEP 8: Select booking options (ITM-specific)
      console.log('⚙️ Step 8: Selecting ITM booking options...');
      await this.selectBookingOptions(page, bookingArgs);
      screenshots.push(await commonSteps.takeScreenshot(page, 'step-8-options-selected.png', this.screenshotsDir));
      console.log('✅ Step 8 completed: Booking options selected');

      // STEP 9: Lookup contact and wait (common)
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
      console.error('❌ ITM booking demo failed at step:', error.message);
      console.error('❌ Service: Error stack:', error.stack);
      screenshots.push(await commonSteps.takeScreenshot(page, 'error-state.png', this.screenshotsDir));
      
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

  // STEP 8: Select booking options (ITM-specific)
  async selectBookingOptions(page, bookingArgs = {}) {
    try {
      console.log('⚙️ [STEP 8] Selecting ITM booking options...');
      
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
        await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', this.screenshotsDir);
      } else {
        // Wait for price header to be visible
        await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
          console.log('⚠️ [STEP 8] Price header visibility check timed out, continuing...');
        });
        
        // Take screenshot of price page
        await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', this.screenshotsDir);
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
        await commonSteps.takeScreenshot(targetPage, this.screenshotsDir, 'booking-options-not-found.png');
        throw new Error('No selectable booking options found on price page');
      }
      
      console.log(`✅ [STEP 8] Selected ${selectedCount} option(s) from booking form`);
      
      // Wait for selection to register
      await page.waitForTimeout(1000);
      
      // Take screenshot after selection
      await commonSteps.takeScreenshot(targetPage, this.screenshotsDir, 'bike-option-selected.png');
      
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
      await commonSteps.takeScreenshot(page, 'booking-options-error.png', this.screenshotsDir);
      throw new Error(`Failed to select booking options: ${error.message}`);
    }
  }
}

export default new ITMBookingService();

