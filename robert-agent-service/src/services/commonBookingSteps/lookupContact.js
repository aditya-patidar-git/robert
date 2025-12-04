import { takeScreenshot } from './utils.js';

/**
 * Step 9: Lookup contact and wait
 * @param {Page} page - Playwright page object
 * @param {string} email - Client email address to lookup
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function lookupContactAndWait(page, email, screenshotsDir) {
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
    
    await lookupButton.waitFor({ state: 'visible', timeout: 5000 });
    await lookupButton.click();
    
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
    await takeScreenshot(page, 'contact-search-results.png', screenshotsDir);
    
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
    await takeScreenshot(page, 'after-next-click.png', screenshotsDir);
    
    // Take final screenshot
    await takeScreenshot(page, 'final-contact-page.png', screenshotsDir);
    
    // Wait for 10 seconds
    console.log('⏰ [STEP 9] Waiting 10 seconds before closing...');
    await page.waitForTimeout(10000);
    
    console.log('✅ [STEP 9] Contact lookup completed and waited 10 seconds');
    
  } catch (error) {
    console.error('Error in lookupContactAndWait:', error);
    await takeScreenshot(page, 'contact-lookup-error.png', screenshotsDir);
    throw new Error(`Failed to lookup contact: ${error.message}`);
  }
}

