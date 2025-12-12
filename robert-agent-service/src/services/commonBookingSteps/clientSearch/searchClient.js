import { takeScreenshot } from '../utils.js';

/**
 * Search Client
 * Handles Smart search selection and client search execution in CRM
 */

/**
 * Select Smart search option from dropdown
 * @param {FrameLocator} iframe - Frame locator for the contact lookup iframe
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function selectSmartSearch(iframe, page, screenshotsDir) {
  try {
    console.log('🔍 [SEARCH] Looking for search dropdown in iframe...');
    
    // Look for any dropdown or select element that might contain search options
    const searchDropdown = iframe.locator('select, [role="combobox"], .dx-dropdowneditor').first();
    
    // Wait for the dropdown to be visible
    await searchDropdown.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log('✅ [SEARCH] Found search dropdown, clicking to open options...');
    
    // Click on the dropdown to open the menu
    await searchDropdown.click();
    
    // WAIT FOR DROPDOWN MENU TO APPEAR - 2 seconds
    console.log('⏳ [SEARCH] Waiting for dropdown menu to appear...');
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'dropdown-menu-opened.png', screenshotsDir);

    // Look for "Smart search" option and scroll up to make it clickable
    console.log('🔍 [SEARCH] Looking for Smart search option in menu...');
    
    const smartSearchOption = iframe.locator('text=Smart search').first();
    
    // Check if it's visible, if not, scroll up
    const isSmartSearchVisible = await smartSearchOption.isVisible();
    console.log(`🔍 [SEARCH] Smart search visible: ${isSmartSearchVisible}`);
    
    if (!isSmartSearchVisible) {
      console.log('🔍 [SEARCH] Smart search not visible, scrolling up in dropdown...');
      
      // Scroll up in the dropdown menu to make Smart search visible
      await page.keyboard.press('Home');
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
    console.log('✅ [SEARCH] Smart search option is now visible, clicking...');
    await smartSearchOption.click();
    
    // WAIT FOR SMART SEARCH TO BE APPLIED - 2 seconds
    console.log('⏳ [SEARCH] Waiting for Smart search selection...');
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'smart-search-selected.png', screenshotsDir);
    
    return true;
  } catch (error) {
    console.error('❌ [SEARCH] Error selecting Smart search:', error);
    throw error;
  }
}

/**
 * Execute search in CRM
 * @param {FrameLocator} iframe - Frame locator for the contact lookup iframe
 * @param {Page} page - Playwright page object
 * @param {string} searchValue - Value to search for (email or mobile)
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function executeSearch(iframe, page, searchValue, screenshotsDir) {
  try {
    console.log('🔍 [SEARCH] Looking for search input field...');
    const searchField = iframe.locator('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"]').first();
    
    // Wait for the search field to be visible
    await searchField.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log(`🔍 [SEARCH] Searching for client: ${searchValue}`);
    await searchField.fill(searchValue);
    
    // Try multiple approaches to trigger the search
    console.log('🔍 [SEARCH] Triggering search...');
    
    // Approach 1: Press Enter to trigger search
    await searchField.press('Enter');
    await page.waitForTimeout(2000);
    
    // Approach 2: Look for and click search icon/button
    console.log('🔍 [SEARCH] Looking for search icon/button...');
    const searchButton = iframe.locator('button[type="submit"], .search-button, [aria-label*="search"], [title*="search"], .fa-search, .search-icon').first();
    
    if (await searchButton.count() > 0) {
      console.log('✅ [SEARCH] Found search button, clicking...');
      await searchButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('❌ [SEARCH] No search button found, trying alternative...');
      
      // Approach 3: Safer approach - Use JavaScript to blur the input field directly
      console.log('🔍 [SEARCH] Blurring search input field to trigger search...');
      try {
        const frameElement = await page.$('#contactLookup_iframe');
        if (frameElement) {
          const actualFrame = await frameElement.contentFrame();
          if (actualFrame) {
            await actualFrame.evaluate(() => {
              const activeElement = document.activeElement;
              if (activeElement && activeElement.tagName === 'INPUT') {
                activeElement.blur();
              }
            });
            console.log('✅ [SEARCH] Blurred search input field using JavaScript');
          }
        }
      } catch (e) {
        console.log(`⚠️ [SEARCH] Could not blur input: ${e.message}, trying container click...`);
        // Fallback: Try clicking on a safe container
        const safeContainer = iframe.locator('.jqx_pageContent, .dx-widget, [class*="container"]').first();
        if (await safeContainer.count() > 0) {
          await safeContainer.click({ position: { x: 10, y: 10 }, force: true });
          console.log('✅ [SEARCH] Clicked on safe container');
        } else {
          // Last resort: Click on body at top-left corner (less likely to hit interactive elements)
          await iframe.locator('body').click({ position: { x: 10, y: 10 }, force: true });
          console.log('⚠️ [SEARCH] Clicked on body as last resort');
        }
      }
      await page.waitForTimeout(2000);
      
      // Approach 4: Use Tab to move focus away
      console.log('🔍 [SEARCH] Using Tab to move focus...');
      await searchField.press('Tab');
      await page.waitForTimeout(2000);
    }
    
    // WAIT FOR SEARCH RESULTS - 5 seconds
    console.log('⏳ [SEARCH] Waiting for search results...');
    await page.waitForTimeout(5000);
    
    // Take screenshot after search
    await takeScreenshot(page, 'search-results.png', screenshotsDir);
    
    return true;
  } catch (error) {
    console.error('❌ [SEARCH] Error executing search:', error);
    throw error;
  }
}

/**
 * Find matching client row in search results
 * @param {FrameLocator} iframe - Frame locator for the contact lookup iframe
 * @param {string} searchType - 'email' or 'mobile'
 * @param {string} searchValue - Original search value
 * @param {string} email - Optional email for Smart search (overrides searchValue)
 * @returns {Promise<{rowIndex: number, email?: string, postcode?: string, matchingRows?: Array} | null>}
 */
export async function findMatchingClientRow(iframe, searchType, searchValue, email = null) {
  try {
    // Determine final search type and value
    let finalSearchType = searchType;
    let finalSearchValue = searchValue;
    
    if (email) {
      finalSearchValue = email;
      finalSearchType = 'email';
      console.log(`🔍 [SEARCH] Smart search selected - using email: ${email}`);
    }
    
    // Wait for search results to appear
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for DevExtreme DataGrid table rows
    const resultRows = iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
    const rowCount = await resultRows.count();
    
    console.log(`🔍 [SEARCH] Found ${rowCount} search result rows`);
    
    if (rowCount === 0) {
      return null;
    }
    
    if (finalSearchType === 'email') {
      // Normalize email for comparison
      const normalizedSearch = finalSearchValue.toLowerCase().trim();
      
      console.log(`🔍 [SEARCH] Looking for email matches...`);
      
      // Extract all rows that contain the email
      const matchingRows = [];
      for (let i = 0; i < rowCount; i++) {
        const row = resultRows.nth(i);
        
        // Extract email
        let foundEmail = null;
        try {
          const emailSpan = row.locator('.jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Email:")) .jqx_inlineSummaryText span');
          if (await emailSpan.count() > 0) {
            foundEmail = await emailSpan.textContent();
            foundEmail = foundEmail ? foundEmail.trim() : null;
          }
        } catch (e) {
          console.log(`⚠️ [SEARCH] Could not extract email from row ${i + 1}:`, e.message);
        }
        
        if (foundEmail) {
          const normalizedEmail = foundEmail.toLowerCase().trim();
          const emailMatches = normalizedEmail === normalizedSearch || 
                               normalizedEmail.includes(normalizedSearch) || 
                               normalizedSearch.includes(normalizedEmail);
          
          if (emailMatches) {
            console.log(`✅ [SEARCH] Found email match in row ${i + 1}: ${foundEmail}`);
            
            // Extract postcode
            let postcode = null;
            try {
              const postcodeSpan = row.locator('div.jqx_margin_right + div[style*="display:inline-block"] > span');
              if (await postcodeSpan.count() > 0) {
                const postcodeText = await postcodeSpan.textContent();
                const postcodeMatch = postcodeText.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi);
                if (postcodeMatch && postcodeMatch.length > 0) {
                  postcode = postcodeMatch[postcodeMatch.length - 1].trim();
                  console.log(`📍 [SEARCH] Extracted postcode from row ${i + 1}: ${postcode}`);
                }
              }
            } catch (e) {
              console.log(`⚠️ [SEARCH] Could not extract postcode from row ${i + 1}:`, e.message);
            }
            
            matchingRows.push({
              rowIndex: i,
              email: foundEmail,
              postcode: postcode,
              index: i
            });
          }
        }
      }
      
      console.log(`📊 [SEARCH] Found ${matchingRows.length} rows with matching email`);
      
      if (matchingRows.length === 0) {
        return null;
      } else if (matchingRows.length === 1) {
        // Single match
        return {
          rowIndex: matchingRows[0].rowIndex,
          email: matchingRows[0].email,
          postcode: matchingRows[0].postcode
        };
      } else {
        // Multiple matches - return first match but include all matches for verification
        const exactEmailMatch = matchingRows.find(m => m.email.toLowerCase().trim() === normalizedSearch);
        if (exactEmailMatch) {
          return {
            rowIndex: exactEmailMatch.rowIndex,
            email: exactEmailMatch.email,
            postcode: exactEmailMatch.postcode,
            matchingRows: matchingRows
          };
        } else {
          return {
            rowIndex: matchingRows[0].rowIndex,
            email: matchingRows[0].email,
            postcode: matchingRows[0].postcode,
            matchingRows: matchingRows
          };
        }
      }
      
    } else if (finalSearchType === 'mobile') {
      // Normalize phone number for comparison
      const normalizedSearch = finalSearchValue.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '').replace(/^\+44/, '0');
      
      console.log(`🔍 [SEARCH] Looking for phone matches...`);
      
      // Check each row for exact phone match
      for (let i = 0; i < rowCount; i++) {
        const row = resultRows.nth(i);
        
        try {
          const phoneSpan = row.locator('.jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Phone:")) .jqx_inlineSummaryText span');
          if (await phoneSpan.count() > 0) {
            const phoneText = await phoneSpan.textContent();
            if (phoneText) {
              // Extract phone number - handle format like "07502867965(M)  " or "07502867965"
              // Remove "(M)" suffix and any trailing spaces, then extract phone number
              const cleanedPhoneText = phoneText.replace(/\(M\)/g, '').trim();
              // Extract phone number pattern (digits, spaces, dashes, parentheses, plus)
              const phoneMatch = cleanedPhoneText.match(/[\d\s\-\(\)\+]+/);
              if (phoneMatch) {
                const foundPhone = phoneMatch[0].trim();
                const normalizedPhone = foundPhone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '').replace(/^\+44/, '0');
                // Compare normalized phone numbers
                if (normalizedPhone === normalizedSearch || normalizedPhone.endsWith(normalizedSearch) || normalizedSearch.endsWith(normalizedPhone)) {
                  console.log(`✅ [SEARCH] Found exact phone match in row ${i + 1}: ${foundPhone}`);
                  return {
                    rowIndex: i
                  };
                }
              }
            }
          }
        } catch (e) {
          console.log(`⚠️ [SEARCH] Could not extract phone from row ${i + 1}:`, e.message);
        }
      }
      
      return null;
    }
    
    return null;
  } catch (error) {
    console.error('❌ [SEARCH] Error finding matching client row:', error);
    return null;
  }
}

/**
 * Click on client row to navigate to client details page
 * @param {FrameLocator} iframe - Frame locator for the contact lookup iframe
 * @param {Page} page - Playwright page object
 * @param {number} rowIndex - Index of the row to click
 * @returns {Promise<boolean>} - True if click was successful
 */
export async function clickClientRow(iframe, page, rowIndex) {
  try {
    console.log(`🖱️ [SEARCH] Clicking client row ${rowIndex + 1}...`);
    
    // Get the actual frame for JavaScript evaluation
    let actualFrame = null;
    try {
      await page.waitForSelector('#contactLookup_iframe', { state: 'attached' });
      const frameElement = await page.$('#contactLookup_iframe');
      if (frameElement) {
        actualFrame = await frameElement.contentFrame();
      }
    } catch (e) {
      console.log(`⚠️ [SEARCH] Could not get frame for evaluation: ${e.message}`);
      return false;
    }
    
    if (!actualFrame) {
      return false;
    }
    
    // Verify we're still on search results page
    const verifyStillOnSearchPage = async () => {
      try {
        const searchTable = await iframe.locator('table.dx-datagrid-table').count();
        return searchTable > 0;
      } catch {
        return false;
      }
    };
    
    const stillOnSearchPage = await verifyStillOnSearchPage();
    if (!stillOnSearchPage) {
      console.log(`⚠️ [SEARCH] Already navigated away from search results`);
      return false;
    }
    
    // Use JavaScript to click directly by index
    try {
      await actualFrame.evaluate((index) => {
        const rows = document.querySelectorAll('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
        if (rows[index]) {
          const cell = rows[index].querySelector('td[role="gridcell"]');
          if (cell) {
            cell.click();
          } else {
            rows[index].click();
          }
        }
      }, rowIndex);
      
      await page.waitForTimeout(2000); // Wait for navigation
      console.log(`✅ [SEARCH] Successfully clicked row ${rowIndex + 1}`);
      return true;
    } catch (jsErr) {
      console.log(`⚠️ [SEARCH] JavaScript click failed: ${jsErr.message}`);
      return false;
    }
  } catch (error) {
    console.error('❌ [SEARCH] Error clicking client row:', error);
    return false;
  }
}

