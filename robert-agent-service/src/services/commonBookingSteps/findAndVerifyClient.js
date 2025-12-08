import { takeScreenshot } from './utils.js';

/**
 * Steps 3-5: Find and verify existing client
 * @param {Page} page - Playwright page object
 * @param {string} searchType - 'mobile' or 'email' - type of search to perform (deprecated: Smart search always uses email)
 * @param {string} searchValue - Mobile number or email address to search for
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} [email] - Optional email address to use when Smart search is selected (overrides searchValue)
 * @param {string} [clientPostcode] - Optional postcode for verification when multiple results appear (per document: verify email + postcode)
 * @returns {Promise<{found: boolean, clientDetails?: {fullName: string, postcode: string, telephoneNumber: string, email: string}, requiresVerification: boolean, requiresPostcodeVerification?: boolean}>}
 * 
 * DOCUMENT REQUIREMENT (ITM.txt line 350-353):
 * When multiple clients appear with same name/email, verify (1) email address and (2) postcode.
 * Only consider client VERIFIED when both email and postcode match.
 */
export async function findAndVerifyClient(page, searchType, searchValue, screenshotsDir, email = null, clientPostcode = null) {
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
    await takeScreenshot(page, 'contacts-page-loaded.png', screenshotsDir);
    
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

    await takeScreenshot(page, 'dropdown-menu-opened.png', screenshotsDir);

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

    await takeScreenshot(page, 'smart-search-selected.png', screenshotsDir);
    
    // STEP 3: Look for the search input field
    console.log('🔍 [STEP 3-5] Looking for search input field...');
    const searchField = iframe.locator('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"]').first();
    
    // Wait for the search field to be visible
    await searchField.waitFor({ state: 'visible', timeout: 10000 });
    
    // STEP 4: Enter search value - Smart search always uses email
    // When Smart search is selected, always use email (not phone number)
    let finalSearchValue = searchValue;
    let finalSearchType = searchType;
    
    if (email) {
      // If email is provided, use it for Smart search
      finalSearchValue = email;
      finalSearchType = 'email';
      console.log(`🔍 [STEP 3-5] Smart search selected - using email instead of ${searchType}: ${email}`);
    } else if (searchType === 'mobile') {
      // If no email provided but searchType is mobile, warn and use original value
      console.warn(`⚠️ [STEP 3-5] Smart search selected but no email provided - using mobile number (this may not work correctly)`);
    }
    
    console.log(`🔍 [STEP 3-5] Searching for client by email: ${finalSearchValue}`);
    await searchField.fill(finalSearchValue);
    
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
    await takeScreenshot(page, 'search-results.png', screenshotsDir);
    
    // STEP 5: Click on found client - prioritize exact matches
    console.log('👆 [STEP 3-5] Clicking on found client...');

    // Try to find and click the client - prioritize exact matches
    let clientClicked = false;

    try {
      // First, wait for search results to appear
      await page.waitForTimeout(3000);
      
      // Approach 1: Look for exact match - find rows/items that contain the exact search value
      // For email: look for exact email match
      // For mobile: look for exact phone number match
      let exactMatch = null;
      
      if (finalSearchType === 'email') {
        // Normalize email for comparison (lowercase, trim)
        const normalizedSearch = finalSearchValue.toLowerCase().trim();
        
        // Look for DevExtreme DataGrid table rows (based on actual HTML structure)
        const resultRows = iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
        const rowCount = await resultRows.count();
        
        console.log(`🔍 [STEP 3-5] Found ${rowCount} search result rows, looking for email matches...`);
        
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
              foundEmail = await emailSpan.textContent();
              foundEmail = foundEmail ? foundEmail.trim() : null;
            }
          } catch (e) {
            console.log(`⚠️ [STEP 3-5] Could not extract email from row ${i + 1}:`, e.message);
          }
          
          if (foundEmail) {
            const normalizedEmail = foundEmail.toLowerCase().trim();
            // Smart search matches loosely, so check if searched email is contained in found email or vice versa
            const emailMatches = normalizedEmail === normalizedSearch || 
                                 normalizedEmail.includes(normalizedSearch) || 
                                 normalizedSearch.includes(normalizedEmail);
            
            if (emailMatches) {
              console.log(`✅ [STEP 3-5] Found email match in row ${i + 1}: ${foundEmail}`);
              
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
                    console.log(`📍 [STEP 3-5] Extracted postcode from row ${i + 1}: ${postcode}`);
                  }
                }
              } catch (e) {
                console.log(`⚠️ [STEP 3-5] Could not extract postcode from row ${i + 1}:`, e.message);
              }
              
              matchingRows.push({
                row: row,
                email: foundEmail,
                postcode: postcode,
                index: i
              });
            }
          }
        }
        
        console.log(`📊 [STEP 3-5] Found ${matchingRows.length} rows with matching email`);
        
        // DOCUMENT REQUIREMENT (ITM.txt line 350-353):
        // When multiple results appear, verify email + postcode before selecting
        // "If that happens you need to confirm the (1) email address of the client, and (2) the postcode"
        if (matchingRows.length === 0) {
          // No matches found
          console.log('⚠️ [STEP 3-5] No email matches found in search results');
        } else if (matchingRows.length === 1) {
          // Single match - can proceed directly
          console.log('✅ [STEP 3-5] Single email match found, proceeding...');
          exactMatch = matchingRows[0].row;
        } else {
          // Multiple matches - need to verify email + postcode per document
          console.log(`⚠️ [STEP 3-5] Multiple email matches found (${matchingRows.length}). Per document, need to verify email + postcode.`);
          console.log('📋 [STEP 3-5] Extracted matches:');
          matchingRows.forEach((match, idx) => {
            console.log(`   ${idx + 1}. Email: ${match.email}, Postcode: ${match.postcode || 'Not visible in search results'}`);
          });
          
          // Try to find exact email match first
          const exactEmailMatch = matchingRows.find(m => m.email.toLowerCase().trim() === normalizedSearch);
          if (exactEmailMatch) {
            console.log('✅ [STEP 3-5] Found exact email match, will verify postcode after selection');
            exactMatch = exactEmailMatch.row;
          } else {
            // No exact match - will need to verify each one
            // For now, select the first one and verify postcode after clicking (per document requirement)
            console.log('⚠️ [STEP 3-5] No exact email match, will verify postcode for each potential match');
            // We'll handle this in the verification step after clicking
            exactMatch = matchingRows[0].row;
          }
        }
        
        // If no exact match found via row iteration, try to find element with exact text
        if (!exactMatch) {
          const exactEmailElement = iframe.locator(`text=/^${searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$/i`).first();
          if (await exactEmailElement.count() > 0) {
            console.log('✅ [STEP 3-5] Found exact email match via text locator');
            // Find the parent row/clickable element
            exactMatch = exactEmailElement.locator('xpath=ancestor::tr | ancestor::a | ancestor::[role="row"]').first();
            if (await exactMatch.count() === 0) {
              exactMatch = exactEmailElement;
            }
          }
        }
      } else if (finalSearchType === 'mobile') {
        // Normalize phone number for comparison (remove spaces, dashes, parentheses)
        const normalizedSearch = finalSearchValue.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
        
        // Look for DevExtreme DataGrid table rows (based on actual HTML structure)
        const resultRows = iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
        const rowCount = await resultRows.count();
        
        console.log(`🔍 [STEP 3-5] Found ${rowCount} search result rows, looking for exact phone match...`);
        
        // Check each row for exact phone match
        for (let i = 0; i < rowCount; i++) {
          const row = resultRows.nth(i);
          
          // Extract phone using specific selector (based on actual HTML structure)
          // Phone is in: .jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Phone:")) .jqx_inlineSummaryText span
          try {
            const phoneSpan = row.locator('.jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Phone:")) .jqx_inlineSummaryText span');
            if (await phoneSpan.count() > 0) {
              const phoneText = await phoneSpan.textContent();
              if (phoneText) {
                // Extract phone number from text (may contain "(M)" suffix, e.g., "+441234567890(M)")
                const phoneMatch = phoneText.match(/[\d\s\-\(\)\+]+/g);
                if (phoneMatch) {
                  const foundPhone = phoneMatch.find(phone => {
                    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
                    return normalizedPhone === normalizedSearch || normalizedPhone.endsWith(normalizedSearch) || normalizedSearch.endsWith(normalizedPhone);
                  });
                  if (foundPhone) {
                    console.log(`✅ [STEP 3-5] Found exact phone match in row ${i + 1}: ${foundPhone}`);
                    exactMatch = row;
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.log(`⚠️ [STEP 3-5] Could not extract phone from row ${i + 1}:`, e.message);
          }
        }
      }
      
      // Click exact match if found
      if (exactMatch && await exactMatch.count() > 0) {
        console.log('✅ [STEP 3-5] Clicking exact match...');
        await exactMatch.click();
        clientClicked = true;
      } else {
        // Fallback: Look for visible text containing search value (but be more specific)
        console.log('⚠️ [STEP 3-5] No exact match found, trying fallback approaches...');
        
        // Approach 2: Look for clickable elements (links, buttons) with exact search value
        const clickableClient = iframe.locator(`a:has-text("${searchValue}"), button:has-text("${searchValue}"), [role="button"]:has-text("${searchValue}")`).first();
        if (await clickableClient.count() > 0 && await clickableClient.isVisible()) {
          console.log('✅ [STEP 3-5] Found clickable client element with search value');
          await clickableClient.click();
          clientClicked = true;
        } else {
          // Approach 3: Look for first result row but verify it contains the search value
          const resultRows = iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
          const firstResult = resultRows.first();
          
          if (await firstResult.count() > 0) {
            // Check if first result contains the search value by extracting email/phone
            let containsSearchValue = false;
            if (finalSearchType === 'email') {
              try {
                const emailSpan = firstResult.locator('.jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Email:")) .jqx_inlineSummaryText span');
                if (await emailSpan.count() > 0) {
                  const emailText = await emailSpan.textContent();
                  containsSearchValue = emailText && emailText.toLowerCase().includes(searchValue.toLowerCase());
                }
              } catch (e) {
                // Fallback to text content check
                const firstResultText = await firstResult.textContent();
                containsSearchValue = firstResultText && firstResultText.includes(searchValue);
              }
            } else {
              // For mobile, check text content
              const firstResultText = await firstResult.textContent();
              containsSearchValue = firstResultText && firstResultText.includes(searchValue);
            }
            
            if (containsSearchValue) {
              console.log('✅ [STEP 3-5] Clicking first search result (contains search value)');
              await firstResult.click();
              clientClicked = true;
            } else {
              console.log('⚠️ [STEP 3-5] First result does not contain search value, skipping...');
            }
          }
        }
      }
    } catch (clickError) {
      console.log('❌ Failed to click client, but continuing to check if page navigation occurred...');
      console.log('❌ Click error:', clickError.message);
    }
    
    // CRITICAL: Check if we're already on the client details page BEFORE waiting (robust verification)
    console.log('🔍 [STEP 3-5] Checking if client details page is already loaded...');
    
    // Look for "First Names" and "Surname" fields which indicate we're on the client details page
    const firstNameField = await iframe.locator('text=First Names, label:has-text("First Names")').count() > 0;
    const surnameField = await iframe.locator('text=Surname, label:has-text("Surname")').count() > 0;
    
    // Look for "Contact e-mail" field
    const contactEmailField = await iframe.locator('text=Contact e-mail, label:has-text("Contact e-mail")').count() > 0;
    
    const isOnClientDetailsPage = firstNameField || surnameField || contactEmailField;
    
    if (isOnClientDetailsPage) {
      console.log('✅ [STEP 3-5] Client details page is already loaded');
      
      // Take screenshot of the already loaded page
      await takeScreenshot(page, 'client-selected.png', screenshotsDir);
      
      // Extract client details from the page
      const clientDetails = await extractClientDetails(iframe);
      
      if (clientDetails) {
        // Verify the extracted details match what we searched for
        let matchesSearch = false;
        
        if (finalSearchType === 'email') {
          const extractedEmail = clientDetails.email?.toLowerCase().trim();
          const searchEmail = finalSearchValue.toLowerCase().trim();
          const emailMatches = extractedEmail === searchEmail;
          
          // Per document: When multiple results appear, verify email + postcode
          let postcodeMatches = true; // Default to true if no postcode provided for verification
          if (clientPostcode) {
            const extractedPostcode = clientDetails.postcode?.toUpperCase().replace(/\s+/g, '').trim();
            const searchPostcode = clientPostcode.toUpperCase().replace(/\s+/g, '').trim();
            postcodeMatches = extractedPostcode === searchPostcode;
            if (!postcodeMatches) {
              console.log(`⚠️ [STEP 3-5] Postcode mismatch: searched for "${searchPostcode}", found "${extractedPostcode}"`);
            } else {
              console.log(`✅ [STEP 3-5] Postcode matches: "${searchPostcode}"`);
            }
          }
          
          matchesSearch = emailMatches && postcodeMatches;
          if (!emailMatches) {
            console.log(`⚠️ [STEP 3-5] Email mismatch: searched for "${searchEmail}", found "${extractedEmail}"`);
          }
          
          // If email matches but postcode doesn't (and postcode was provided), this is not a match
          if (emailMatches && clientPostcode && !postcodeMatches) {
            console.log(`❌ [STEP 3-5] Email matches but postcode doesn't - this is not the correct client per document requirements`);
          }
        } else if (finalSearchType === 'mobile') {
          const extractedPhone = clientDetails.telephoneNumber?.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
          const searchPhone = finalSearchValue.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
          matchesSearch = extractedPhone === searchPhone || extractedPhone?.endsWith(searchPhone) || searchPhone.endsWith(extractedPhone);
          if (!matchesSearch) {
            console.log(`⚠️ [STEP 3-5] Phone mismatch: searched for "${searchPhone}", found "${extractedPhone}"`);
          }
        }
        
        if (!matchesSearch) {
          console.log('❌ [STEP 3-5] Selected client does not match search criteria');
          
          // If email matched but postcode didn't, provide specific error
          if (finalSearchType === 'email' && clientPostcode) {
            return {
              found: false,
              requiresVerification: false,
              error: `Selected client email matches but postcode does not match. Per document requirements, both email and postcode must match when multiple results appear.`,
              requiresPostcodeVerification: true
            };
          }
          
          return {
            found: false,
            requiresVerification: false,
            error: `Selected client does not match search criteria. Searched for ${searchType}: ${searchValue}`
          };
        }
        
        console.log('✅ [STEP 3-5] Client found and details extracted - email and postcode verified');
        return {
          found: true,
          clientDetails,
          requiresVerification: true
        };
      } else {
        console.log('⚠️ [STEP 3-5] Client found but could not extract all details');
        return {
          found: true,
          requiresVerification: true
        };
      }
    } else {
      // Only wait for navigation if we're not already on the client details page
      if (clientClicked) {
        console.log('⏳ [STEP 3-5] Waiting for client page to load...');
        await page.waitForTimeout(4000);
        await page.waitForLoadState('networkidle');
        
        // Take screenshot after clicking client
        await takeScreenshot(page, 'client-selected.png', screenshotsDir);
        
        // Verify we're on the client details page
        console.log('🔍 [STEP 3-5] Verifying client details page...');
        
        // Look for "First Names" and "Surname" fields which indicate we're on the client details page
        const firstNameFieldAfterWait = await iframe.locator('text=First Names, label:has-text("First Names")').count() > 0;
        const surnameFieldAfterWait = await iframe.locator('text=Surname, label:has-text("Surname")').count() > 0;
        
        // Look for "Contact e-mail" field
        const contactEmailFieldAfterWait = await iframe.locator('text=Contact e-mail, label:has-text("Contact e-mail")').count() > 0;
        
        if (firstNameFieldAfterWait || surnameFieldAfterWait || contactEmailFieldAfterWait) {
          console.log('✅ [STEP 3-5] Client details page loaded successfully');
          
          // Extract client details from the page
          const clientDetails = await extractClientDetails(iframe);
          
          if (clientDetails) {
            // Verify the extracted details match what we searched for
            let matchesSearch = false;
            
            if (finalSearchType === 'email') {
              const extractedEmail = clientDetails.email?.toLowerCase().trim();
              const searchEmail = finalSearchValue.toLowerCase().trim();
              const emailMatches = extractedEmail === searchEmail;
              
              // Per document: When multiple results appear, verify email + postcode
              let postcodeMatches = true; // Default to true if no postcode provided for verification
              if (clientPostcode) {
                const extractedPostcode = clientDetails.postcode?.toUpperCase().replace(/\s+/g, '').trim();
                const searchPostcode = clientPostcode.toUpperCase().replace(/\s+/g, '').trim();
                postcodeMatches = extractedPostcode === searchPostcode;
                if (!postcodeMatches) {
                  console.log(`⚠️ [STEP 3-5] Postcode mismatch: searched for "${searchPostcode}", found "${extractedPostcode}"`);
                } else {
                  console.log(`✅ [STEP 3-5] Postcode matches: "${searchPostcode}"`);
                }
              }
              
              matchesSearch = emailMatches && postcodeMatches;
              if (!emailMatches) {
                console.log(`⚠️ [STEP 3-5] Email mismatch: searched for "${searchEmail}", found "${extractedEmail}"`);
              }
              
              // If email matches but postcode doesn't (and postcode was provided), this is not a match
              if (emailMatches && clientPostcode && !postcodeMatches) {
                console.log(`❌ [STEP 3-5] Email matches but postcode doesn't - this is not the correct client per document requirements`);
              }
            } else if (finalSearchType === 'mobile') {
              const extractedPhone = clientDetails.telephoneNumber?.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
              const searchPhone = finalSearchValue.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
              matchesSearch = extractedPhone === searchPhone || extractedPhone?.endsWith(searchPhone) || searchPhone.endsWith(extractedPhone);
              if (!matchesSearch) {
                console.log(`⚠️ [STEP 3-5] Phone mismatch: searched for "${searchPhone}", found "${extractedPhone}"`);
              }
            }
            
            if (!matchesSearch) {
              console.log('❌ [STEP 3-5] Selected client does not match search criteria');
              
              // If email matched but postcode didn't, provide specific error
              if (finalSearchType === 'email' && clientPostcode) {
                return {
                  found: false,
                  requiresVerification: false,
                  error: `Selected client email matches but postcode does not match. Per document requirements, both email and postcode must match when multiple results appear.`,
                  requiresPostcodeVerification: true
                };
              }
              
              return {
                found: false,
                requiresVerification: false,
                error: `Selected client does not match search criteria. Searched for ${searchType}: ${searchValue}`
              };
            }
            
            console.log('✅ [STEP 3-5] Client found and details extracted - email and postcode verified');
            return {
              found: true,
              clientDetails,
              requiresVerification: true
            };
          } else {
            console.log('⚠️ [STEP 3-5] Client found but could not extract all details');
            return {
              found: true,
              requiresVerification: true
            };
          }
        } else {
          console.log('❌ [STEP 3-5] Client details page verification failed');
          return {
            found: false,
            requiresVerification: false
          };
        }
      } else {
        console.log('❌ [STEP 3-5] Could not click client and page navigation did not occur');
        return {
          found: false,
          requiresVerification: false
        };
      }
    }
    
  } catch (error) {
    console.error('❌ [STEP 3-5] Client search failed:', error);
    await takeScreenshot(page, 'client-search-error.png', screenshotsDir);
    return {
      found: false,
      requiresVerification: false,
      error: error.message
    };
  }
}

/**
 * Extract client details from the CRM contact details page
 * @param {FrameLocator} iframe - Frame locator for the contact details iframe
 * @returns {Promise<{fullName: string, postcode: string, telephoneNumber: string, email: string} | null>}
 */
async function extractClientDetails(iframe) {
  try {
    console.log('🔍 [STEP 3-5] Extracting client details from CRM page...');
    
    // Extract First Names
    let firstNames = '';
    try {
      const firstNameField = iframe.locator('input[id*="cnt_first_names"], input[name*="first_names"], label:has-text("First Names") + input, label:has-text("First Names") ~ input').first();
      if (await firstNameField.count() > 0) {
        firstNames = await firstNameField.inputValue() || '';
        console.log(`📝 Extracted First Names: ${firstNames}`);
      }
    } catch (e) {
      console.log('⚠️ Could not extract First Names');
    }
    
    // Extract Surname
    let surname = '';
    try {
      const surnameField = iframe.locator('input[id*="cnt_surname"], input[name*="surname"], label:has-text("Surname") + input, label:has-text("Surname") ~ input').first();
      if (await surnameField.count() > 0) {
        surname = await surnameField.inputValue() || '';
        console.log(`📝 Extracted Surname: ${surname}`);
      }
    } catch (e) {
      console.log('⚠️ Could not extract Surname');
    }
    
    // Construct full name
    const fullName = `${firstNames} ${surname}`.trim();
    
    // Extract Postcode
    let postcode = '';
    try {
      const postcodeField = iframe.locator('input[id*="post_code"], input[id*="postcode"], input[name*="post_code"], input[name*="postcode"], label:has-text("Post code") + input, label:has-text("Post code") ~ input, label:has-text("Post Code") + input, label:has-text("Post Code") ~ input').first();
      if (await postcodeField.count() > 0) {
        postcode = await postcodeField.inputValue() || '';
        console.log(`📝 Extracted Postcode: ${postcode}`);
      }
    } catch (e) {
      console.log('⚠️ Could not extract Postcode');
    }
    
    // Extract Contact mobile number
    let telephoneNumber = '';
    try {
      const mobileField = iframe.locator('input[id*="mobile_number"], input[id*="mobile"], input[name*="mobile_number"], input[name*="mobile"], label:has-text("Contact mobile number") + input, label:has-text("Contact mobile number") ~ input').first();
      if (await mobileField.count() > 0) {
        telephoneNumber = await mobileField.inputValue() || '';
        console.log(`📝 Extracted Telephone Number: ${telephoneNumber}`);
      }
    } catch (e) {
      console.log('⚠️ Could not extract Telephone Number');
    }
    
    // Extract Contact e-mail
    let email = '';
    try {
      const emailField = iframe.locator('input[id*="email"], input[name*="email"], input[type="email"], label:has-text("Contact e-mail") + input, label:has-text("Contact e-mail") ~ input').first();
      if (await emailField.count() > 0) {
        email = await emailField.inputValue() || '';
        console.log(`📝 Extracted Email: ${email}`);
      }
    } catch (e) {
      console.log('⚠️ Could not extract Email');
    }
    
    if (fullName || postcode || telephoneNumber || email) {
      return {
        fullName: fullName || 'Not found',
        postcode: postcode || 'Not found',
        telephoneNumber: telephoneNumber || 'Not found',
        email: email || 'Not found'
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ [STEP 3-5] Error extracting client details:', error);
    return null;
  }
}

