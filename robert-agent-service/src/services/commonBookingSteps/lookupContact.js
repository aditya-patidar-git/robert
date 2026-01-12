import { takeScreenshot, cleanEmail } from './utils.js';

/**
 * Step 9: Lookup contact and wait
 * @param {Page} page - Playwright page object
 * @param {string} email - Client email address to lookup (may contain "Copy" text)
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} [clientPostcode] - Optional postcode for verification when multiple results appear
 * @param {boolean} [skipNextClick] - If true, skip clicking Next button (for address confirmation flow)
 */
export async function lookupContactAndWait(page, email, screenshotsDir, clientPostcode = null, skipNextClick = false) {
  try {
    console.log('🔍 [STEP 9] Looking up contact...');
    
    // CRITICAL: Clean email before using it (remove "Copy" button text if present)
    const cleanedEmail = cleanEmail(email);
    if (!cleanedEmail) {
      throw new Error(`Invalid email address provided: ${email}`);
    }
    
    if (cleanedEmail !== email) {
      console.log(`🧹 [STEP 9] Cleaned email: "${email}" → "${cleanedEmail}"`);
    }
    
    // Use cleaned email for all operations
    email = cleanedEmail;
    
    // CRITICAL: FIRST check if we're already on the client details page
    // This prevents re-trying the lookup flow if the client was already selected
    console.log('🔍 [STEP 9] Checking if already on client details page...');
    await page.waitForTimeout(2000); // Brief wait for page to stabilize
    
    const eventBookingIframeExistsEarly = await page.locator('#eventNewBooking2_iframe').count() > 0;
    const contactSelectIframeExistsEarly = await page.locator('#contactSelect_iframe').count() > 0;
    
    if (eventBookingIframeExistsEarly || contactSelectIframeExistsEarly) {
      const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
      const contactSelectIframe = contactSelectIframeExistsEarly ? page.frameLocator('#contactSelect_iframe') : null;
      
      // Check multiple indicators that we're already on client details page
      const alreadyOnClientDetails = 
        (await eventBookingIframe.locator('text=First Names').count() > 0) ||
        (await eventBookingIframe.locator('text=Surname').count() > 0) ||
        (await eventBookingIframe.locator('text=Contact e-mail').count() > 0) ||
        (await eventBookingIframe.locator(`text=${email}`).count() > 0) ||
        (contactSelectIframe && await contactSelectIframe.locator('text=First Names').count() > 0) ||
        (contactSelectIframe && await contactSelectIframe.locator('text=Surname').count() > 0);
      
      if (alreadyOnClientDetails) {
        console.log('✅ [STEP 9] ============================================');
        console.log('✅ [STEP 9] ALREADY ON CLIENT DETAILS PAGE!');
        console.log(`✅ [STEP 9] Client with email ${email} was previously selected successfully.`);
        console.log('✅ [STEP 9] Client details page is already loaded.');
        
        // CRITICAL FIX: Respect skipNextClick parameter
        if (skipNextClick) {
          console.log('⏸️ [STEP 9] Skipping Next button click (skipNextClick=true) - house number may need to be filled first');
          console.log('✅ [STEP 9] ============================================');
          await takeScreenshot(page, 'client-already-selected.png', screenshotsDir);
          return; // Return early without clicking Next
        }
        
        // Also check if house number field is empty - if so, don't click Next yet
        // This allows fillContactDetails to fill the house number first
        try {
          const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
          const houseNumberField = eventBookingIframe.locator('#cmp_buildingnumber .dx-texteditor-input');
          
          if (await houseNumberField.count() > 0) {
            const houseNumberValue = await houseNumberField.inputValue().catch(() => '');
            if (!houseNumberValue || houseNumberValue.trim() === '') {
              console.log('⏸️ [STEP 9] House number field is empty - skipping Next button click to allow fillContactDetails to fill it first');
              console.log('✅ [STEP 9] ============================================');
              await takeScreenshot(page, 'client-already-selected.png', screenshotsDir);
              return; // Return early without clicking Next - let fillContactDetails handle house number first
            }
          }
        } catch (checkError) {
          // If we can't check the house number field, continue with Next button click
          console.log(`⚠️ [STEP 9] Could not check house number field: ${checkError.message}, proceeding with Next button click`);
        }
        
        console.log('✅ [STEP 9] Skipping lookup flow and proceeding directly to Next button...');
        console.log('✅ [STEP 9] ============================================');
        
        await takeScreenshot(page, 'client-already-selected.png', screenshotsDir);
        
        // Proceed directly to Next button click (skip entire lookup flow)
        // Use the iframe that exists
        const iframeForNext = eventBookingIframeExistsEarly ? eventBookingIframe : contactSelectIframe;
        const iframeIdForNext = eventBookingIframeExistsEarly ? '#eventNewBooking2_iframe' : '#contactSelect_iframe';
        
        // Wait for form to render
        console.log('⏳ [STEP 9] Waiting for Contact Details form to fully render...');
        await page.waitForTimeout(3000);
        
        // Click Next button
        console.log('👆 [STEP 9] Clicking Next button on Contact Details page...');
        
        let nextButton = iframeForNext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
        
        if (await nextButton.count() === 0) {
          nextButton = iframeForNext.locator('[aria-label="Next"], [aria-label="next"]').first();
        }
        
        if (await nextButton.count() === 0) {
          nextButton = iframeForNext.locator('button:has-text("Next"), button:has-text("next")').first();
        }
        
        if (await nextButton.count() === 0) {
          nextButton = iframeForNext.locator('.jqx_wizardBtn, .dx-button:has-text("Next"), .jqx_button:has-text("Next")').first();
        }
        
        if (await nextButton.count() === 0) {
          // Try main page as fallback
          nextButton = page.locator('#diaryNewCourseBookingWiz_nextBtn, [aria-label="Next"], button:has-text("Next")').first();
        }
        
        if (await nextButton.count() === 0) {
          await takeScreenshot(page, 'next-button-not-found-skip.png', screenshotsDir);
          throw new Error('Next button not found on Contact Details page');
        }
        
        await nextButton.waitFor({ state: 'attached', timeout: 10000 });
        console.log('✅ [STEP 9] Next button is attached to DOM');
        
        // CRITICAL: Use JavaScript click (same approach as normal flow) - works even if button is not visible
        // This ensures reliable clicking and immediate return after success
        console.log('👆 [STEP 9] Clicking Next button using JavaScript (bypasses visibility checks)...');
        
        // Determine which iframe to use for JavaScript evaluation (same pattern as normal flow)
        let targetFrame = null;
        if (eventBookingIframeExistsEarly) {
          try {
            const frameElement = await page.$('#eventNewBooking2_iframe');
            if (frameElement) {
              targetFrame = await frameElement.contentFrame();
            }
          } catch (e) {
            console.log(`⚠️ [STEP 9] Could not get eventNewBooking2_iframe for evaluation: ${e.message}`);
          }
        }
        
        if (!targetFrame && contactSelectIframeExistsEarly) {
          try {
            const frameElement = await page.$('#contactSelect_iframe');
            if (frameElement) {
              targetFrame = await frameElement.contentFrame();
            }
          } catch (e) {
            console.log(`⚠️ [STEP 9] Could not get contactSelect_iframe for evaluation: ${e.message}`);
          }
        }
        
        if (targetFrame) {
          try {
            const clickSuccess = await targetFrame.evaluate(() => {
              const btn = document.querySelector('#diaryNewCourseBookingWiz_nextBtn');
              if (btn) {
                btn.click();
                return true;
              }
              // Try alternative selectors
              const altBtn = document.querySelector('[aria-label="Next"], [aria-label="next"]');
              if (altBtn) {
                altBtn.click();
                return true;
              }
              return false;
            });
            
            if (clickSuccess) {
              console.log('✅ [STEP 9] ============================================');
              console.log('✅ [STEP 9] SUCCESS: Next button clicked successfully!');
              console.log(`✅ [STEP 9] Client: ${email}`);
              console.log('✅ [STEP 9] Contact details step completed.');
              console.log('✅ [STEP 9] IMMEDIATELY proceeding to payment step.');
              console.log('✅ [STEP 9] ============================================');
              
              // CRITICAL: Return immediately after successful click - no delays, no screenshots, no further checks
              return; // Early return - skip all lookup flow and any further processing
            }
          } catch (jsErr) {
            console.log(`⚠️ [STEP 9] JavaScript click failed: ${jsErr.message}, trying Playwright click as fallback...`);
          }
        }
        
        // Fallback to Playwright click only if JavaScript fails or frame not available
        const isVisible = await nextButton.isVisible().catch(() => false);
        if (isVisible) {
          await nextButton.click({ timeout: 5000 });
          console.log('✅ [STEP 9] Clicked Next button (Playwright fallback - visible)');
        } else {
          await nextButton.click({ force: true, timeout: 5000 });
          console.log('✅ [STEP 9] Clicked Next button (Playwright fallback - force)');
        }
        
        console.log('✅ [STEP 9] ============================================');
        console.log('✅ [STEP 9] SUCCESS: Contact details step completed!');
        console.log(`✅ [STEP 9] Client: ${email}`);
        console.log('✅ [STEP 9] Next button clicked successfully.');
        console.log('✅ [STEP 9] Ready to proceed to payment step.');
        console.log('✅ [STEP 9] ============================================');
        
        // Return immediately after successful click
        return; // Early return - skip all lookup flow
      }
    }
    
    // WAIT FOR CONTACT PAGE TO LOAD - 3 seconds
    console.log('⏳ [STEP 9] Waiting for contact page to load...');
    await page.waitForTimeout(3000);
    
    // The contact choice page is inside eventNewBooking2_iframe
    console.log('🔍 [STEP 9] Checking for contact choice page in iframe...');
    const eventBookingIframeExistsCheck = await page.locator('#eventNewBooking2_iframe').count() > 0;
    
    if (!eventBookingIframeExistsCheck) {
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
    await takeScreenshot(page, 'contact-page-loaded.png', screenshotsDir);
    
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
    
    // FIX: Wait for button to be attached (not visible, as it may be hidden but still clickable)
    try {
      await lookupButton.waitFor({ state: 'attached', timeout: 10000 });
      console.log('✅ [STEP 9] Lookup contact button is attached to DOM');
      
      // Try to scroll button into view
      try {
        await lookupButton.scrollIntoViewIfNeeded({ timeout: 2000 });
        console.log('✅ [STEP 9] Scrolled Lookup contact button into view');
      } catch (scrollErr) {
        console.log('⚠️ [STEP 9] Could not scroll Lookup contact button into view:', scrollErr.message);
      }
      
      // Check if button is visible
      const isVisible = await lookupButton.isVisible().catch(() => false);
      
      if (isVisible) {
        // Button is visible, click normally
        await lookupButton.click({ timeout: 5000 });
        console.log('✅ [STEP 9] Clicked Lookup contact button (visible)');
      } else {
        // Button is hidden, use force click (button exists in DOM and is clickable)
        console.log('⚠️ [STEP 9] Lookup contact button is hidden, using force click');
        await lookupButton.click({ force: true, timeout: 5000 });
        console.log('✅ [STEP 9] Clicked Lookup contact button (force)');
      }
    } catch (clickErr) {
      // Handle browser closure or other errors gracefully
      if (clickErr.message.includes('Target page, context or browser has been closed')) {
        console.log('⚠️ [STEP 9] Browser was closed during Lookup contact button click');
        throw new Error('Browser was closed - cannot proceed with Lookup contact button click');
      }
      // Re-throw other errors
      throw clickErr;
    }
    
    // WAIT FOR LOOKUP PAGE TO LOAD - 8 seconds
    console.log('⏳ [STEP 9] Waiting for contact lookup page to fully load...');
    await page.waitForTimeout(8000);
    
    // Take screenshot of contact lookup page
    await takeScreenshot(page, 'contact-lookup-page-loaded.png', screenshotsDir);
    
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
    
    await takeScreenshot(page, 'dropdown-menu-opened.png', screenshotsDir);
    
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
    
    await takeScreenshot(page, 'smart-search-selected.png', screenshotsDir);
    
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
      
      // Approach 3: Safer approach - Use JavaScript to blur the input field directly
      console.log('🔍 [STEP 9] Blurring search input field to trigger search...');
      try {
        const frameElement = await page.$(iframeId);
        if (frameElement) {
          const actualFrame = await frameElement.contentFrame();
          if (actualFrame) {
            await actualFrame.evaluate(() => {
              const activeElement = document.activeElement;
              if (activeElement && activeElement.tagName === 'INPUT') {
                activeElement.blur();
              }
            });
            console.log('✅ [STEP 9] Blurred search input field using JavaScript');
          }
        }
      } catch (e) {
        console.log(`⚠️ [STEP 9] Could not blur input: ${e.message}, trying container click...`);
        // Fallback: Try clicking on a safe container
        const safeContainer = iframe.locator('.jqx_pageContent, .dx-widget, [class*="container"]').first();
        if (await safeContainer.count() > 0) {
          await safeContainer.click({ position: { x: 10, y: 10 }, force: true });
          console.log('✅ [STEP 9] Clicked on safe container');
        } else {
          // Last resort: Click on body at top-left corner (less likely to hit interactive elements)
          await iframe.locator('body').click({ position: { x: 10, y: 10 }, force: true });
          console.log('⚠️ [STEP 9] Clicked on body as last resort');
        }
      }
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
    await takeScreenshot(page, 'contact-search-results.png', screenshotsDir);
    
    // STEP 5: Click on found client - use robust logic from findAndVerifyClient.js
    console.log('👆 [STEP 9] Clicking on found client...');
    
    // Normalize email for comparison (lowercase, trim)
    const normalizedSearch = email.toLowerCase().trim();
    
    // Look for DevExtreme DataGrid table rows (based on actual HTML structure)
    const resultRows = iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
    const rowCount = await resultRows.count();
    
    console.log(`🔍 [STEP 9] Found ${rowCount} search result rows, looking for email matches...`);
    
    // Extract all rows that contain the email (per document: Smart search matches loosely)
    const matchingRows = [];
    for (let i = 0; i < rowCount; i++) {
      const row = resultRows.nth(i);
      
      // Extract email using specific selector (based on actual HTML structure)
      // Email is in: .jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Email:")) .jqx_inlineSummaryText span
      let foundEmail = null;
      try {
        const emailSpan = row.locator('.jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Email:")) .jqx_inlineSummaryText span');
        if (await emailSpan.count() > 0) {
          let emailText = await emailSpan.textContent();
          if (emailText) {
            // Use cleanEmail utility to properly remove "Copy" button text
            foundEmail = cleanEmail(emailText);
          }
        }
      } catch (e) {
        console.log(`⚠️ [STEP 9] Could not extract email from row ${i + 1}:`, e.message);
      }
      
      if (foundEmail) {
        const normalizedEmail = foundEmail.toLowerCase().trim();
        // Smart search matches loosely, so check if searched email is contained in found email or vice versa
        const emailMatches = normalizedEmail === normalizedSearch || 
                             normalizedEmail.includes(normalizedSearch) || 
                             normalizedSearch.includes(normalizedEmail);
        
        if (emailMatches) {
          console.log(`✅ [STEP 9] Found email match in row ${i + 1}: ${foundEmail}`);
          
          // Extract postcode using specific selector (based on actual HTML structure)
          // Postcode is in: div.jqx_margin_right + div[style*="display:inline-block"] > span
          let postcode = null;
          try {
            const postcodeSpan = row.locator('div.jqx_margin_right + div[style*="display:inline-block"] > span');
            if (await postcodeSpan.count() > 0) {
              const postcodeText = await postcodeSpan.textContent();
              // Postcode may be in full address (e.g., "89 Brook Road, London, Greater London, NW2 7DS")
              // Extract the last UK postcode pattern from the text
              const postcodeMatch = postcodeText.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi);
              if (postcodeMatch && postcodeMatch.length > 0) {
                // Get the last match (postcode is usually at the end of address)
                postcode = postcodeMatch[postcodeMatch.length - 1].trim();
                console.log(`📍 [STEP 9] Extracted postcode from row ${i + 1}: ${postcode}`);
              }
            }
          } catch (e) {
            console.log(`⚠️ [STEP 9] Could not extract postcode from row ${i + 1}:`, e.message);
          }
          
          matchingRows.push({
            rowIndex: i,  // Store index instead of locator to avoid stale locator issues
            email: foundEmail,
            postcode: postcode,
            index: i
          });
        }
      }
    }
    
    console.log(`📊 [STEP 9] Found ${matchingRows.length} rows with matching email`);
    
    if (matchingRows.length === 0) {
      throw new Error(`No email matches found in search results for: ${email}`);
    }
    
    // Handle multiple matches with postcode verification (similar to findAndVerifyClient.js)
    let exactMatch = null;
    
    if (matchingRows.length === 1) {
      // Single match - can proceed directly
      console.log('✅ [STEP 9] Single email match found, proceeding...');
      exactMatch = {
        rowIndex: matchingRows[0].rowIndex,
        locator: resultRows.nth(matchingRows[0].rowIndex)
      };
    } else {
      // Multiple matches - need to verify email + postcode per document requirements
      console.log(`⚠️ [STEP 9] Multiple email matches found (${matchingRows.length}). Per document, verifying email + postcode.`);
      console.log('📋 [STEP 9] Extracted matches:');
      matchingRows.forEach((match, idx) => {
        console.log(`   ${idx + 1}. Email: ${match.email}, Postcode: ${match.postcode || 'Not visible in search results'}`);
      });
      
      // Try to find exact email match first
      const exactEmailMatch = matchingRows.find(m => {
        const matchEmail = cleanEmail(m.email);
        return matchEmail && matchEmail.toLowerCase().trim() === normalizedSearch;
      });
      
      if (exactEmailMatch) {
        // Exact email match found
        if (clientPostcode && exactEmailMatch.postcode) {
          // Verify postcode matches
          const extractedPostcode = exactEmailMatch.postcode.toUpperCase().replace(/\s+/g, '').trim();
          const searchPostcode = clientPostcode.toUpperCase().replace(/\s+/g, '').trim();
          const postcodeMatches = extractedPostcode === searchPostcode;
          
          if (postcodeMatches) {
            console.log(`✅ [STEP 9] Found exact email match with matching postcode at row ${exactEmailMatch.rowIndex + 1}`);
            exactMatch = {
              rowIndex: exactEmailMatch.rowIndex,
              locator: resultRows.nth(exactEmailMatch.rowIndex)
            };
          } else {
            console.log(`⚠️ [STEP 9] Exact email match found but postcode doesn't match. Searched: "${searchPostcode}", Found: "${extractedPostcode}"`);
            // Still use this match but log warning (per document: verify both, but if only one matches, use it)
            exactMatch = {
              rowIndex: exactEmailMatch.rowIndex,
              locator: resultRows.nth(exactEmailMatch.rowIndex)
            };
          }
        } else {
          // No postcode provided or not visible - use exact email match
          console.log(`✅ [STEP 9] Found exact email match at row ${exactEmailMatch.rowIndex + 1} (no postcode verification available)`);
          exactMatch = {
            rowIndex: exactEmailMatch.rowIndex,
            locator: resultRows.nth(exactEmailMatch.rowIndex)
          };
        }
      } else {
        // No exact email match - try to match by postcode if available
        if (clientPostcode) {
          const postcodeMatch = matchingRows.find(m => {
            if (!m.postcode) return false;
            const extractedPostcode = m.postcode.toUpperCase().replace(/\s+/g, '').trim();
            const searchPostcode = clientPostcode.toUpperCase().replace(/\s+/g, '').trim();
            return extractedPostcode === searchPostcode;
          });
          
          if (postcodeMatch) {
            console.log(`✅ [STEP 9] Found match with matching postcode at row ${postcodeMatch.rowIndex + 1}`);
            exactMatch = {
              rowIndex: postcodeMatch.rowIndex,
              locator: resultRows.nth(postcodeMatch.rowIndex)
            };
          } else {
            // No postcode match - use first match with warning
            console.log(`⚠️ [STEP 9] No exact email or postcode match, using first match at row ${matchingRows[0].rowIndex + 1}`);
            exactMatch = {
              rowIndex: matchingRows[0].rowIndex,
              locator: resultRows.nth(matchingRows[0].rowIndex)
            };
          }
        } else {
          // No postcode provided - use first match
          console.log(`⚠️ [STEP 9] No exact email match and no postcode provided, using first match at row ${matchingRows[0].rowIndex + 1}`);
          exactMatch = {
            rowIndex: matchingRows[0].rowIndex,
            locator: resultRows.nth(matchingRows[0].rowIndex)
          };
        }
      }
    }
    
    // Click exact match using JavaScript (robust method from findAndVerifyClient.js)
    let clientClicked = false;
    if (exactMatch) {
      const rowIndex = exactMatch.rowIndex;
      
      // Get the actual frame for JavaScript evaluation
      let actualFrame = null;
      try {
        await page.waitForSelector(iframeId, { state: 'attached' });
        const frameElement = await page.$(iframeId);
        if (frameElement) {
          actualFrame = await frameElement.contentFrame();
        }
      } catch (e) {
        console.log(`⚠️ [STEP 9] Could not get frame for evaluation: ${e.message}`);
      }
      
      // Verify we're still on search results page before attempting click
      const verifyStillOnSearchPage = async () => {
        try {
          const searchTable = await iframe.locator('table.dx-datagrid-table').count();
          return searchTable > 0;
        } catch {
          return false;
        }
      };
      
      // Use JavaScript click (works even if element is not visible and doesn't trigger scroll that might click row 1)
      if (rowIndex !== null && actualFrame) {
        const stillOnSearchPage = await verifyStillOnSearchPage();
        if (!stillOnSearchPage) {
          console.log(`⚠️ [STEP 9] Already navigated away from search results - cannot click row ${rowIndex + 1}`);
        } else {
          try {
            console.log(`🔄 [STEP 9] Using JavaScript click on row ${rowIndex + 1} (bypasses visibility, avoids accidental row 1 click)...`);
            // Use JavaScript to click directly - this won't trigger scroll that might click row 1
            await actualFrame.evaluate((index) => {
              const rows = document.querySelectorAll('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
              if (rows[index]) {
                // CRITICAL: Click the TD (cell) inside the row, not the TR itself
                // DevExtreme grid requires clicking the cell to trigger navigation
                const cell = rows[index].querySelector('td[role="gridcell"]');
                if (cell) {
                  // Verify we're clicking the right row by checking email
                  const emailSpan = rows[index].querySelector('.jqx_inlineSummary .jqx_inlineSummaryTitle');
                  let email = '';
                  if (emailSpan && emailSpan.textContent.includes('Email:')) {
                    const emailText = emailSpan.nextElementSibling;
                    if (emailText) {
                      const emailSpanInner = emailText.querySelector('span');
                      if (emailSpanInner) {
                        let emailTextContent = emailSpanInner.textContent.trim();
                        // CRITICAL: Remove "Copy" button text and extract only the email address
                        const emailLines = emailTextContent.split('\n');
                        email = emailLines[0].trim();
                        // Use regex to extract email pattern if split didn't work
                        if (!email || !email.includes('@')) {
                          const emailMatch = emailTextContent.match(/[\w\.-]+@[\w\.-]+\.\w+/);
                          if (emailMatch) {
                            email = emailMatch[0];
                          }
                        }
                        // Remove "Copy" text if appended directly
                        if (email && email.toLowerCase().endsWith('copy')) {
                          email = email.slice(0, -4).trim();
                        }
                      }
                    }
                  }
                  // Alternative: find email by looking for span with email pattern
                  if (!email) {
                    const allSpans = rows[index].querySelectorAll('span');
                    for (const span of allSpans) {
                      if (span.textContent.includes('@')) {
                        let emailTextContent = span.textContent.trim();
                        // CRITICAL: Remove "Copy" button text and extract only the email address
                        const emailLines = emailTextContent.split('\n');
                        email = emailLines[0].trim();
                        // Use regex to extract email pattern if split didn't work
                        if (!email || !email.includes('@')) {
                          const emailMatch = emailTextContent.match(/[\w\.-]+@[\w\.-]+\.\w+/);
                          if (emailMatch) {
                            email = emailMatch[0];
                          }
                        }
                        // Remove "Copy" text if appended directly
                        if (email && email.toLowerCase().endsWith('copy')) {
                          email = email.slice(0, -4).trim();
                        }
                        if (email) break;
                      }
                    }
                  }
                  console.log(`[DEBUG] Clicking row ${index + 1}, email: ${email}`);
                  
                  // Click the cell
                  cell.click();
                } else {
                  // Fallback: click the row itself
                  console.log(`[DEBUG] No cell found, clicking row ${index + 1} directly`);
                  rows[index].click();
                }
              }
            }, rowIndex);
            await page.waitForTimeout(2000); // Wait 2 seconds for navigation
            clientClicked = true;
            console.log(`✅ [STEP 9] Successfully clicked row ${rowIndex + 1} using JavaScript click`);
          } catch (jsErr) {
            console.log(`⚠️ [STEP 9] JavaScript click failed: ${jsErr.message}`);
            // If JavaScript click fails, try fallback
            try {
              const rowLocator = resultRows.nth(rowIndex);
              await rowLocator.click({ timeout: 10000, force: false });
              clientClicked = true;
              console.log(`✅ [STEP 9] Successfully clicked row ${rowIndex + 1} using fallback click`);
            } catch (fallbackErr) {
              console.log(`⚠️ [STEP 9] Fallback click also failed: ${fallbackErr.message}`);
            }
          }
        }
      }
    }
    
    if (!clientClicked) {
      throw new Error(`Could not click client row for email: ${email}`);
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
      console.log('✅ [STEP 9] ============================================');
      console.log('✅ [STEP 9] SUCCESS: Client details page is already loaded!');
      console.log(`✅ [STEP 9] Client email: ${email}`);
      console.log('✅ [STEP 9] Client found and selected successfully.');
      console.log('✅ [STEP 9] Client details page loaded and ready.');
      console.log('✅ [STEP 9] Proceeding to click Next button...');
      console.log('✅ [STEP 9] ============================================');
      
      // Take screenshot of the already loaded page
      await takeScreenshot(page, 'client-selected.png', screenshotsDir);
      
      console.log('✅ [STEP 9] Client found and selected');
    } else {
      // Only wait for navigation if we're not already on the client details page
      if (clientClicked) {
        console.log('⏳ [STEP 9] Waiting for client page to load...');
        await page.waitForTimeout(4000);
        await page.waitForLoadState('networkidle');
        
        // Take screenshot after clicking client
        await takeScreenshot(page, 'client-selected.png', screenshotsDir);
        
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
    await takeScreenshot(page, 'contact-details-page.png', screenshotsDir);
    
    // After client selection, the Contact Details form is likely in eventNewBooking2_iframe
    // Wait a bit more for the form to fully render
    console.log('⏳ [STEP 9] Waiting for Contact Details form to fully render...');
    await page.waitForTimeout(3000);
    
    // If skipNextClick is true, return here (for address confirmation flow)
    if (skipNextClick) {
      console.log('⏸️ [STEP 9] Skipping Next button click (address confirmation required)');
      return;
    }
    
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
      await takeScreenshot(page, 'next-button-not-found.png', screenshotsDir);
      throw new Error('Next button not found on Contact Details page - checked eventNewBooking2_iframe, current iframe, and main page');
    }
    
    // Wait for button to be attached (not visible, as it may be hidden)
    try {
      await nextButton.waitFor({ state: 'attached', timeout: 10000 });
      console.log('✅ [STEP 9] Next button is attached to DOM');
      
      // CRITICAL: Use JavaScript click (same approach as early check) - works even if button is not visible
      // This ensures reliable clicking and immediate return after success
      console.log('👆 [STEP 9] Clicking Next button using JavaScript (bypasses visibility checks)...');
      
      // Determine which iframe to use for JavaScript evaluation
      let targetFrame = null;
      if (eventBookingIframeForNextExists) {
        try {
          const frameElement = await page.$('#eventNewBooking2_iframe');
          if (frameElement) {
            targetFrame = await frameElement.contentFrame();
          }
        } catch (e) {
          console.log(`⚠️ [STEP 9] Could not get eventNewBooking2_iframe for evaluation: ${e.message}`);
        }
      }
      
      if (!targetFrame && iframe) {
        try {
          const frameElement = await page.$(iframeId);
          if (frameElement) {
            targetFrame = await frameElement.contentFrame();
          }
        } catch (e) {
          console.log(`⚠️ [STEP 9] Could not get iframe for evaluation: ${e.message}`);
        }
      }
      
      if (targetFrame) {
        try {
          const clickSuccess = await targetFrame.evaluate(() => {
            const btn = document.querySelector('#diaryNewCourseBookingWiz_nextBtn');
            if (btn) {
              btn.click();
              return true;
            }
            // Try alternative selectors
            const altBtn = document.querySelector('[aria-label="Next"], [aria-label="next"]');
            if (altBtn) {
              altBtn.click();
              return true;
            }
            return false;
          });
          
          if (clickSuccess) {
            console.log('✅ [STEP 9] ============================================');
            console.log('✅ [STEP 9] SUCCESS: Next button clicked successfully!');
            console.log('✅ [STEP 9] Contact details step completed.');
            console.log('✅ [STEP 9] IMMEDIATELY proceeding to payment step.');
            console.log('✅ [STEP 9] ============================================');
            
            // CRITICAL: Return immediately after successful click - no delays, no screenshots, no further checks
            return; // Return immediately - skip all further processing
          }
        } catch (jsErr) {
          console.log(`⚠️ [STEP 9] JavaScript click failed: ${jsErr.message}, trying Playwright click as fallback...`);
        }
      }
      
      // Fallback to Playwright click only if JavaScript fails or frame not available
      const isVisible = await nextButton.isVisible().catch(() => false);
      
      if (isVisible) {
        // Button is visible, click normally
        await nextButton.click({ timeout: 5000 });
        console.log('✅ [STEP 9] Clicked Next button (Playwright fallback - visible)');
      } else {
        // Button is hidden, use force click
        console.log('⚠️ [STEP 9] Next button is hidden, using force click');
        await nextButton.click({ force: true, timeout: 5000 });
        console.log('✅ [STEP 9] Clicked Next button (Playwright fallback - force)');
      }
      
      console.log('✅ [STEP 9] ============================================');
      console.log('✅ [STEP 9] SUCCESS: Next button clicked successfully!');
      console.log('✅ [STEP 9] Contact details step completed.');
      console.log('✅ [STEP 9] Ready to proceed to payment step.');
      console.log('✅ [STEP 9] ============================================');
      
      // CRITICAL: Return immediately after successful click - no delays, no screenshots, no further checks
      return; // Return immediately - skip all further processing
    } catch (clickErr) {
      // Handle browser closure or other errors gracefully
      if (clickErr.message.includes('Target page, context or browser has been closed')) {
        console.log('⚠️ [STEP 9] Browser was closed during Next button click');
        throw new Error('Browser was closed - cannot proceed with Next button click');
      }
      throw clickErr;
    }
    
  } catch (error) {
    console.error('Error in lookupContactAndWait:', error);
    await takeScreenshot(page, 'contact-lookup-error.png', screenshotsDir);
    throw new Error(`Failed to lookup contact: ${error.message}`);
  }
}

